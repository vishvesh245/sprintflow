export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateSprintSchema } from "@/lib/validations/sprint"
import { invalidatePrefix } from "@/lib/cache"
import { z } from "zod"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sprint = await prisma.sprint.findUnique({
      where: { id: params.id },
      include: {
        issues: {
          where: { deletedAt: null },
          include: {
            team: true,
            assignee: true,
          },
        },
      },
    })

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    return NextResponse.json(sprint)
  } catch (error) {
    console.error("GET /api/sprints/[id] error:", error)
    const body: Record<string, unknown> = { error: "Failed to fetch sprint" }
    if (process.env.NODE_ENV === "development") {
      body.debug = error instanceof Error ? error.message : String(error)
      body.stack = error instanceof Error ? (error.stack ?? "").split("\n").slice(0, 4).join(" | ") : undefined
    }
    return NextResponse.json(body, { status: 500 })
  }
}

export async function PATCH(
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
    const updateData = updateSprintSchema.parse(body)

    const sprint = await prisma.sprint.findUnique({
      where: { id: params.id },
    })

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    // If changing to ACTIVE status, check no other sprint is active
    if (updateData.status === "ACTIVE" && sprint.status !== "ACTIVE") {
      const activeSprint = await prisma.sprint.findFirst({
        where: { status: "ACTIVE" },
      })

      if (activeSprint) {
        return NextResponse.json(
          { error: "Only one ACTIVE sprint is allowed at a time" },
          { status: 400 }
        )
      }
    }

    // Check for date overlap if dates are being updated
    if (updateData.startDate || updateData.endDate) {
      const newStartDate = updateData.startDate || sprint.startDate
      const newEndDate = updateData.endDate || sprint.endDate

      const overlappingSprints = await prisma.sprint.findMany({
        where: {
          id: { not: params.id },
          AND: [
            { startDate: { lt: newEndDate } },
            { endDate: { gt: newStartDate } },
          ],
        },
      })

      if (overlappingSprints.length > 0) {
        return NextResponse.json(
          { error: "Sprint dates overlap with existing sprints" },
          { status: 400 }
        )
      }
    }

    const updatedSprint = await prisma.sprint.update({
      where: { id: params.id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
        ...(updateData.endDate && { endDate: new Date(updateData.endDate) }),
        ...(updateData.status && { status: updateData.status }),
      },
      include: {
        issues: {
          where: { deletedAt: null },
          include: {
            team: true,
            assignee: true,
          },
        },
      },
    })

    // When a sprint is started (PLANNING → ACTIVE), auto-transition all its
    // BACKLOG issues to TODO so they're visible on the board.
    if (
      updateData.status === "ACTIVE" &&
      sprint.status !== "ACTIVE"
    ) {
      await prisma.issue.updateMany({
        where: {
          sprintId: params.id,
          status: "BACKLOG",
          deletedAt: null,
        },
        data: { status: "TODO" },
      })

      // Re-fetch so the response includes the updated issue statuses
      const refreshedSprint = await prisma.sprint.findUnique({
        where: { id: params.id },
        include: {
          issues: {
            where: { deletedAt: null },
            include: { team: true, assignee: true },
          },
        },
      })

      // Invalidate server-side cache so other requests get fresh data
      invalidatePrefix("board")
      invalidatePrefix("sprint")
      invalidatePrefix("issues")

      return NextResponse.json(refreshedSprint)
    }

    // Invalidate server-side cache after any sprint mutation
    invalidatePrefix("board")
    invalidatePrefix("sprint")

    return NextResponse.json(updatedSprint)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("PATCH /api/sprints/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to update sprint" },
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
    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
    }

    const sprint = await prisma.sprint.findUnique({
      where: { id: params.id },
      include: {
        issues: true,
      },
    })

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    // Only allow deletion if sprint is in PLANNING status and has no issues
    if (sprint.status !== "PLANNING") {
      return NextResponse.json(
        { error: "Can only delete sprints in PLANNING status" },
        { status: 400 }
      )
    }

    if (sprint.issues.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete sprint with assigned issues" },
        { status: 400 }
      )
    }

    await prisma.sprint.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/sprints/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to delete sprint" },
      { status: 500 }
    )
  }
}
