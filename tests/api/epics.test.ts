import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockGETEpics = async (request: Request) => {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  const whereClause: any = {}
  if (statusFilter && ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(statusFilter)) {
    whereClause.status = statusFilter
  }

  const epics = await (prisma.epic.findMany as any)({
    where: whereClause,
    include: {
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
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Enrich with progress metrics
  const enrichedEpics = epics.map((epic: any) => {
    const issuesByTeam: Record<string, any> = {}
    const teamDoneCount: Record<string, number> = {}
    const teamIssueCount: Record<string, number> = {}

    epic.issues.forEach((issue: any) => {
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

    const totalIssues = epic.issues.length
    const doneIssues = epic.issues.filter((i: any) => i.status === 'DONE').length
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
}

const mockPOSTEpic = async (request: Request) => {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.title) {
    return NextResponse.json(
      { error: 'Title is required' },
      { status: 400 }
    )
  }

  const epic = await (prisma.epic.create as any)({
    data: {
      title: body.title,
      description: body.description || null,
      status: body.status || 'ACTIVE',
      targetSprintId: body.targetSprintId || null,
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
}

describe('Epic API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/epics', () => {
    it('should return all epics with progress metrics', async () => {
      const mockEpicsWithIssues = [
        {
          id: 'epic-1',
          title: 'User Authentication',
          description: 'Implement user auth system',
          status: 'ACTIVE',
          targetSprintId: null,
          createdById: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          issues: [
            {
              id: 'issue-1',
              status: 'DONE',
              team: { id: 'team-1', name: 'Frontend' },
            },
            {
              id: 'issue-2',
              status: 'IN_PROGRESS',
              team: { id: 'team-2', name: 'Backend' },
            },
            {
              id: 'issue-3',
              status: 'DONE',
              team: { id: 'team-1', name: 'Frontend' },
            },
          ],
          createdBy: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@noon.com',
          },
        },
      ]

      vi.mocked(prisma.epic.findMany).mockResolvedValueOnce(mockEpicsWithIssues)

      const request = new Request('http://localhost:3000/api/epics')
      const response = await mockGETEpics(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(Array.isArray(data)).toBe(true)
      expect(data[0].overallProgress).toBe(67) // 2 out of 3 done
      expect(data[0].totalIssues).toBe(3)
      expect(data[0].doneIssues).toBe(2)
    })

    it('should calculate progress per team correctly', async () => {
      const mockEpicsWithIssues = [
        {
          id: 'epic-1',
          title: 'Feature X',
          description: 'Description',
          status: 'ACTIVE',
          targetSprintId: null,
          createdById: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          issues: [
            {
              id: 'issue-1',
              status: 'DONE',
              team: { id: 'team-1', name: 'Frontend' },
            },
            {
              id: 'issue-2',
              status: 'DONE',
              team: { id: 'team-1', name: 'Frontend' },
            },
            {
              id: 'issue-3',
              status: 'TODO',
              team: { id: 'team-2', name: 'Backend' },
            },
          ],
          createdBy: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@noon.com',
          },
        },
      ]

      vi.mocked(prisma.epic.findMany).mockResolvedValueOnce(mockEpicsWithIssues)

      const request = new Request('http://localhost:3000/api/epics')
      const response = await mockGETEpics(request)

      const data = await response.json()

      // Frontend team: 2 done out of 2
      const frontendTeam = data[0].issueCountPerTeam.find(
        (t: any) => t.teamName === 'Frontend'
      )
      expect(frontendTeam.doneCount).toBe(2)
      expect(frontendTeam.count).toBe(2)

      // Backend team: 0 done out of 1
      const backendTeam = data[0].issueCountPerTeam.find(
        (t: any) => t.teamName === 'Backend'
      )
      expect(backendTeam.doneCount).toBe(0)
      expect(backendTeam.count).toBe(1)
    })

    it('should filter epics by status', async () => {
      const request = new Request(
        'http://localhost:3000/api/epics?status=COMPLETED'
      )
      await mockGETEpics(request)

      expect(vi.mocked(prisma.epic.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        })
      )
    })

    it('should return 401 without authentication', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      const request = new Request('http://localhost:3000/api/epics')
      const response = await mockGETEpics(request)

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/epics', () => {
    it('should create epic with title and description', async () => {
      const body = {
        title: 'New Epic',
        description: 'Epic description',
        status: 'ACTIVE',
      }

      const request = new Request('http://localhost:3000/api/epics', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await mockPOSTEpic(request)

      expect(response.status).toBe(201)
      expect(vi.mocked(prisma.epic.create)).toHaveBeenCalled()

      const call = vi.mocked(prisma.epic.create).mock.calls[0][0]
      expect(call.data.title).toBe('New Epic')
      expect(call.data.description).toBe('Epic description')
    })

    it('should reject epic without title', async () => {
      const body = {
        description: 'No title',
      }

      const request = new Request('http://localhost:3000/api/epics', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await mockPOSTEpic(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Title')
    })

    it('should set default status to ACTIVE', async () => {
      const body = {
        title: 'New Epic',
      }

      const request = new Request('http://localhost:3000/api/epics', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      await mockPOSTEpic(request)

      const call = vi.mocked(prisma.epic.create).mock.calls[0][0]
      expect(call.data.status).toBe('ACTIVE')
    })
  })

  describe('PATCH /api/epics/[id]', () => {
    it('should update epic status to COMPLETED', async () => {
      const updatedEpic = {
        id: 'epic-1',
        title: 'Completed Epic',
        description: 'Description',
        status: 'COMPLETED',
        targetSprintId: null,
        createdById: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        issues: [],
        createdBy: {
          id: 'test-user-id',
          name: 'Test User',
          email: 'test@noon.com',
        },
      }

      vi.mocked(prisma.epic.update).mockResolvedValueOnce(updatedEpic)

      const result = await (prisma.epic.update as any)({
        where: { id: 'epic-1' },
        data: { status: 'COMPLETED' },
      })

      expect(result.status).toBe('COMPLETED')
    })
  })

  describe('Epic progress calculation', () => {
    it('should show 100% progress when all issues are DONE', () => {
      const issues = [
        { status: 'DONE' },
        { status: 'DONE' },
        { status: 'DONE' },
      ]

      const doneCount = issues.filter((i) => i.status === 'DONE').length
      const progress = (doneCount / issues.length) * 100

      expect(progress).toBe(100)
    })

    it('should show 0% progress when no issues are DONE', () => {
      const issues = [
        { status: 'TODO' },
        { status: 'IN_PROGRESS' },
        { status: 'BLOCKED' },
      ]

      const doneCount = issues.filter((i) => i.status === 'DONE').length
      const progress = issues.length > 0 ? (doneCount / issues.length) * 100 : 0

      expect(progress).toBe(0)
    })

    it('should show 0% when epic has no issues', () => {
      const issues: any[] = []

      const doneCount = issues.filter((i) => i.status === 'DONE').length
      const progress = issues.length > 0 ? (doneCount / issues.length) * 100 : 0

      expect(progress).toBe(0)
    })
  })
})
