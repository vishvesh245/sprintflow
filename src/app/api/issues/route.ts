export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cached, invalidatePrefix } from "@/lib/cache"
import { createIssueSchema } from "@/lib/validations/issue"
import { createNotification } from "@/lib/utils/notifications"
import { generateIssueId } from "@/lib/utils/issueId"
import { z } from "zod"


export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const sprintId = searchParams.get("sprintId")
    const status = searchParams.get("status")
    const assigneeId = searchParams.get("assigneeId")
    const priority = searchParams.get("priority")
    const type = searchParams.get("type")
    const search = searchParams.get("search")
    const backlog = searchParams.get("backlog") === "true"

    const where: any = {
      deletedAt: null,
    }

    if (teamId) where.teamId = teamId
    if (sprintId) where.sprintId = sprintId
    if (backlog) {
      // Backlog view: issues with no sprint + issues in PLANNING sprints
      where.OR = [
        { sprintId: null },
        { sprint: { status: "PLANNING" } },
      ]
    }
    if (status) where.status = status
    if (assigneeId) where.assigneeId = assigneeId
    if (priority) where.priority = priority
    if (type) where.type = type
    if (search) {
      where.title = {
        contains: search,
        mode: "insensitive",
      }
    }

    // Build a cache key from query params so different filters get separate cache entries
    const cacheKey = `issues:${JSON.stringify(where)}`

    const issues = await cached(cacheKey, 30_000, () =>
      prisma.issue.findMany({
        where,
        include: {
          team: { select: { id: true, name: true, prefix: true, color: true } },
          assignee: { select: { id: true, name: true, email: true, image: true } },
          sprint: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    )

    return NextResponse.json(issues)
  } catch (error) {
    console.error("GET /api/issues error:", error)
    return NextResponse.json(
      { error: "Failed to fetch issues" },
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
    const {
      title,
      description,
      type,
      priority,
      teamId,
      sprintId,
      assigneeId,
      labels,
      storyPoints,
      parentIssueId,
    } = createIssueSchema.parse(body)

    // Check if team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Generate displayId using atomic counter
    const displayId = await generateIssueId(teamId, prisma)

    // Auto-transition BACKLOG → TODO when creating directly into an ACTIVE sprint.
    // Issues in PLANNING sprints stay BACKLOG until the sprint is started.
    let initialStatus: "TODO" | undefined
    if (sprintId) {
      const targetSprint = await prisma.sprint.findUnique({
        where: { id: sprintId },
        select: { status: true },
      })
      if (targetSprint?.status === "ACTIVE") {
        initialStatus = "TODO"
      }
    }

    // Create the issue
    const issue = await prisma.issue.create({
      data: {
        displayId,
        title,
        description,
        type,
        priority,
        teamId,
        sprintId,
        assigneeId,
        reporterId: session.user.id,
        labels: labels || [],
        storyPoints,
        parentIssueId,
        ...(initialStatus && { status: initialStatus }),
      },
      include: {
        team: true,
        assignee: true,
        sprint: true,
      },
    })

    // Create notification for assignee if assigned
    if (assigneeId) {
      await createNotification(prisma, {
        userId: assigneeId,
        type: "ISSUE_ASSIGNED",
        message: `You have been assigned to issue ${displayId}: ${title}`,
        issueId: issue.id,
      })
    }

    // Invalidate caches so list views pick up the new issue
    invalidatePrefix('issues:')
    invalidatePrefix('board:')
    invalidatePrefix('sprint-overview')

    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("POST /api/issues error:", error)
    return NextResponse.json(
      { error: "Failed to create issue" },
      { status: 500 }
    )
  }
}
