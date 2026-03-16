import { vi } from 'vitest'

// Set test environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/sprintflow_test'
process.env.AUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
;(process.env as Record<string, string>).NODE_ENV = 'test'

// Mock next-auth
vi.mock('next-auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: {
        id: 'test-user-id',
        email: 'test@demo.com',
        name: 'Test User',
      },
    })
  ),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: {
        id: 'test-user-id',
        email: 'test@demo.com',
        name: 'Test User',
      },
    })
  ),
}))

// Mock Prisma client with realistic test data
vi.mock('@/lib/prisma', () => {
  const createMockPrismaClient = () => {
    const mockSprint = {
      id: 'sprint-1',
      name: 'Sprint 1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-14'),
      status: 'PLANNING',
      createdAt: new Date(),
      updatedAt: new Date(),
      issues: [],
    }

    const mockIssue = {
      id: 'issue-1',
      displayId: 'TEAM-1',
      title: 'Test Issue',
      description: 'Test Description',
      type: 'STORY',
      status: 'BACKLOG',
      priority: 'MEDIUM',
      teamId: 'team-1',
      sprintId: null,
      epicId: null,
      assigneeId: null,
      reporterId: 'test-user-id',
      parentIssueId: null,
      labels: [],
      storyPoints: 5,
      position: 0,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      team: {
        id: 'team-1',
        name: 'Frontend',
        prefix: 'FE',
        color: '#3B82F6',
        issueCounter: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      assignee: null,
      sprint: null,
      epic: null,
    }

    const mockTeam = {
      id: 'team-1',
      name: 'Frontend',
      prefix: 'FE',
      color: '#3B82F6',
      issueCounter: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockEpic = {
      id: 'epic-1',
      title: 'Test Epic',
      description: 'Test Epic Description',
      status: 'ACTIVE',
      targetSprintId: null,
      createdById: 'test-user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      issues: [],
      createdBy: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@demo.com',
      },
    }

    return {
      sprint: {
        findMany: vi.fn(() => Promise.resolve([mockSprint])),
        findUnique: vi.fn(() => Promise.resolve(mockSprint)),
        findFirst: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(() => Promise.resolve(mockSprint)),
        update: vi.fn(() => Promise.resolve(mockSprint)),
        delete: vi.fn(() => Promise.resolve(mockSprint)),
      },
      issue: {
        findMany: vi.fn(() => Promise.resolve([mockIssue])),
        findUnique: vi.fn(() => Promise.resolve(mockIssue)),
        findFirst: vi.fn(() => Promise.resolve(mockIssue)),
        create: vi.fn(() => Promise.resolve(mockIssue)),
        update: vi.fn(() => Promise.resolve(mockIssue)),
        delete: vi.fn(() => Promise.resolve(mockIssue)),
      },
      team: {
        findMany: vi.fn(() => Promise.resolve([mockTeam])),
        findUnique: vi.fn(() => Promise.resolve(mockTeam)),
        create: vi.fn(() => Promise.resolve(mockTeam)),
        update: vi.fn(() => Promise.resolve(mockTeam)),
      },
      epic: {
        findMany: vi.fn(() => Promise.resolve([mockEpic])),
        findUnique: vi.fn(() => Promise.resolve(mockEpic)),
        create: vi.fn(() => Promise.resolve(mockEpic)),
        update: vi.fn(() => Promise.resolve(mockEpic)),
      },
      issueLink: {
        create: vi.fn(() =>
          Promise.resolve({
            id: 'link-1',
            sourceIssueId: 'issue-1',
            targetIssueId: 'issue-2',
            linkType: 'BLOCKS',
            createdAt: new Date(),
          })
        ),
        findMany: vi.fn(() => Promise.resolve([])),
        findUnique: vi.fn(() => Promise.resolve(null)),
        delete: vi.fn(() => Promise.resolve({})),
      },
      notification: {
        create: vi.fn(() =>
          Promise.resolve({
            id: 'notif-1',
            userId: 'user-1',
            type: 'ISSUE_ASSIGNED',
            message: 'Test notification',
            issueId: 'issue-1',
            read: false,
            createdAt: new Date(),
          })
        ),
      },
    }
  }

  return {
    prisma: createMockPrismaClient(),
  }
})
