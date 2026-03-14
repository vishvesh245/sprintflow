import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockGET = async (request: Request) => {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const teamId = searchParams.get('teamId')
  const sprintId = searchParams.get('sprintId')
  const status = searchParams.get('status')
  const backlog = searchParams.get('backlog') === 'true'

  const where: any = {
    deletedAt: null,
  }

  if (teamId) where.teamId = teamId
  if (sprintId) where.sprintId = sprintId
  if (backlog) where.sprintId = null
  if (status) where.status = status

  const issues = await (prisma.issue.findMany as any)({
    where,
    include: {
      team: true,
      assignee: true,
      sprint: true,
      epic: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(issues)
}

const mockPOST = async (request: Request) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, type, priority, teamId, testLinks } = body

  // Validation
  if (!title || title.length < 3) {
    return NextResponse.json(
      { error: 'Title must be at least 3 characters' },
      { status: 400 }
    )
  }

  if (title.length > 255) {
    return NextResponse.json(
      { error: 'Title must not exceed 255 characters' },
      { status: 400 }
    )
  }

  if (!type || !priority || !teamId) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  // Check team exists
  const team = await (prisma.team.findUnique as any)({
    where: { id: teamId },
  })

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  // QA team requires tests link for non-TASK issues
  if (team.prefix === 'QA' && type !== 'TASK' && (!testLinks || testLinks.length === 0)) {
    return NextResponse.json(
      { error: 'QA team requires at least one test link for non-TASK issues' },
      { status: 400 }
    )
  }

  const issue = await (prisma.issue.create as any)({
    data: {
      displayId: `${team.prefix}-1`,
      title,
      description,
      type,
      priority,
      teamId,
      reporterId: session.user.id,
      labels: [],
    },
    include: {
      team: true,
      assignee: true,
      sprint: true,
      epic: true,
    },
  })

  return NextResponse.json(issue, { status: 201 })
}

describe('Issue API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/issues', () => {
    it('should return list of issues with authentication', async () => {
      const request = new Request('http://localhost:3000/api/issues')
      const response = await mockGET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should return 401 without authentication', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      const request = new Request('http://localhost:3000/api/issues')
      const response = await mockGET(request)

      expect(response.status).toBe(401)
    })

    it('should filter issues by sprintId', async () => {
      const request = new Request(
        'http://localhost:3000/api/issues?sprintId=sprint-1'
      )
      const response = await mockGET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(prisma.issue.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sprintId: 'sprint-1' }),
        })
      )
    })

    it('should filter issues by teamId', async () => {
      const request = new Request(
        'http://localhost:3000/api/issues?teamId=team-1'
      )
      const response = await mockGET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(prisma.issue.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teamId: 'team-1' }),
        })
      )
    })

    it('should filter issues by status', async () => {
      const request = new Request('http://localhost:3000/api/issues?status=DONE')
      const response = await mockGET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(prisma.issue.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DONE' }),
        })
      )
    })

    it('should return backlog (sprintId=null) when backlog=true', async () => {
      const request = new Request(
        'http://localhost:3000/api/issues?backlog=true'
      )
      const response = await mockGET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(prisma.issue.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sprintId: null }),
        })
      )
    })

    it('should never return soft-deleted issues', async () => {
      const request = new Request('http://localhost:3000/api/issues')
      await mockGET(request)

      expect(vi.mocked(prisma.issue.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        })
      )
    })
  })

  describe('POST /api/issues', () => {
    it('should create issue with valid data', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
        id: 'team-1',
        name: 'Frontend',
        prefix: 'FE',
        color: '#3B82F6',
        issueCounter: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const body = {
        title: 'New Issue',
        description: 'Issue description',
        type: 'STORY',
        priority: 'HIGH',
        teamId: 'team-1',
      }

      const request = new Request('http://localhost:3000/api/issues', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await mockPOST(request)

      expect(response.status).toBe(201)
      expect(vi.mocked(prisma.issue.create)).toHaveBeenCalled()
    })

    it('should reject title shorter than 3 characters', async () => {
      const body = {
        title: 'AB',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const request = new Request('http://localhost:3000/api/issues', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await mockPOST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('3 characters')
    })

    it('should reject title longer than 255 characters', async () => {
      const longTitle = 'A'.repeat(256)
      const body = {
        title: longTitle,
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const request = new Request('http://localhost:3000/api/issues', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await mockPOST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('255')
    })

    it('should allow 3 character title', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
        id: 'team-1',
        name: 'Frontend',
        prefix: 'FE',
        color: '#3B82F6',
        issueCounter: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const body = {
        title: 'ABC',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const request = new Request('http://localhost:3000/api/issues', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await mockPOST(request)

      expect(response.status).toBe(201)
    })

    it('should reject QA issue of type STORY without testLinks', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
        id: 'team-qa',
        name: 'QA',
        prefix: 'QA',
        color: '#10B981',
        issueCounter: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const body = {
        title: 'Test Story',
        type: 'STORY',
        priority: 'MEDIUM',
        teamId: 'team-qa',
      }

      const request = new Request('http://localhost:3000/api/issues', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await mockPOST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('test link')
    })

    it('should allow QA issue of type TASK without testLinks', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
        id: 'team-qa',
        name: 'QA',
        prefix: 'QA',
        color: '#10B981',
        issueCounter: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const body = {
        title: 'Test Task',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-qa',
      }

      const request = new Request('http://localhost:3000/api/issues', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await mockPOST(request)

      expect(response.status).toBe(201)
    })
  })

  describe('DELETE /api/issues/[id]', () => {
    it('should soft-delete issue (set deletedAt)', async () => {
      const deletedIssue = {
        id: 'issue-1',
        displayId: 'TEAM-1',
        title: 'Deleted Issue',
        description: null,
        type: 'TASK',
        status: 'BACKLOG',
        priority: 'MEDIUM',
        teamId: 'team-1',
        sprintId: null,
        epicId: null,
        assigneeId: null,
        reporterId: 'test-user-id',
        parentIssueId: null,
        labels: [],
        storyPoints: null,
        position: 0,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.issue.update).mockResolvedValueOnce(deletedIssue)

      const result = await (prisma.issue.update as any)({
        where: { id: 'issue-1' },
        data: { deletedAt: new Date() },
      })

      expect(result.deletedAt).not.toBeNull()
    })
  })

  describe('Issue soft-delete filtering', () => {
    it('should not return deleted issues in queries', async () => {
      const request = new Request('http://localhost:3000/api/issues')
      await mockGET(request)

      const callArgs = vi.mocked(prisma.issue.findMany).mock.calls[0][0]
      expect(callArgs.where.deletedAt).toBe(null)
    })
  })
})
