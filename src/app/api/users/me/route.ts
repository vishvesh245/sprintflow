export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        displayName: true,
        timezone: true,
        notifyOnAssign: true,
        notifyOnComment: true,
        teamId: true,
        image: true,
        team: { select: { id: true, name: true, prefix: true } },
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("GET /api/users/me error:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Only allow these fields to be updated by the user themselves
    const allowedFields = ['displayName', 'teamId', 'timezone', 'notifyOnAssign', 'notifyOnComment']
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        displayName: true,
        timezone: true,
        notifyOnAssign: true,
        notifyOnComment: true,
        teamId: true,
        image: true,
        team: { select: { id: true, name: true, prefix: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/users/me error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
