export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cached, invalidatePrefix } from "@/lib/cache"
import { updateIssueSchema } from "@/lib/validations/issue"
import { createNotification } from "@/lib/utils/notifications"
import { z } from "zod"
import type { IssueStatus } from "@prisma/client"

// Shared include for issue detail — uses select to pull only the fields
// the UI needs, keeping the Prisma query and JSON payload lean.
const issueDetailInclude = {
  team: { select: { id: true, name: true, prefix: true, color: true } },
  assignee: { select: { id: true, name: true, email: true, image: true } },
  reporter: { select: { id: true, name: true, email: true, image: true } },
  sprint: { select: { id: true, name: true, status: true } },
  comments: {
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
      attachments: {
        select: { id: true, filename: true, storagePath: true, contentType: true, size: true, createdAt: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
    take: 100, // cap to prevent unbounded payloads on issues with many comments
  },
  attachments: {
    select: { id: true, filename: true, storagePath: true, contentType: true, size: true, uploaderId: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
  subtasks: {
    where: { deletedAt: null },
    select: { id: true, displayId: true, title: true, status: true, type: true, priority: true },
  },
  parentIssue: { select: { id: true, displayId: true, title: true } },
} as const

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Try to find by id first, fall back to displayId — cached for 30s
    const issue = await cached(`issue:${params.id}`, 30_000, async () => {
      return (
        (await prisma.issue.findFirst({
          where: { id: params.id, deletedAt: null },
          include: issueDetailInclude,
        })) ??
        (await prisma.issue.findFirst({
          where: { displayId: params.id, deletedAt: null },
          include: issueDetailInclude,
        }))
      )
    })

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    return NextResponse.json(issue)
  } catch (error) {
    console.error("GET /api/issues/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to fetch issue" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    // childActions are handled separately — strip before Zod parse
    const { childActions, ...updateBody } = body
    const updateData = updateIssueSchema.parse(updateBody)

    // Validate childActions schema if present
    const childActionsSchema = z.array(
      z.object({
        issueId: z.string(),
        action: z.enum(["close", "backlog"]),
      })
    ).optional()
    const parsedChildActions = childActionsSchema.parse(childActions)

    // Find issue by id or displayId in a single query (avoids sequential round-trips)
    const issue = await prisma.issue.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: params.id }, { displayId: params.id }],
      },
    })

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    // ── Open-children check when transitioning to DONE ──────────────────────
    // If no childActions were supplied, check for open subtasks / tested-by bugs
    // and return a 409 so the frontend can show the resolution modal.
    if (updateData.status === "DONE" && issue.status !== "DONE" && !parsedChildActions) {
      const openSubtasks = await prisma.issue.findMany({
        where: { parentIssueId: issue.id, deletedAt: null, status: { not: "DONE" } },
        select: {
          id: true, displayId: true, title: true, status: true,
          assignee: { select: { id: true, name: true, email: true, image: true } },
        },
      })

      if (openSubtasks.length > 0) {
        return NextResponse.json(
          { requiresResolution: true, openSubtasks },
          { status: 409 }
        )
      }
    }

    // Track old assignee for notification purposes
    const oldAssigneeId = issue.assigneeId

    // Auto-transition BACKLOG → TODO when issue is assigned to an ACTIVE sprint.
    // Issues in PLANNING sprints stay BACKLOG until the sprint is started.
    const patchData: typeof updateData & { status?: string } = { ...updateData }
    let targetSprintStatus: string | null = null
    if (updateData.sprintId) {
      const targetSprint = await prisma.sprint.findUnique({
        where: { id: updateData.sprintId },
        select: { status: true },
      })
      targetSprintStatus = targetSprint?.status ?? null
      if (
        !updateData.status &&           // caller didn't explicitly change status
        issue.status === "BACKLOG" &&   // issue is still in backlog state
        targetSprintStatus === "ACTIVE"
      ) {
        patchData.status = "TODO"
      }
    }

    // Update the issue + cascade subtasks in a single transaction
    const updatedIssue = await prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id: issue.id },
        data: patchData,
        include: issueDetailInclude,
      })

      // ── Cascade sprintId to subtasks ──────────────────────────────────────
      // When a parent issue moves to a sprint (or back to backlog), its subtasks follow.
      if ('sprintId' in updateData) {
        const subtaskUpdate: { sprintId: string | null; status?: IssueStatus } = {
          sprintId: updateData.sprintId ?? null,
        }
        if (patchData.status === 'TODO') {
          // Parent auto-transitioned BACKLOG→TODO (active sprint), subtasks follow
          subtaskUpdate.status = 'TODO'
        } else if (!updateData.sprintId) {
          // Moving to backlog (sprintId = null), reset subtasks to BACKLOG
          subtaskUpdate.status = 'BACKLOG'
        } else if (targetSprintStatus === 'PLANNING') {
          // Moving to a planning sprint, reset subtasks to BACKLOG
          subtaskUpdate.status = 'BACKLOG'
        }
        await tx.issue.updateMany({
          where: {
            parentIssueId: issue.id,
            deletedAt: null,
            status: { not: 'DONE' },
          },
          data: subtaskUpdate,
        })
      }

      // ── Process child actions (close / move to backlog) — batched ─────────
      if (parsedChildActions && parsedChildActions.length > 0) {
        const closeIds = parsedChildActions.filter((ca) => ca.action === "close").map((ca) => ca.issueId)
        const backlogIds = parsedChildActions.filter((ca) => ca.action === "backlog").map((ca) => ca.issueId)

        if (closeIds.length > 0) {
          await tx.issue.updateMany({
            where: { id: { in: closeIds } },
            data: { status: "DONE" },
          })
        }
        if (backlogIds.length > 0) {
          await tx.issue.updateMany({
            where: { id: { in: backlogIds } },
            data: { status: "BACKLOG", sprintId: null },
          })
        }
      }

      return updated
    })

    // Create notification if assignee changed
    if (updateData.assigneeId && updateData.assigneeId !== oldAssigneeId) {
      await createNotification(prisma, {
        userId: updateData.assigneeId,
        type: "ISSUE_ASSIGNED",
        message: `You have been assigned to issue ${issue.displayId}: ${issue.title}`,
        issueId: issue.id,
      })
    }

    // Invalidate server-side caches so list views and detail reflect the change
    invalidatePrefix(`issue:${issue.id}`)
    invalidatePrefix(`issue:${issue.displayId}`)
    invalidatePrefix('issues:')
    invalidatePrefix('board:')
    invalidatePrefix('sprint-overview')

    return NextResponse.json(updatedIssue)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("PATCH /api/issues/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to update issue" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find issue by id or displayId in a single query
    const issue = await prisma.issue.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: params.id }, { displayId: params.id }],
      },
    })

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    // Soft delete - set deletedAt
    const now = new Date()

    // Update issue with deletedAt
    const deletedIssue = await prisma.issue.update({
      where: { id: issue.id },
      data: { deletedAt: now },
    })

    // Invalidate server-side caches
    invalidatePrefix(`issue:${issue.id}`)
    invalidatePrefix(`issue:${issue.displayId}`)
    invalidatePrefix('issues:')
    invalidatePrefix('board:')
    invalidatePrefix('sprint-overview')

    return NextResponse.json(deletedIssue)
  } catch (error) {
    console.error("DELETE /api/issues/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete issue" }, { status: 500 })
  }
}
