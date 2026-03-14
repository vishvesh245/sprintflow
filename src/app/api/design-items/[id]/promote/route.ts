export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateIssueId } from "@/lib/utils/issueId"
import { invalidatePrefix } from "@/lib/cache"
import { z } from "zod"

const promoteSchema = z.object({
  targetTeamId: z.string(),
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional(),
  type: z.enum(["STORY", "TASK"]),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
})

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
    const data = promoteSchema.parse(body)

    // Fetch the design item
    const designItem = await prisma.designItem.findUnique({
      where: { id: params.id },
    })

    if (!designItem) {
      return NextResponse.json({ error: "Design item not found" }, { status: 404 })
    }

    if (designItem.promotedToIssueId) {
      return NextResponse.json(
        { error: "Design item has already been promoted" },
        { status: 400 }
      )
    }

    // Verify target team exists
    const targetTeam = await prisma.team.findUnique({
      where: { id: data.targetTeamId },
    })

    if (!targetTeam) {
      return NextResponse.json({ error: "Target team not found" }, { status: 404 })
    }

    // Build issue description, appending figma link if present
    let issueDescription = data.description ?? designItem.description ?? ""
    if (designItem.figmaLink) {
      issueDescription = issueDescription
        ? `${issueDescription}\n\nFigma: ${designItem.figmaLink}`
        : `Figma: ${designItem.figmaLink}`
    }

    // Generate display ID for the new issue
    const displayId = await generateIssueId(data.targetTeamId, prisma)

    // Create the engineering issue in the target team's backlog
    const issue = await prisma.issue.create({
      data: {
        displayId,
        title: data.title ?? designItem.title,
        description: issueDescription || undefined,
        type: data.type,
        priority: data.priority ?? designItem.priority ?? "MEDIUM",
        teamId: data.targetTeamId,
        reporterId: session.user.id,
        // No sprintId — goes to backlog
      },
      include: {
        team: true,
        assignee: true,
        sprint: true,
      },
    })

    // Update design item: mark as DONE and link to the new issue
    const updatedDesignItem = await prisma.designItem.update({
      where: { id: params.id },
      data: {
        status: "DONE",
        promotedToIssueId: issue.id,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        team: { select: { id: true, name: true, prefix: true, color: true } },
        promotedTo: { select: { id: true, displayId: true, title: true } },
      },
    })

    // Invalidate server-side cache so backlog/issues pages see the new issue
    invalidatePrefix("issues")
    invalidatePrefix("design")

    return NextResponse.json({
      designItem: updatedDesignItem,
      issue,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("POST /api/design-items/[id]/promote error:", error)
    return NextResponse.json(
      { error: "Failed to promote design item" },
      { status: 500 }
    )
  }
}
