export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateDesignTodoSchema } from "@/lib/validations/designTodo"
import { z } from "zod"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; todoId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = updateDesignTodoSchema.parse(body)

    const todo = await prisma.designTodo.findUnique({
      where: { id: params.todoId },
    })

    if (!todo || todo.designItemId !== params.id) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    const updated = await prisma.designTodo.update({
      where: { id: params.todoId },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("PATCH /api/design-items/[id]/todos/[todoId] error:", error)
    return NextResponse.json(
      { error: "Failed to update todo" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; todoId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const todo = await prisma.designTodo.findUnique({
      where: { id: params.todoId },
    })

    if (!todo || todo.designItemId !== params.id) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    await prisma.designTodo.delete({ where: { id: params.todoId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/design-items/[id]/todos/[todoId] error:", error)
    return NextResponse.json(
      { error: "Failed to delete todo" },
      { status: 500 }
    )
  }
}
