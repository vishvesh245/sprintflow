export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cached } from "@/lib/cache"

/**
 * Combined sprint overview endpoint — returns active sprint + planning sprints
 * + issues for the active sprint in one round-trip.
 * Eliminates the waterfall: useSprints('ACTIVE') → wait → useQuery(issues).
 *
 * GET /api/sprint-overview
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await cached('sprint-overview', 30_000, async () => {
      // Run both queries in parallel
      const [activeSprints, planningSprints] = await Promise.all([
        prisma.sprint.findMany({
          where: { status: "ACTIVE" },
          orderBy: { startDate: "desc" },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        }),
        prisma.sprint.findMany({
          where: { status: "PLANNING" },
          orderBy: { startDate: "desc" },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        }),
      ])

      const activeSprint = activeSprints[0] ?? null

      // Fetch issues only if there's an active sprint
      const issues = activeSprint
        ? await prisma.issue.findMany({
            where: {
              sprintId: activeSprint.id,
              deletedAt: null,
            },
            include: {
              team: { select: { id: true, name: true, prefix: true, color: true } },
              assignee: { select: { id: true, name: true, email: true, image: true } },
              sprint: { select: { id: true, name: true, status: true } },
              epic: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : []

      return { activeSprint, planningSprints, issues }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("GET /api/sprint-overview error:", error)
    return NextResponse.json(
      { error: "Failed to fetch sprint overview" },
      { status: 500 }
    )
  }
}
