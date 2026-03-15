export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateDesignItemSchema } from "@/lib/validations/designItem"
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

    const item = await prisma.designItem.findUnique({
      where: { id: params.id },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        visualDesigner: { select: { id: true, name: true, email: true, image: true } },
        team: { select: { id: true, name: true, prefix: true, color: true } },
        promotedTo: { select: { id: true, displayId: true, title: true, status: true } },
        todos: { orderBy: { order: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!item) {
      return NextResponse.json({ error: "Design item not found" }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error("GET /api/design-items/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to fetch design item" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = updateDesignItemSchema.parse(body)

    const item = await prisma.designItem.findUnique({
      where: { id: params.id },
    })

    if (!item) {
      return NextResponse.json({ error: "Design item not found" }, { status: 404 })
    }

    // Build update payload, handling nullable fields
    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.figmaLink !== undefined) updateData.figmaLink = data.figmaLink
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId
    if (data.visualDesignerId !== undefined) updateData.visualDesignerId = data.visualDesignerId
    if (data.teamId !== undefined) updateData.teamId = data.teamId
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null
    }

    const updated = await prisma.designItem.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        visualDesigner: { select: { id: true, name: true, email: true, image: true } },
        team: { select: { id: true, name: true, prefix: true, color: true } },
        promotedTo: { select: { id: true, displayId: true, title: true, status: true } },
        todos: { orderBy: { order: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("PATCH /api/design-items/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to update design item" },
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

    const item = await prisma.designItem.findUnique({
      where: { id: params.id },
    })

    if (!item) {
      return NextResponse.json({ error: "Design item not found" }, { status: 404 })
    }

    await prisma.designItem.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/design-items/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to delete design item" },
      { status: 500 }
    )
  }
}
