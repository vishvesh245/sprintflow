import { vi } from 'vitest'

/**
 * Test data factory functions for creating consistent test objects
 */

export const createMockUser = (overrides?: any) => ({
  id: 'test-user-id',
  email: 'test@demo.com',
  name: 'Test User',
  ...overrides,
})

export const createMockTeam = (overrides?: any) => ({
  id: 'team-1',
  name: 'Frontend',
  prefix: 'FE',
  color: '#3B82F6',
  issueCounter: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockSprint = (overrides?: any) => {
  const now = new Date()
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  return {
    id: 'sprint-1',
    name: 'Sprint 1',
    startDate: now,
    endDate: twoWeeksLater,
    status: 'PLANNING',
    createdAt: new Date(),
    updatedAt: new Date(),
    issues: [],
    ...overrides,
  }
}

export const createMockIssue = (overrides?: any) => ({
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
  ...overrides,
})

export const createMockEpic = (overrides?: any) => ({
  id: 'epic-1',
  title: 'Test Epic',
  description: 'Test Epic Description',
  status: 'ACTIVE',
  targetSprintId: null,
  createdById: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  issues: [],
  createdBy: createMockUser(),
  ...overrides,
})

export const createMockIssueLink = (overrides?: any) => ({
  id: 'link-1',
  sourceIssueId: 'issue-1',
  targetIssueId: 'issue-2',
  linkType: 'BLOCKS',
  createdAt: new Date(),
  ...overrides,
})

/**
 * Mock authentication helper
 */
export function mockAuth(user?: any) {
  const testUser = createMockUser(user)
  return Promise.resolve({
    user: testUser,
  })
}

export function mockAuthNull() {
  return Promise.resolve(null)
}

/**
 * Request builder helper
 */
export function createRequest(
  url: string,
  options?: {
    method?: string
    body?: any
    headers?: Record<string, string>
  }
) {
  const { method = 'GET', body, headers = {} } = options || {}

  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body && { body: JSON.stringify(body) }),
  })
}

/**
 * Validation test helper
 */
export function expectValidationError(
  result: any,
  expectedMessage?: string | RegExp
) {
  expect(result.success).toBe(false)
  if (expectedMessage) {
    const message = result.error?.issues[0]?.message || ''
    if (typeof expectedMessage === 'string') {
      expect(message).toContain(expectedMessage)
    } else {
      expect(message).toMatch(expectedMessage)
    }
  }
}

export function expectValidationSuccess(result: any, data?: any) {
  expect(result.success).toBe(true)
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      expect(result.data[key]).toEqual(value)
    })
  }
}

/**
 * Response parser helper
 */
export async function parseJsonResponse(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Mock Prisma helper
 */
export function createMockPrismaClient() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    epic: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issueLink: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
}

/**
 * Date helper functions
 */
export const dateHelpers = {
  today: () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  },
  tomorrow: () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(0, 0, 0, 0)
    return d
  },
  daysFromNow: (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(0, 0, 0, 0)
    return d
  },
  nextWeek: () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(0, 0, 0, 0)
    return d
  },
  nextMonth: () => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setHours(0, 0, 0, 0)
    return d
  },
}

/**
 * Assert helpers
 */
export function expectResponseStatus(response: Response, status: number | number[]) {
  const statusArray = Array.isArray(status) ? status : [status]
  expect(statusArray).toContain(response.status)
}

export function expectJsonResponse(response: Response, status?: number) {
  if (status) {
    expect(response.status).toBe(status)
  }
  expect(response.headers.get('content-type')).toContain('application/json')
}

/**
 * Test data generators
 */
export function generateIssues(count: number, overrides?: any) {
  return Array.from({ length: count }, (_, i) =>
    createMockIssue({
      id: `issue-${i}`,
      displayId: `TEAM-${i + 1}`,
      title: `Issue ${i + 1}`,
      ...overrides,
    })
  )
}

export function generateSprints(count: number, overrides?: any) {
  return Array.from({ length: count }, (_, i) => {
    const start = new Date()
    start.setDate(start.getDate() + i * 14)

    const end = new Date(start)
    end.setDate(end.getDate() + 14)

    return createMockSprint({
      id: `sprint-${i}`,
      name: `Sprint ${i + 1}`,
      startDate: start,
      endDate: end,
      ...overrides,
    })
  })
}

/**
 * Performance testing helpers
 */
export async function measureTime(fn: () => Promise<any>) {
  const start = performance.now()
  await fn()
  const end = performance.now()
  return end - start
}

export async function expectUnder(ms: number, fn: () => Promise<any>) {
  const duration = await measureTime(fn)
  expect(duration).toBeLessThan(ms)
}
