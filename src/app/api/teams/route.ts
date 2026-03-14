export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cached } from "@/lib/cache"
import { z } from "zod"

const updateTeamSchema = z.object({
  teamId: z.string(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const teamsWithMemberCount = await cached('teams', 5 * 60_000, async () => {
      const teams = await prisma.team.findMany({
        include: {
          _count: {
            select: { members: true },
          },
        },
        orderBy: { name: "asc" },
      })

      return teams.map((team) => ({
        id: team.id,
        name: team.name,
        prefix: team.prefix,
        color: team.color,
        memberCount: team._count.members,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      }))
    })

    return NextResponse.json(teamsWithMemberCount)
  } catch (error) {
    console.error("GET /api/teams error:", error)
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { teamId } = updateTeamSchema.parse(body)

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Update user's team
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { teamId },
      include: { team: true },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("PATCH /api/teams error:", error)
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    )
  }
}
