export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSprintSchema } from "@/lib/validations/sprint"
import { z } from "zod"
import { Prisma } from "@prisma/client"

const VALID_STATUSES = ["PLANNING", "ACTIVE", "COMPLETED"] as const
type SprintStatus = (typeof VALID_STATUSES)[number]

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status")

    // Validate status enum before sending to Prisma (avoids invalid enum errors)
    if (statusParam && !VALID_STATUSES.includes(statusParam as SprintStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      )
    }

    const where: Prisma.SprintWhereInput = statusParam
      ? { status: statusParam as SprintStatus }
      : {}

    const summary = searchParams.get("summary") === "true"

    if (summary) {
      // Lightweight response: sprint metadata + issue count only
      const sprints = await prisma.sprint.findMany({
        where,
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
          _count: { select: { issues: { where: { deletedAt: null } } } },
        },
      })
      return NextResponse.json(sprints)
    }

    const sprints = await prisma.sprint.findMany({
      where,
      orderBy: { startDate: "desc" },
      include: {
        issues: {
          where: { deletedAt: null },
        },
      },
    })

    return NextResponse.json(sprints)
  } catch (error) {
    console.error("GET /api/sprints error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch sprints",
        ...(process.env.NODE_ENV === "development" && {
          debug: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined,
        }),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { name, startDate, endDate } = createSprintSchema.parse(body)

    const sprint = await prisma.sprint.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "PLANNING",
      },
      include: {
        issues: true,
      },
    })

    return NextResponse.json(sprint, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("POST /api/sprints error:", error)
    return NextResponse.json(
      {
        error: "Failed to create sprint",
        ...(process.env.NODE_ENV === "development" && {
          debug: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined,
        }),
      },
      { status: 500 }
    )
  }
}
