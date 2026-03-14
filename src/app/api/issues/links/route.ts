export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createIssueLinkSchema = z.object({
  sourceIssueId: z.string().min(1, "sourceIssueId is required"),
  targetIssueId: z.string().min(1, "targetIssueId is required"),
  linkType: z.enum(["BLOCKS", "BLOCKED_BY", "RELATES_TO", "DUPLICATES", "TESTS", "TESTED_BY"]),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get("issueId")

    const where: any = {}
    if (issueId) {
      where.OR = [
        { sourceIssueId: issueId },
        { targetIssueId: issueId },
      ]
    }

    const links = await prisma.issueLink.findMany({
      where,
      include: {
        sourceIssue: {
          include: { team: { select: { id: true, name: true, prefix: true, color: true } } },
        },
        targetIssue: {
          include: { team: { select: { id: true, name: true, prefix: true, color: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(links)
  } catch (error) {
    console.error("GET /api/issues/links error:", error)
    return NextResponse.json({ error: "Failed to fetch issue links" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sourceIssueId, targetIssueId, linkType } = createIssueLinkSchema.parse(body)

    // Prevent self-linking
    if (sourceIssueId === targetIssueId) {
      return NextResponse.json(
        { error: "Cannot link an issue to itself" },
        { status: 400 }
      )
    }

    // Verify source issue exists
    const sourceIssue = await prisma.issue.findUnique({
      where: { id: sourceIssueId },
    })
    if (!sourceIssue) {
      return NextResponse.json({ error: "Source issue not found" }, { status: 404 })
    }

    // Verify target issue exists
    const targetIssue = await prisma.issue.findUnique({
      where: { id: targetIssueId },
    })
    if (!targetIssue) {
      return NextResponse.json({ error: "Target issue not found" }, { status: 404 })
    }

    // Check for duplicate link
    const existing = await prisma.issueLink.findFirst({
      where: { sourceIssueId, targetIssueId, linkType },
    })
    if (existing) {
      return NextResponse.json(
        { error: "This link already exists" },
        { status: 409 }
      )
    }

    const link = await prisma.issueLink.create({
      data: { sourceIssueId, targetIssueId, linkType },
      include: {
        sourceIssue: {
          include: { team: { select: { id: true, name: true, prefix: true, color: true } } },
        },
        targetIssue: {
          include: { team: { select: { id: true, name: true, prefix: true, color: true } } },
        },
      },
    })

    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    console.error("POST /api/issues/links error:", error)
    return NextResponse.json({ error: "Failed to create issue link" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get("id")

    if (!linkId) {
      return NextResponse.json({ error: "Link ID is required" }, { status: 400 })
    }

    const link = await prisma.issueLink.findUnique({ where: { id: linkId } })
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 })
    }

    await prisma.issueLink.delete({ where: { id: linkId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/issues/links error:", error)
    return NextResponse.json({ error: "Failed to delete issue link" }, { status: 500 })
  }
}
