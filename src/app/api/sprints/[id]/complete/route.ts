export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { completeSprintSchema } from "@/lib/validations/sprint"
import { invalidatePrefix } from "@/lib/cache"
import { z } from "zod"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { issueActions } = completeSprintSchema.parse(body)

    const sprint = await prisma.sprint.findUnique({
      where: { id: params.id },
      include: {
        issues: {
          where: { deletedAt: null },
          include: {
            team: true,
          },
        },
      },
    })

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    // Get all incomplete issues in the sprint
    const incompleteIssues = sprint.issues.filter((i) => i.status !== "DONE")

    // Track stats by team
    const teamStats: Record<
      string,
      { total: number; done: number; notDone: number }
    > = {}

    for (const issue of sprint.issues) {
      if (!teamStats[issue.teamId]) {
        teamStats[issue.teamId] = { total: 0, done: 0, notDone: 0 }
      }
      teamStats[issue.teamId].total++
      if (issue.status === "DONE") {
        teamStats[issue.teamId].done++
      } else {
        teamStats[issue.teamId].notDone++
      }
    }

    // ── Validate: one batched query instead of N sequential ones ────────
    for (const action of issueActions) {
      if (action.action === "next_sprint" && !action.targetSprintId) {
        return NextResponse.json(
          { error: "targetSprintId required for next_sprint action" },
          { status: 400 }
        )
      }
    }

    const targetSprintIds = [
      ...new Set(
        issueActions
          .filter((a) => a.action === "next_sprint" && a.targetSprintId)
          .map((a) => a.targetSprintId!)
      ),
    ]
    if (targetSprintIds.length > 0) {
      const found = await prisma.sprint.findMany({
        where: { id: { in: targetSprintIds } },
        select: { id: true },
      })
      const foundIds = new Set(found.map((s) => s.id))
      const missing = targetSprintIds.find((id) => !foundIds.has(id))
      if (missing) {
        return NextResponse.json(
          { error: `Target sprint ${missing} not found` },
          { status: 404 }
        )
      }
    }

    // ── Group actions by type for batched execution ──────────────────
    const incompleteIds = new Set(incompleteIssues.map((i) => i.id))

    const backlogIssueIds: string[] = []
    // Map of targetSprintId → issueIds moving there
    const nextSprintGroups = new Map<string, string[]>()

    for (const action of issueActions) {
      if (!incompleteIds.has(action.issueId)) continue
      if (action.action === "backlog") {
        backlogIssueIds.push(action.issueId)
      } else if (action.action === "next_sprint" && action.targetSprintId) {
        const group = nextSprintGroups.get(action.targetSprintId) ?? []
        group.push(action.issueId)
        nextSprintGroups.set(action.targetSprintId, group)
      }
    }

    // Execute all moves in a single transaction with batched updateMany calls
    // instead of looping individual updates — O(groups) queries, not O(issues).
    const completedSprint = await prisma.$transaction(async (tx) => {
      // Backlog: batch parent + subtask moves
      if (backlogIssueIds.length > 0) {
        await tx.issue.updateMany({
          where: { id: { in: backlogIssueIds } },
          data: { sprintId: null, status: "BACKLOG" },
        })
        await tx.issue.updateMany({
          where: { parentIssueId: { in: backlogIssueIds }, deletedAt: null, status: { not: "DONE" } },
          data: { sprintId: null, status: "BACKLOG" },
        })
      }

      // Next sprint: one batch per target sprint
      for (const [targetSprintId, issueIds] of nextSprintGroups) {
        await tx.issue.updateMany({
          where: { id: { in: issueIds } },
          data: { sprintId: targetSprintId },
        })
        await tx.issue.updateMany({
          where: { parentIssueId: { in: issueIds }, deletedAt: null, status: { not: "DONE" } },
          data: { sprintId: targetSprintId },
        })
      }

      return tx.sprint.update({
        where: { id: params.id },
        data: { status: "COMPLETED" },
        include: {
          issues: {
            where: { deletedAt: null },
            include: { team: true },
          },
        },
      })
    })

    // Prepare response with summary
    const response = {
      sprint: completedSprint,
      summary: {
        totalIssues: completedSprint.issues.length,
        doneCount: completedSprint.issues.filter((i) => i.status === "DONE")
          .length,
        notDoneCount: completedSprint.issues.filter((i) => i.status !== "DONE")
          .length,
        teamBreakdown: teamStats,
      },
    }

    // Invalidate server-side cache so board/sprint pages get fresh data
    invalidatePrefix("board")
    invalidatePrefix("sprint")
    invalidatePrefix("issues")

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("POST /api/sprints/[id]/complete error:", error)
    return NextResponse.json(
      { error: "Failed to complete sprint" },
      { status: 500 }
    )
  }
}
