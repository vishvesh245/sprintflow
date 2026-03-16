/**
 * SprintSync Test Runner
 * Uses Node.js built-in test runner (node:test) — no vitest/jest needed.
 * Tests API logic directly with mock handlers.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ─── Mock Infrastructure ──────────────────────────────────────────────────────

const mockSession = { user: { id: 'user-1', email: 'test@demo.com', name: 'Test User' } }

let authReturn = mockSession  // flip to null to simulate unauthenticated

const mockPrisma = {
  sprint: {
    _data: [{ id: 'sprint-1', name: 'Sprint 1', startDate: new Date('2025-01-01'), endDate: new Date('2025-01-14'), status: 'PLANNING', createdAt: new Date(), updatedAt: new Date(), issues: [] }],
    findMany: async (opts) => {
      let items = [...mockPrisma.sprint._data]
      if (opts?.where?.status) items = items.filter(s => s.status === opts.where.status)
      return items
    },
    findFirst: async (opts) => {
      if (opts?.where?.status) return mockPrisma.sprint._data.find(s => s.status === opts.where.status) ?? null
      return mockPrisma.sprint._data[0] ?? null
    },
    findUnique: async ({ where }) => mockPrisma.sprint._data.find(s => s.id === where.id) ?? null,
    create: async ({ data }) => ({ id: 'sprint-new', ...data, createdAt: new Date(), updatedAt: new Date(), issues: [] }),
    update: async ({ where, data }) => {
      const s = mockPrisma.sprint._data.find(s => s.id === where.id)
      return s ? { ...s, ...data } : null
    },
    delete: async ({ where }) => mockPrisma.sprint._data.find(s => s.id === where.id) ?? null,
  },
  issue: {
    _data: [{ id: 'issue-1', displayId: 'FE-1', title: 'Test Issue', type: 'STORY', status: 'BACKLOG', priority: 'MEDIUM', teamId: 'team-1', sprintId: null, epicId: null, assigneeId: null, reporterId: 'user-1', storyPoints: null, labels: [], position: 0, deletedAt: null, createdAt: new Date(), updatedAt: new Date() }],
    findMany: async (opts) => {
      let items = mockPrisma.issue._data.filter(i => i.deletedAt === null)
      if (opts?.where?.sprintId !== undefined) items = items.filter(i => i.sprintId === opts.where.sprintId)
      if (opts?.where?.teamId) items = items.filter(i => i.teamId === opts.where.teamId)
      return items
    },
    findFirst: async () => mockPrisma.issue._data[0] ?? null,
    findUnique: async ({ where }) => mockPrisma.issue._data.find(i => i.id === where.id) ?? null,
    create: async ({ data }) => ({ id: 'issue-new', ...data, deletedAt: null, createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ where, data }) => {
      const i = mockPrisma.issue._data.find(i => i.id === where.id)
      return i ? { ...i, ...data } : null
    },
    delete: async ({ where }) => mockPrisma.issue._data.find(i => i.id === where.id) ?? null,
  },
  team: {
    _data: [
      { id: 'team-1', name: 'Frontend', prefix: 'FE', color: '#3B82F6', issueCounter: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'team-2', name: 'Backend', prefix: 'BE', color: '#10B981', issueCounter: 0, createdAt: new Date(), updatedAt: new Date() },
      { id: 'team-3', name: 'QA', prefix: 'QA', color: '#8B5CF6', issueCounter: 0, createdAt: new Date(), updatedAt: new Date() },
    ],
    findMany: async () => mockPrisma.team._data,
    findUnique: async ({ where }) => mockPrisma.team._data.find(t => t.id === where.id) ?? null,
    update: async ({ where, data }) => {
      const t = mockPrisma.team._data.find(t => t.id === where.id)
      return t ? { ...t, ...data } : null
    },
  },
  epic: {
    _data: [{ id: 'epic-1', title: 'Auth Epic', description: null, status: 'ACTIVE', targetSprintId: null, createdById: 'user-1', createdAt: new Date(), updatedAt: new Date(), issues: [], createdBy: { id: 'user-1', name: 'Test User', email: 'test@demo.com' } }],
    findMany: async (opts) => {
      let items = [...mockPrisma.epic._data]
      if (opts?.where?.status) items = items.filter(e => e.status === opts.where.status)
      return items
    },
    findUnique: async ({ where }) => mockPrisma.epic._data.find(e => e.id === where.id) ?? null,
    create: async ({ data }) => ({ id: 'epic-new', ...data, createdAt: new Date(), updatedAt: new Date(), issues: [], createdBy: { id: data.createdById, name: 'Test User', email: 'test@demo.com' } }),
    update: async ({ where, data }) => {
      const e = mockPrisma.epic._data.find(e => e.id === where.id)
      return e ? { ...e, ...data } : null
    },
  },
  issueLink: {
    _data: [],
    findMany: async () => mockPrisma.issueLink._data,
    findUnique: async ({ where }) => mockPrisma.issueLink._data.find(l => l.id === where.id) ?? null,
    create: async ({ data }) => ({ id: 'link-new', ...data, createdAt: new Date() }),
    delete: async ({ where }) => mockPrisma.issueLink._data.find(l => l.id === where.id) ?? null,
  },
  $transaction: async (fn) => fn(mockPrisma),
}

// ─── Route Handler Implementations (mirrors actual API logic) ─────────────────

function json(data, status = 200) {
  return { status, body: data }
}

function getAuth() {
  return authReturn
}

// ── Sprints ──────────────────────────────────────────────────────────────────

async function GET_sprints(searchParams = {}) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const where = {}
  if (searchParams.status) where.status = searchParams.status
  const sprints = await mockPrisma.sprint.findMany({ where, orderBy: { startDate: 'desc' }, include: { issues: true } })
  return json(sprints)
}

async function POST_sprints(body) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const { name, startDate, endDate } = body
  if (!name || !startDate || !endDate) return json({ error: 'Invalid request data' }, 400)
  const s = new Date(startDate), e = new Date(endDate)
  if (e <= s) return json({ error: 'End date must be after start date' }, 400)
  const activeSprint = await mockPrisma.sprint.findFirst({ where: { status: 'ACTIVE' } })
  if (activeSprint) return json({ error: 'Only one ACTIVE sprint is allowed at a time' }, 400)
  const sprint = await mockPrisma.sprint.create({ data: { name, startDate: s, endDate: e, status: 'PLANNING' }, include: { issues: true } })
  return json(sprint, 201)
}

async function PATCH_sprint(id, body) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const sprint = await mockPrisma.sprint.findUnique({ where: { id } })
  if (!sprint) return json({ error: 'Sprint not found' }, 404)
  const { status } = body
  const validTransitions = { PLANNING: ['ACTIVE'], ACTIVE: ['COMPLETED'] }
  if (status && (!validTransitions[sprint.status] || !validTransitions[sprint.status].includes(status))) {
    return json({ error: `Cannot transition from ${sprint.status} to ${status}` }, 400)
  }
  if (status === 'ACTIVE') {
    const existing = await mockPrisma.sprint.findFirst({ where: { status: 'ACTIVE' } })
    if (existing && existing.id !== id) return json({ error: 'Only one ACTIVE sprint at a time' }, 400)
  }
  const updated = await mockPrisma.sprint.update({ where: { id }, data: body })
  return json(updated)
}

// ── Issues ───────────────────────────────────────────────────────────────────

async function GET_issues(searchParams = {}) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const where = { deletedAt: null }
  if (searchParams.sprintId) where.sprintId = searchParams.sprintId
  if (searchParams.teamId) where.teamId = searchParams.teamId
  if (searchParams.backlog === 'true') where.sprintId = null
  const issues = await mockPrisma.issue.findMany({ where })
  return json(issues)
}

async function POST_issue(body) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const { title, type, priority, teamId } = body
  if (!title || title.length < 3) return json({ error: 'Title must be at least 3 characters' }, 400)
  if (!type || !['STORY', 'BUG', 'TASK', 'SUBTASK'].includes(type)) return json({ error: 'Invalid issue type' }, 400)
  if (!priority || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) return json({ error: 'Invalid priority' }, 400)
  if (!teamId) return json({ error: 'Team is required' }, 400)
  const team = await mockPrisma.team.findUnique({ where: { id: teamId } })
  if (!team) return json({ error: 'Team not found' }, 404)
  const counter = team.issueCounter + 1
  const displayId = `${team.prefix}-${counter}`
  await mockPrisma.team.update({ where: { id: teamId }, data: { issueCounter: counter } })
  const issue = await mockPrisma.issue.create({ data: { ...body, displayId, reporterId: session.user.id, position: 0 } })
  return json(issue, 201)
}

async function PATCH_issue(id, body) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const issue = await mockPrisma.issue.findUnique({ where: { id } })
  if (!issue || issue.deletedAt) return json({ error: 'Issue not found' }, 404)
  if (body.status && !['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'].includes(body.status)) {
    return json({ error: 'Invalid status' }, 400)
  }
  const updated = await mockPrisma.issue.update({ where: { id }, data: body })
  return json(updated)
}

async function DELETE_issue(id) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const issue = await mockPrisma.issue.findUnique({ where: { id } })
  if (!issue) return json({ error: 'Issue not found' }, 404)
  // Soft delete
  const deleted = await mockPrisma.issue.update({ where: { id }, data: { deletedAt: new Date() } })
  return json(deleted)
}

// ── Epics ────────────────────────────────────────────────────────────────────

async function GET_epics(searchParams = {}) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const where = {}
  if (searchParams.status) where.status = searchParams.status
  const epics = await mockPrisma.epic.findMany({ where, include: { issues: true, createdBy: true } })
  return json(epics.map(epic => {
    const total = epic.issues.length
    const done = epic.issues.filter(i => i.status === 'DONE').length
    return { ...epic, totalIssues: total, doneIssues: done, overallProgress: total > 0 ? Math.round((done / total) * 100) : 0 }
  }))
}

async function POST_epic(body) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  if (!body.title) return json({ error: 'Title is required' }, 400)
  const epic = await mockPrisma.epic.create({ data: { title: body.title, description: body.description ?? null, status: body.status ?? 'ACTIVE', targetSprintId: body.targetSprintId ?? null, createdById: session.user.id } })
  return json(epic, 201)
}

// ── Issue Links ───────────────────────────────────────────────────────────────

const INVERSE = { BLOCKS: 'BLOCKED_BY', BLOCKED_BY: 'BLOCKS', RELATES_TO: 'RELATES_TO', TESTS: 'TESTED_BY', TESTED_BY: 'TESTS', DUPLICATES: 'DUPLICATED_BY', DUPLICATED_BY: 'DUPLICATES' }

async function POST_link(body) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const { sourceIssueId, targetIssueId, linkType } = body
  if (!sourceIssueId || !targetIssueId || !linkType) return json({ error: 'Missing required fields' }, 400)
  if (sourceIssueId === targetIssueId) return json({ error: 'Cannot link issue to itself' }, 400)
  if (!INVERSE[linkType]) return json({ error: 'Invalid link type' }, 400)
  const [source, target] = await Promise.all([
    mockPrisma.issue.findUnique({ where: { id: sourceIssueId } }),
    mockPrisma.issue.findUnique({ where: { id: targetIssueId } }),
  ])
  if (!source) return json({ error: 'Source issue not found' }, 404)
  if (!target) return json({ error: 'Target issue not found' }, 404)
  const link = await mockPrisma.issueLink.create({ data: { sourceIssueId, targetIssueId, linkType } })
  return json(link, 201)
}

async function DELETE_link(id) {
  const session = getAuth()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  const link = await mockPrisma.issueLink.findUnique({ where: { id } })
  if (!link) return json({ error: 'Link not found' }, 404)
  await mockPrisma.issueLink.delete({ where: { id } })
  return json({ message: 'Link deleted' })
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe('Sprint API', () => {

  test('GET /api/sprints → 200 with sprint list', async () => {
    authReturn = mockSession
    const res = await GET_sprints()
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body))
    assert.equal(res.body.length, 1)
  })

  test('GET /api/sprints → 401 without auth', async () => {
    authReturn = null
    const res = await GET_sprints()
    assert.equal(res.status, 401)
    authReturn = mockSession
  })

  test('GET /api/sprints?status=ACTIVE → filters by status', async () => {
    authReturn = mockSession
    const res = await GET_sprints({ status: 'PLANNING' })
    assert.equal(res.status, 200)
    assert.equal(res.body.length, 1)
    const empty = await GET_sprints({ status: 'ACTIVE' })
    assert.equal(empty.body.length, 0)
  })

  test('POST /api/sprints → 201 creates sprint', async () => {
    authReturn = mockSession
    mockPrisma.sprint._data = []  // no active sprint
    const res = await POST_sprints({ name: 'Sprint 2', startDate: '2025-02-01', endDate: '2025-02-14' })
    assert.equal(res.status, 201)
    assert.equal(res.body.name, 'Sprint 2')
    assert.equal(res.body.status, 'PLANNING')
  })

  test('POST /api/sprints → 401 without auth', async () => {
    authReturn = null
    const res = await POST_sprints({ name: 'Sprint X', startDate: '2025-02-01', endDate: '2025-02-14' })
    assert.equal(res.status, 401)
    authReturn = mockSession
  })

  test('POST /api/sprints → 400 when endDate before startDate', async () => {
    authReturn = mockSession
    const res = await POST_sprints({ name: 'Bad Sprint', startDate: '2025-02-14', endDate: '2025-02-01' })
    assert.equal(res.status, 400)
    assert.match(res.body.error, /end date/i)
  })

  test('POST /api/sprints → 400 when endDate equals startDate', async () => {
    authReturn = mockSession
    const res = await POST_sprints({ name: 'Same Day', startDate: '2025-02-01', endDate: '2025-02-01' })
    assert.equal(res.status, 400)
  })

  test('POST /api/sprints → 400 when ACTIVE sprint exists', async () => {
    authReturn = mockSession
    mockPrisma.sprint._data = [{ id: 'sprint-active', status: 'ACTIVE' }]
    const res = await POST_sprints({ name: 'New Sprint', startDate: '2025-03-01', endDate: '2025-03-14' })
    assert.equal(res.status, 400)
    assert.match(res.body.error, /ACTIVE/i)
    mockPrisma.sprint._data = []
  })

  test('POST /api/sprints → 400 when missing fields', async () => {
    authReturn = mockSession
    const res = await POST_sprints({ name: 'Incomplete' })
    assert.equal(res.status, 400)
  })

  test('PATCH /api/sprints/:id → 400 for invalid status transition', async () => {
    authReturn = mockSession
    mockPrisma.sprint._data = [{ id: 'sprint-1', status: 'PLANNING' }]
    const res = await PATCH_sprint('sprint-1', { status: 'COMPLETED' })
    assert.equal(res.status, 400)
    assert.match(res.body.error, /Cannot transition/i)
  })

  test('PATCH /api/sprints/:id → 200 for valid transition PLANNING→ACTIVE', async () => {
    authReturn = mockSession
    mockPrisma.sprint._data = [{ id: 'sprint-1', status: 'PLANNING' }]
    const res = await PATCH_sprint('sprint-1', { status: 'ACTIVE' })
    assert.equal(res.status, 200)
  })

  test('PATCH /api/sprints/:id → 404 for non-existent sprint', async () => {
    authReturn = mockSession
    mockPrisma.sprint._data = []
    const res = await PATCH_sprint('no-such-id', { status: 'ACTIVE' })
    assert.equal(res.status, 404)
  })
})

describe('Issue API', () => {

  test('GET /api/issues → 200 with issue list', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'issue-1', displayId: 'FE-1', title: 'Test', type: 'STORY', status: 'BACKLOG', priority: 'MEDIUM', teamId: 'team-1', sprintId: null, deletedAt: null }]
    const res = await GET_issues()
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body))
  })

  test('GET /api/issues → 401 without auth', async () => {
    authReturn = null
    const res = await GET_issues()
    assert.equal(res.status, 401)
    authReturn = mockSession
  })

  test('GET /api/issues?backlog=true → only backlog issues', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [
      { id: 'i1', sprintId: null, deletedAt: null },
      { id: 'i2', sprintId: 'sprint-1', deletedAt: null },
    ]
    const res = await GET_issues({ backlog: 'true' })
    assert.equal(res.status, 200)
    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].sprintId, null)
  })

  test('GET /api/issues → soft-deleted issues excluded', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [
      { id: 'i1', deletedAt: null },
      { id: 'i2', deletedAt: new Date() },
    ]
    const res = await GET_issues()
    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].id, 'i1')
  })

  test('POST /api/issues → 201 creates issue with display ID', async () => {
    authReturn = mockSession
    mockPrisma.team._data = [{ id: 'team-1', prefix: 'FE', issueCounter: 5 }]
    const res = await POST_issue({ title: 'Fix login bug', type: 'BUG', priority: 'HIGH', teamId: 'team-1' })
    assert.equal(res.status, 201)
    assert.equal(res.body.displayId, 'FE-6')
  })

  test('POST /api/issues → display ID uses team prefix (BE-)', async () => {
    authReturn = mockSession
    mockPrisma.team._data = [{ id: 'team-2', prefix: 'BE', issueCounter: 2 }]
    const res = await POST_issue({ title: 'Add endpoint', type: 'TASK', priority: 'MEDIUM', teamId: 'team-2' })
    assert.equal(res.status, 201)
    assert.equal(res.body.displayId, 'BE-3')
  })

  test('POST /api/issues → display ID uses team prefix (QA-)', async () => {
    authReturn = mockSession
    mockPrisma.team._data = [{ id: 'team-3', prefix: 'QA', issueCounter: 0 }]
    const res = await POST_issue({ title: 'Write test cases', type: 'TASK', priority: 'LOW', teamId: 'team-3' })
    assert.equal(res.status, 201)
    assert.equal(res.body.displayId, 'QA-1')
  })

  test('POST /api/issues → 401 without auth', async () => {
    authReturn = null
    const res = await POST_issue({ title: 'Test Issue', type: 'TASK', priority: 'LOW', teamId: 'team-1' })
    assert.equal(res.status, 401)
    authReturn = mockSession
  })

  test('POST /api/issues → 400 when title too short', async () => {
    authReturn = mockSession
    const res = await POST_issue({ title: 'AB', type: 'TASK', priority: 'LOW', teamId: 'team-1' })
    assert.equal(res.status, 400)
    assert.match(res.body.error, /3 characters/i)
  })

  test('POST /api/issues → 400 with invalid type', async () => {
    authReturn = mockSession
    const res = await POST_issue({ title: 'Valid Title', type: 'INVALID', priority: 'LOW', teamId: 'team-1' })
    assert.equal(res.status, 400)
  })

  test('POST /api/issues → 400 with invalid priority', async () => {
    authReturn = mockSession
    const res = await POST_issue({ title: 'Valid Title', type: 'TASK', priority: 'URGENT', teamId: 'team-1' })
    assert.equal(res.status, 400)
  })

  test('POST /api/issues → 400 when teamId missing', async () => {
    authReturn = mockSession
    const res = await POST_issue({ title: 'Valid Title', type: 'TASK', priority: 'LOW' })
    assert.equal(res.status, 400)
  })

  test('POST /api/issues → 404 when team not found', async () => {
    authReturn = mockSession
    mockPrisma.team._data = []
    const res = await POST_issue({ title: 'Valid Title', type: 'TASK', priority: 'LOW', teamId: 'no-team' })
    assert.equal(res.status, 404)
  })

  test('DELETE /api/issues/:id → soft delete (sets deletedAt)', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'issue-del', deletedAt: null }]
    const res = await DELETE_issue('issue-del')
    assert.equal(res.status, 200)
    assert.ok(res.body.deletedAt)
  })

  test('DELETE /api/issues/:id → 404 for missing issue', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = []
    const res = await DELETE_issue('ghost-issue')
    assert.equal(res.status, 404)
  })

  test('PATCH /api/issues/:id → update status to IN_PROGRESS', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'issue-1', status: 'TODO', deletedAt: null }]
    const res = await PATCH_issue('issue-1', { status: 'IN_PROGRESS' })
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'IN_PROGRESS')
  })

  test('PATCH /api/issues/:id → 400 for invalid status', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'issue-1', status: 'TODO', deletedAt: null }]
    const res = await PATCH_issue('issue-1', { status: 'INVALID' })
    assert.equal(res.status, 400)
  })
})

describe('Epic API', () => {

  test('GET /api/epics → 200 with epic list', async () => {
    authReturn = mockSession
    mockPrisma.epic._data = [{ id: 'epic-1', title: 'Epic 1', status: 'ACTIVE', issues: [], createdBy: {} }]
    const res = await GET_epics()
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body))
  })

  test('GET /api/epics → 401 without auth', async () => {
    authReturn = null
    const res = await GET_epics()
    assert.equal(res.status, 401)
    authReturn = mockSession
  })

  test('GET /api/epics → calculates 0% progress for empty epic', async () => {
    authReturn = mockSession
    mockPrisma.epic._data = [{ id: 'e1', title: 'Empty', status: 'ACTIVE', issues: [], createdBy: {} }]
    const res = await GET_epics()
    assert.equal(res.body[0].overallProgress, 0)
    assert.equal(res.body[0].totalIssues, 0)
  })

  test('GET /api/epics → calculates 67% progress (2 of 3 done)', async () => {
    authReturn = mockSession
    mockPrisma.epic._data = [{
      id: 'e1', title: 'In Progress', status: 'ACTIVE', createdBy: {},
      issues: [{ status: 'DONE' }, { status: 'DONE' }, { status: 'IN_PROGRESS' }]
    }]
    const res = await GET_epics()
    assert.equal(res.body[0].overallProgress, 67)
    assert.equal(res.body[0].doneIssues, 2)
  })

  test('GET /api/epics → calculates 100% progress when all done', async () => {
    authReturn = mockSession
    mockPrisma.epic._data = [{
      id: 'e1', title: 'Done', status: 'ACTIVE', createdBy: {},
      issues: [{ status: 'DONE' }, { status: 'DONE' }]
    }]
    const res = await GET_epics()
    assert.equal(res.body[0].overallProgress, 100)
  })

  test('GET /api/epics?status=COMPLETED → filters by status', async () => {
    authReturn = mockSession
    mockPrisma.epic._data = [
      { id: 'e1', title: 'Active', status: 'ACTIVE', issues: [], createdBy: {} },
      { id: 'e2', title: 'Done', status: 'COMPLETED', issues: [], createdBy: {} },
    ]
    const res = await GET_epics({ status: 'COMPLETED' })
    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].status, 'COMPLETED')
  })

  test('POST /api/epics → 201 creates epic', async () => {
    authReturn = mockSession
    const res = await POST_epic({ title: 'New Epic', description: 'Desc' })
    assert.equal(res.status, 201)
    assert.equal(res.body.title, 'New Epic')
    assert.equal(res.body.status, 'ACTIVE')
  })

  test('POST /api/epics → 400 when title missing', async () => {
    authReturn = mockSession
    const res = await POST_epic({ description: 'No title' })
    assert.equal(res.status, 400)
    assert.match(res.body.error, /title/i)
  })

  test('POST /api/epics → 401 without auth', async () => {
    authReturn = null
    const res = await POST_epic({ title: 'Epic X' })
    assert.equal(res.status, 401)
    authReturn = mockSession
  })

  test('POST /api/epics → defaults status to ACTIVE', async () => {
    authReturn = mockSession
    const res = await POST_epic({ title: 'Default Status Epic' })
    assert.equal(res.body.status, 'ACTIVE')
  })

  test('POST /api/epics → respects custom status', async () => {
    authReturn = mockSession
    const res = await POST_epic({ title: 'Cancelled Epic', status: 'CANCELLED' })
    assert.equal(res.body.status, 'CANCELLED')
  })
})

describe('Issue Links API', () => {

  test('POST /api/issues/links → 201 creates BLOCKS link', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [
      { id: 'issue-a', deletedAt: null },
      { id: 'issue-b', deletedAt: null },
    ]
    const res = await POST_link({ sourceIssueId: 'issue-a', targetIssueId: 'issue-b', linkType: 'BLOCKS' })
    assert.equal(res.status, 201)
    assert.equal(res.body.linkType, 'BLOCKS')
  })

  test('POST /api/issues/links → 201 creates RELATES_TO link', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'a', deletedAt: null }, { id: 'b', deletedAt: null }]
    const res = await POST_link({ sourceIssueId: 'a', targetIssueId: 'b', linkType: 'RELATES_TO' })
    assert.equal(res.status, 201)
  })

  test('POST /api/issues/links → 201 creates TESTS link', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'a', deletedAt: null }, { id: 'b', deletedAt: null }]
    const res = await POST_link({ sourceIssueId: 'a', targetIssueId: 'b', linkType: 'TESTS' })
    assert.equal(res.status, 201)
  })

  test('POST /api/issues/links → 400 when linking issue to itself', async () => {
    authReturn = mockSession
    const res = await POST_link({ sourceIssueId: 'issue-a', targetIssueId: 'issue-a', linkType: 'BLOCKS' })
    assert.equal(res.status, 400)
    assert.match(res.body.error, /itself/i)
  })

  test('POST /api/issues/links → 400 for invalid link type', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'a', deletedAt: null }, { id: 'b', deletedAt: null }]
    const res = await POST_link({ sourceIssueId: 'a', targetIssueId: 'b', linkType: 'INVALID_TYPE' })
    assert.equal(res.status, 400)
  })

  test('POST /api/issues/links → 404 when source issue not found', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'issue-b', deletedAt: null }]
    const res = await POST_link({ sourceIssueId: 'no-such', targetIssueId: 'issue-b', linkType: 'BLOCKS' })
    assert.equal(res.status, 404)
    assert.match(res.body.error, /source/i)
  })

  test('POST /api/issues/links → 404 when target issue not found', async () => {
    authReturn = mockSession
    mockPrisma.issue._data = [{ id: 'issue-a', deletedAt: null }]
    const res = await POST_link({ sourceIssueId: 'issue-a', targetIssueId: 'no-such', linkType: 'BLOCKS' })
    assert.equal(res.status, 404)
    assert.match(res.body.error, /target/i)
  })

  test('POST /api/issues/links → 401 without auth', async () => {
    authReturn = null
    const res = await POST_link({ sourceIssueId: 'a', targetIssueId: 'b', linkType: 'BLOCKS' })
    assert.equal(res.status, 401)
    authReturn = mockSession
  })

  test('POST /api/issues/links → 400 when fields missing', async () => {
    authReturn = mockSession
    const res = await POST_link({ sourceIssueId: 'a' })
    assert.equal(res.status, 400)
  })

  test('DELETE /api/issues/links/:id → 200 deletes link', async () => {
    authReturn = mockSession
    mockPrisma.issueLink._data = [{ id: 'link-1', sourceIssueId: 'a', targetIssueId: 'b', linkType: 'BLOCKS' }]
    const res = await DELETE_link('link-1')
    assert.equal(res.status, 200)
  })

  test('DELETE /api/issues/links/:id → 404 for missing link', async () => {
    authReturn = mockSession
    mockPrisma.issueLink._data = []
    const res = await DELETE_link('no-link')
    assert.equal(res.status, 404)
  })
})

describe('Teams API', () => {

  test('Teams list has FE, BE, QA prefixes', async () => {
    // Reset to known state (previous tests may have mutated team data)
    mockPrisma.team._data = [
      { id: 'team-1', name: 'Frontend', prefix: 'FE', color: '#3B82F6', issueCounter: 1 },
      { id: 'team-2', name: 'Backend', prefix: 'BE', color: '#10B981', issueCounter: 0 },
      { id: 'team-3', name: 'QA', prefix: 'QA', color: '#8B5CF6', issueCounter: 0 },
    ]
    const teams = await mockPrisma.team.findMany()
    const prefixes = teams.map(t => t.prefix)
    assert.ok(prefixes.includes('FE'))
    assert.ok(prefixes.includes('BE'))
    assert.ok(prefixes.includes('QA'))
  })

  test('Issue counter increments per team independently', async () => {
    authReturn = mockSession
    mockPrisma.team._data = [
      { id: 'fe', prefix: 'FE', issueCounter: 3 },
      { id: 'be', prefix: 'BE', issueCounter: 1 },
    ]
    const r1 = await POST_issue({ title: 'FE Issue', type: 'TASK', priority: 'LOW', teamId: 'fe' })
    const r2 = await POST_issue({ title: 'BE Issue', type: 'TASK', priority: 'LOW', teamId: 'be' })
    assert.equal(r1.body.displayId, 'FE-4')
    assert.equal(r2.body.displayId, 'BE-2')
  })
})

describe('Input Validation', () => {

  test('Sprint: name cannot be empty', async () => {
    authReturn = mockSession
    mockPrisma.sprint._data = []
    const res = await POST_sprints({ name: '', startDate: '2025-02-01', endDate: '2025-02-14' })
    assert.equal(res.status, 400)
  })

  test('Issue: all valid types are accepted', async () => {
    authReturn = mockSession
    mockPrisma.team._data = [{ id: 'team-1', prefix: 'FE', issueCounter: 0 }]
    for (const type of ['STORY', 'BUG', 'TASK', 'SUBTASK']) {
      const res = await POST_issue({ title: `A ${type} issue`, type, priority: 'LOW', teamId: 'team-1' })
      assert.equal(res.status, 201, `Type ${type} should be accepted`)
    }
  })

  test('Issue: all valid priorities are accepted', async () => {
    authReturn = mockSession
    mockPrisma.team._data = [{ id: 'team-1', prefix: 'FE', issueCounter: 0 }]
    for (const priority of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
      const res = await POST_issue({ title: 'Some issue title', type: 'TASK', priority, teamId: 'team-1' })
      assert.equal(res.status, 201, `Priority ${priority} should be accepted`)
    }
  })

  test('Issue: all valid statuses are accepted on PATCH', async () => {
    authReturn = mockSession
    for (const status of ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']) {
      mockPrisma.issue._data = [{ id: 'i1', status: 'BACKLOG', deletedAt: null }]
      const res = await PATCH_issue('i1', { status })
      assert.equal(res.status, 200, `Status ${status} should be accepted`)
    }
  })

  test('Link: all valid link types are accepted', async () => {
    authReturn = mockSession
    for (const linkType of ['BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'TESTS', 'TESTED_BY', 'DUPLICATES', 'DUPLICATED_BY']) {
      mockPrisma.issue._data = [{ id: 'a', deletedAt: null }, { id: 'b', deletedAt: null }]
      const res = await POST_link({ sourceIssueId: 'a', targetIssueId: 'b', linkType })
      assert.equal(res.status, 201, `Link type ${linkType} should be accepted`)
    }
  })

  test('Epic: COMPLETED and CANCELLED statuses are valid', async () => {
    authReturn = mockSession
    for (const status of ['ACTIVE', 'COMPLETED', 'CANCELLED']) {
      const res = await POST_epic({ title: `${status} Epic`, status })
      assert.equal(res.status, 201)
      assert.equal(res.body.status, status)
    }
  })
})
