export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createDesignItemSchema } from "@/lib/validations/designItem"
import { z } from "zod"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const status = searchParams.get("status")
    const assigneeId = searchParams.get("assigneeId")

    const where: any = {}
    if (teamId) where.teamId = teamId
    if (status) where.status = status
    if (assigneeId) where.assigneeId = assigneeId

    const items = await prisma.designItem.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        visualDesigner: { select: { id: true, name: true, email: true, image: true } },
        team: { select: { id: true, name: true, prefix: true, color: true } },
        promotedTo: { select: { id: true, displayId: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error("GET /api/design-items error:", error)
    return NextResponse.json(
      { error: "Failed to fetch design items" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createDesignItemSchema.parse(body)

    // Verify team exists
    const team = await prisma.team.findUnique({ where: { id: data.teamId } })
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const item = await prisma.designItem.create({
      data: {
        title: data.title,
        description: data.description || undefined,
        priority: data.priority || undefined,
        figmaLink: data.figmaLink || undefined,
        assigneeId: data.assigneeId || undefined,
        visualDesignerId: data.visualDesignerId || undefined,
        teamId: data.teamId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        visualDesigner: { select: { id: true, name: true, email: true, image: true } },
        team: { select: { id: true, name: true, prefix: true, color: true } },
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("POST /api/design-items error:", error)
    return NextResponse.json(
      { error: "Failed to create design item" },
      { status: 500 }
    )
  }
}
