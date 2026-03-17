export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  teamId: z.string().min(1),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { teamId } = schema.parse(body)

    // Verify team exists
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Find the user by email (more reliable than ID matching in demo mode)
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Only allow updating own team, or admin updating anyone's
    if (dbUser.id !== params.id && dbUser.role !== 'ADMIN') {
      // In demo mode, allow if the session email matches the DB user
      // (ID mismatch can happen with Credentials provider)
      if (dbUser.id !== params.id) {
        // Just update by email instead
        const user = await prisma.user.update({
          where: { email: session.user.email },
          data: { teamId },
          select: { id: true, name: true, email: true, teamId: true },
        })
        return NextResponse.json(user)
      }
    }

    // Update user's team
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { teamId },
      select: { id: true, name: true, email: true, teamId: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Failed to update user team:", error)
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    )
  }
}
