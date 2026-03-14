export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cached } from "@/lib/cache"

/**
 * Combined board endpoint — returns active sprint + its issues in one round-trip.
 * Eliminates the waterfall: useCurrentSprint → wait → useIssues.
 *
 * GET /api/board?teamId=optional
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const cacheKey = `board:${teamId || 'ALL'}`

    const data = await cached(cacheKey, 30_000, async () => {
      // 1. Find the active sprint
      const sprint = await prisma.sprint.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      })

      if (!sprint) {
        return { sprint: null, issues: [] }
      }

      // 2. Fetch issues for this sprint (with lean selects)
      const where: any = {
        sprintId: sprint.id,
        deletedAt: null,
      }
      if (teamId) where.teamId = teamId

      const issues = await prisma.issue.findMany({
        where,
        include: {
          team: { select: { id: true, name: true, prefix: true, color: true } },
          assignee: { select: { id: true, name: true, email: true, image: true } },
          sprint: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      return { sprint, issues }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("GET /api/board error:", error)
    return NextResponse.json(
      { error: "Failed to fetch board data" },
      { status: 500 }
    )
  }
}
