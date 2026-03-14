export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createDesignTodoSchema } from "@/lib/validations/designTodo"
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
      select: { id: true },
    })

    if (!item) {
      return NextResponse.json({ error: "Design item not found" }, { status: 404 })
    }

    const todos = await prisma.designTodo.findMany({
      where: { designItemId: params.id },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(todos)
  } catch (error) {
    console.error("GET /api/design-items/[id]/todos error:", error)
    return NextResponse.json(
      { error: "Failed to fetch todos" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createDesignTodoSchema.parse(body)

    const item = await prisma.designItem.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!item) {
      return NextResponse.json({ error: "Design item not found" }, { status: 404 })
    }

    const count = await prisma.designTodo.count({
      where: { designItemId: params.id },
    })

    const todo = await prisma.designTodo.create({
      data: {
        text: data.text,
        designItemId: params.id,
        order: count,
      },
    })

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("POST /api/design-items/[id]/todos error:", error)
    return NextResponse.json(
      { error: "Failed to create todo" },
      { status: 500 }
    )
  }
}
