export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EpicStatus } from '@prisma/client'
import { z } from 'zod'

const updateEpicSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  targetSprintId: z.string().optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const epicId = params.id

    // Fetch epic with all its non-deleted issues grouped by team
    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        issues: {
          where: { deletedAt: null },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                color: true,
                prefix: true,
              },
            },
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        targetSprint: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!epic) {
      return NextResponse.json({ error: 'Epic not found' }, { status: 404 })
    }

    // Group issues by team and calculate progress
    const issuesByTeam: Record<string, any> = {}

    epic.issues.forEach((issue) => {
      const teamId = issue.team.id

      if (!issuesByTeam[teamId]) {
        issuesByTeam[teamId] = {
          teamId,
          teamName: issue.team.name,
          teamColor: issue.team.color,
          teamPrefix: issue.team.prefix,
          issues: [],
          totalCount: 0,
          doneCount: 0,
          progress: 0,
        }
      }

      issuesByTeam[teamId].issues.push(issue)
      issuesByTeam[teamId].totalCount++

      if (issue.status === 'DONE') {
        issuesByTeam[teamId].doneCount++
      }
    })

    // Calculate per-team progress
    Object.values(issuesByTeam).forEach((team: any) => {
      team.progress = team.totalCount > 0 ? (team.doneCount / team.totalCount) * 100 : 0
      team.progress = Math.round(team.progress)
    })

    // Calculate overall progress
    const totalIssues = epic.issues.length
    const doneIssues = epic.issues.filter((i) => i.status === 'DONE').length
    const overallProgress = totalIssues > 0 ? (doneIssues / totalIssues) * 100 : 0

    return NextResponse.json({
      ...epic,
      issuesByTeam: Object.values(issuesByTeam),
      overallProgress: Math.round(overallProgress),
      totalIssues,
      doneIssues,
    })
  } catch (error) {
    console.error('Failed to fetch epic:', error)
    return NextResponse.json(
      { error: 'Failed to fetch epic' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    const epicId = params.id
    const body = await request.json()

    // Validate request body
    const validatedData = updateEpicSchema.parse(body)

    // Check if epic exists
    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
    })

    if (!epic) {
      return NextResponse.json({ error: 'Epic not found' }, { status: 404 })
    }

    // Verify target sprint exists if provided
    if (validatedData.targetSprintId) {
      const sprint = await prisma.sprint.findUnique({
        where: { id: validatedData.targetSprintId },
      })

      if (!sprint) {
        return NextResponse.json(
          { error: 'Target sprint not found' },
          { status: 404 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description
    }
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
    }
    if (validatedData.targetSprintId !== undefined) {
      updateData.targetSprintId = validatedData.targetSprintId
    }

    // Update the epic
    const updatedEpic = await prisma.epic.update({
      where: { id: epicId },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        targetSprint: {
          select: {
            id: true,
            name: true,
          },
        },
        issues: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedEpic)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Failed to update epic:', error)
    const body: Record<string, unknown> = { error: 'Failed to update epic' }
    if (process.env.NODE_ENV === 'development') {
      body.debug = error instanceof Error ? error.message : String(error)
      body.stack = error instanceof Error ? (error.stack ?? '').split('\n').slice(0, 4).join(' | ') : undefined
    }
    return NextResponse.json(body, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    const epicId = params.id

    // Check if epic exists and has no linked issues
    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        issues: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!epic) {
      return NextResponse.json({ error: 'Epic not found' }, { status: 404 })
    }

    if (epic.issues.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete epic with linked issues' },
        { status: 400 }
      )
    }

    // Delete the epic
    await prisma.epic.delete({
      where: { id: epicId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete epic:', error)
    return NextResponse.json(
      { error: 'Failed to delete epic' },
      { status: 500 }
    )
  }
}
