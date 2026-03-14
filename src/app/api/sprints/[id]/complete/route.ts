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

    // Validate all actions before executing to fail fast
    for (const action of issueActions) {
      if (action.action === "next_sprint" && !action.targetSprintId) {
        return NextResponse.json(
          { error: "targetSprintId required for next_sprint action" },
          { status: 400 }
        )
      }
      if (action.action === "next_sprint" && action.targetSprintId) {
        const targetSprint = await prisma.sprint.findUnique({
          where: { id: action.targetSprintId },
        })
        if (!targetSprint) {
          return NextResponse.json(
            { error: `Target sprint ${action.targetSprintId} not found` },
            { status: 404 }
          )
        }
      }
    }

    // Execute all issue moves + sprint status change in a single transaction
    // so it's all-or-nothing — no partial state on failure.
    const completedSprint = await prisma.$transaction(async (tx) => {
      for (const action of issueActions) {
        const issue = incompleteIssues.find((i) => i.id === action.issueId)
        if (!issue) continue

        if (action.action === "backlog") {
          await tx.issue.update({
            where: { id: issue.id },
            data: { sprintId: null, status: "BACKLOG" },
          })
          // Cascade: move incomplete subtasks to backlog too
          await tx.issue.updateMany({
            where: { parentIssueId: issue.id, deletedAt: null, status: { not: "DONE" } },
            data: { sprintId: null, status: "BACKLOG" },
          })
        } else if (action.action === "next_sprint") {
          await tx.issue.update({
            where: { id: issue.id },
            data: { sprintId: action.targetSprintId! },
          })
          // Cascade: move incomplete subtasks to next sprint too
          await tx.issue.updateMany({
            where: { parentIssueId: issue.id, deletedAt: null, status: { not: "DONE" } },
            data: { sprintId: action.targetSprintId! },
          })
        }
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
