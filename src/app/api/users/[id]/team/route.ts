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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only the user themselves or an admin can change a user's team
    const callerId = (session.user as any).id
    const callerRole = (session.user as any).role
    if (callerId !== params.id && callerRole !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { teamId } = schema.parse(body)

    // Verify team exists
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
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
