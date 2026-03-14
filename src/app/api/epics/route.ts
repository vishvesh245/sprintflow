export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EpicStatus } from '@prisma/client'
import { z } from 'zod'

const createEpicSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  targetSprintId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Build where clause
    const whereClause: any = {}
    if (statusFilter && ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(statusFilter)) {
      whereClause.status = statusFilter
    }

    // Fetch all epics with their non-deleted issues
    const epics = await prisma.epic.findMany({
      where: whereClause,
      include: {
        issues: {
          where: { deletedAt: null },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                prefix: true,
                color: true,
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
      orderBy: { createdAt: 'desc' },
    })

    // Transform data to include progress metrics
    const enrichedEpics = epics.map((epic) => {
      // Group issues by team
      const issuesByTeam: Record<string, any> = {}
      const teamDoneCount: Record<string, number> = {}
      const teamIssueCount: Record<string, number> = {}

      epic.issues.forEach((issue) => {
        const teamId = issue.team.id
        const teamName = issue.team.name

        if (!issuesByTeam[teamId]) {
          issuesByTeam[teamId] = {
            teamId,
            teamName,
            issues: [],
          }
        }

        issuesByTeam[teamId].issues.push(issue)

        if (!teamIssueCount[teamId]) {
          teamIssueCount[teamId] = 0
          teamDoneCount[teamId] = 0
        }

        teamIssueCount[teamId]++
        if (issue.status === 'DONE') {
          teamDoneCount[teamId]++
        }
      })

      // Calculate overall progress
      const totalIssues = epic.issues.length
      const doneIssues = epic.issues.filter(
        (i) => i.status === 'DONE'
      ).length
      const overallProgress = totalIssues > 0 ? (doneIssues / totalIssues) * 100 : 0

      return {
        ...epic,
        issueCountPerTeam: Object.values(issuesByTeam).map((team: any) => ({
          teamId: team.teamId,
          teamName: team.teamName,
          count: team.issues.length,
          doneCount: teamDoneCount[team.teamId] || 0,
        })),
        overallProgress: Math.round(overallProgress),
        totalIssues,
        doneIssues,
      }
    })

    return NextResponse.json(enrichedEpics)
  } catch (error) {
    console.error('Failed to fetch epics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch epics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    const body = await request.json()

    // Validate request body
    const validatedData = createEpicSchema.parse(body)

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

    // Create the epic
    const epic = await prisma.epic.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        status: (validatedData.status || 'ACTIVE') as EpicStatus,
        targetSprintId: validatedData.targetSprintId || null,
        createdById: session.user.id,
      },
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

    return NextResponse.json(epic, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Failed to create epic:', error)
    return NextResponse.json(
      { error: 'Failed to create epic' },
      { status: 500 }
    )
  }
}
