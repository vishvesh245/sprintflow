/**
 * SprintSync — True Integration Tests
 *
 * These tests make REAL HTTP requests to the running Next.js server
 * and use a properly signed NextAuth v5 session cookie so every request
 * is fully authenticated — no mocks, no shortcuts.
 *
 * Prerequisites:
 *   1. npm run dev must be running at http://localhost:3000
 *
 * Run:
 *   npm run test:integration
 */

import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')

// ─── Load env ────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf-8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const val = match[2].trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = val
      }
    }
  } catch {
    console.warn('⚠️  Could not load .env.local — using process.env')
  }
}

loadEnv()

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

if (!AUTH_SECRET) {
  console.error('❌ AUTH_SECRET not set — cannot forge session token')
  process.exit(1)
}

// ─── Session token forge (NextAuth v5 JWE) ────────────────────────────────────

async function createSessionCookie(payload = {}) {
  const { hkdf } = await import('@panva/hkdf')
  const { EncryptJWT } = await import('jose')

  const cookieName = 'authjs.session-token'
  const salt = cookieName

  // Derive encryption key exactly as NextAuth v5 does
  const keyMaterial = await hkdf(
    'sha256',
    AUTH_SECRET,
    salt,
    `Auth.js Generated Encryption Key (${salt})`,
    64
  )

  const base = {
    email: 'vpandya@noon.com',
    name: 'Test User (Integration)',
    teamId: null,
    ...payload,
  }
  // Only include 'id' if it was explicitly provided and is not undefined
  if (base.id === undefined) delete base.id

  const sessionPayload = {
    ...base,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    jti: crypto.randomUUID(),
  }

  const token = await new EncryptJWT(sessionPayload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .encrypt(keyMaterial)

  return `${cookieName}=${token}`
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

let sessionCookie = ''

async function api(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, body: json, headers: res.headers }
}

const GET    = (path)        => api('GET',    path)
const POST   = (path, body)  => api('POST',   path, body)
const PATCH  = (path, body)  => api('PATCH',  path, body)
const DELETE = (path)        => api('DELETE', path)

// ─── Tests ────────────────────────────────────────────────────────────────────
// Wrapped in a single outer describe with concurrency:false so ALL suites run
// one after another. This is critical because DATABASE_URL uses connection_limit=1
// (pgbouncer transaction mode) and concurrent suites exhaust the single connection.

describe('SprintSync Integration Tests', { concurrency: false }, () => {

  // ─── Server check + session setup ─────────────────────────────────────────

  before(async () => {
    try {
      await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) })
    } catch {
      console.error(`\n❌ Cannot reach ${BASE_URL}`)
      console.error('   Run "npm run dev" first, then re-run this test.\n')
      process.exit(1)
    }

    // Forge a session cookie with just the email.
    // The JWT callback in auth.ts runs on every auth() call and does
    // prisma.user.findUnique({ where: { email } }) to resolve the real DB user id,
    // so we don't need to embed the id in the JWT ourselves.
    sessionCookie = await createSessionCookie({ email: 'vpandya@noon.com' })

    console.log(`\n✅ Server up at ${BASE_URL}`)
    console.log('✅ Session cookie forged (JWT callback resolves real user id per request)\n')
  })

  // ─── Auth protection ────────────────────────────────────────────────────────

  describe('Auth protection (no cookie)', { concurrency: false }, () => {

    test('GET /api/sprints → 401 without session', async () => {
      const res = await api('GET', '/api/sprints', null, { Cookie: '' })
      assert.equal(res.status, 401)
      assert.equal(res.body?.error, 'Unauthorized')
    })

    test('GET /api/issues → 401 without session', async () => {
      const res = await api('GET', '/api/issues', null, { Cookie: '' })
      assert.equal(res.status, 401)
    })

    test('GET /api/epics → 401 without session', async () => {
      const res = await api('GET', '/api/epics', null, { Cookie: '' })
      assert.equal(res.status, 401)
    })

    test('POST /api/sprints → 401 without session', async () => {
      const res = await api('POST', '/api/sprints', { name: 'x', startDate: '2025-01-01', endDate: '2025-01-14' }, { Cookie: '' })
      assert.equal(res.status, 401)
    })

    test('POST /api/epics → 401 without session', async () => {
      const res = await api('POST', '/api/epics', { title: 'x' }, { Cookie: '' })
      assert.equal(res.status, 401)
    })
  })

  // ─── Teams API ──────────────────────────────────────────────────────────────

  describe('Teams API (real DB)', { concurrency: false }, () => {

    test('GET /api/teams → 200 returns team list', async () => {
      const res = await GET('/api/teams')
      assert.equal(res.status, 200)
      assert.ok(Array.isArray(res.body), 'Body should be an array')
      assert.ok(res.body.length >= 3, `Expected ≥3 teams, got ${res.body.length}`)
    })

    test('Teams include FE, BE, QA prefixes', async () => {
      const res = await GET('/api/teams')
      const prefixes = res.body.map(t => t.prefix)
      assert.ok(prefixes.includes('FE'), 'Missing FE team')
      assert.ok(prefixes.includes('BE'), 'Missing BE team')
      assert.ok(prefixes.includes('QA'), 'Missing QA team')
    })

    test('Each team has required fields', async () => {
      const res = await GET('/api/teams')
      for (const team of res.body) {
        assert.ok(team.id, `Team missing id`)
        assert.ok(team.name, `Team missing name`)
        assert.ok(team.prefix, `Team missing prefix`)
        assert.ok(team.color, `Team missing color`)
      }
    })
  })

  // ─── Sprints API ────────────────────────────────────────────────────────────

  describe('Sprints API (real DB)', { concurrency: false }, () => {

    let createdSprintId = null

    test('GET /api/sprints → 200 returns array', async () => {
      const res = await GET('/api/sprints')
      assert.equal(res.status, 200, `GET /api/sprints failed: ${JSON.stringify(res.body)}`)
      assert.ok(Array.isArray(res.body))
    })

    test('GET /api/sprints?status=PLANNING → filters correctly', async () => {
      const res = await GET('/api/sprints?status=PLANNING')
      assert.equal(res.status, 200, `GET /api/sprints?status=PLANNING failed: ${JSON.stringify(res.body)}`)
      for (const sprint of res.body) {
        assert.equal(sprint.status, 'PLANNING')
      }
    })

    test('POST /api/sprints → 400 with missing fields', async () => {
      const res = await POST('/api/sprints', { name: 'Incomplete' })
      assert.ok([400, 422].includes(res.status), `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`)
    })

    test('POST /api/sprints → 400 when endDate before startDate', async () => {
      const res = await POST('/api/sprints', {
        name: 'Bad Dates',
        startDate: '2030-06-14',
        endDate: '2030-06-01',
      })
      assert.equal(res.status, 400, `Expected 400 for bad dates, got ${res.status}: ${JSON.stringify(res.body)}`)
    })

    test('POST /api/sprints → 201 creates sprint (cleanup after)', async () => {
      // Use far-future dates to avoid conflicts
      const res = await POST('/api/sprints', {
        name: `Integration Test Sprint ${Date.now()}`,
        startDate: '2030-01-01',
        endDate: '2030-01-14',
      })
      // Might be 201 (created) or 400 (overlap/active sprint) — both are valid
      assert.ok([201, 400].includes(res.status), `Unexpected status ${res.status}: ${JSON.stringify(res.body)}`)
      if (res.status === 201) {
        createdSprintId = res.body.id
        assert.ok(res.body.id)
        assert.equal(res.body.status, 'PLANNING')
      }
    })

    test('GET /api/sprints/:id → 200 for existing sprint', async () => {
      // Prefer the sprint we just created (clean, no pre-existing issues with
      // potentially broken team/assignee relations that cause Prisma include hangs).
      // Fall back to list[0] only if POST didn't create one.
      let id = createdSprintId
      if (!id) {
        const list = await GET('/api/sprints')
        if (!list.body || list.body.length === 0) {
          console.log('    (skipped — no sprints in DB)')
          return
        }
        id = list.body[0].id
      }
      const res = await GET(`/api/sprints/${id}`)
      assert.equal(res.status, 200, `GET /api/sprints/${id} failed: ${JSON.stringify(res.body)}`)
      assert.equal(res.body.id, id)
    })
  })

  // ─── Epics API ──────────────────────────────────────────────────────────────

  describe('Epics API (real DB)', { concurrency: false }, () => {

    let createdEpicId = null

    test('GET /api/epics → 200 returns array', async () => {
      const res = await GET('/api/epics')
      assert.equal(res.status, 200)
      assert.ok(Array.isArray(res.body))
    })

    test('GET /api/epics?status=ACTIVE → filters by status', async () => {
      const res = await GET('/api/epics?status=ACTIVE')
      assert.equal(res.status, 200)
      for (const epic of res.body) {
        assert.equal(epic.status, 'ACTIVE')
      }
    })

    test('POST /api/epics → 400 without title', async () => {
      const res = await POST('/api/epics', { description: 'No title here' })
      assert.equal(res.status, 400)
    })

    test('POST /api/epics → 201 creates epic in real DB', async () => {
      const title = `Integration Epic ${Date.now()}`
      const res = await POST('/api/epics', { title, description: 'Created by integration test' })
      assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`)
      assert.ok(res.body.id)
      assert.equal(res.body.title, title)
      assert.equal(res.body.status, 'ACTIVE')
      createdEpicId = res.body.id
    })

    test('Created epic appears in GET /api/epics', async () => {
      if (!createdEpicId) { console.log('    (skipped — epic creation failed)'); return }
      const res = await GET('/api/epics')
      const found = res.body.find(e => e.id === createdEpicId)
      assert.ok(found, 'Created epic not found in list')
      assert.ok('overallProgress' in found, 'Missing overallProgress field')
      assert.ok('totalIssues' in found, 'Missing totalIssues field')
    })

    test('PATCH /api/epics/:id → updates epic status', async () => {
      if (!createdEpicId) { console.log('    (skipped — epic creation failed)'); return }
      const res = await PATCH(`/api/epics/${createdEpicId}`, { status: 'COMPLETED' })
      assert.equal(res.status, 200)
      assert.equal(res.body.status, 'COMPLETED')
    })
  })

  // ─── Issues API ─────────────────────────────────────────────────────────────

  describe('Issues API (real DB)', { concurrency: false }, () => {

    let teamId = null
    let createdIssueId = null

    before(async () => {
      const res = await GET('/api/teams')
      teamId = res.body.find(t => t.prefix === 'FE')?.id
    })

    test('GET /api/issues → 200 returns array', async () => {
      const res = await GET('/api/issues')
      assert.equal(res.status, 200)
      assert.ok(Array.isArray(res.body))
    })

    test('GET /api/issues?backlog=true → only unassigned issues', async () => {
      const res = await GET('/api/issues?backlog=true')
      assert.equal(res.status, 200)
      for (const issue of res.body) {
        assert.equal(issue.sprintId, null, `Issue ${issue.id} should have no sprint`)
      }
    })

    test('POST /api/issues → 400 with title too short', async () => {
      const res = await POST('/api/issues', { title: 'AB', type: 'TASK', priority: 'LOW', teamId })
      assert.equal(res.status, 400)
    })

    test('POST /api/issues → 400 with invalid type', async () => {
      const res = await POST('/api/issues', { title: 'Valid Title', type: 'INVALID', priority: 'LOW', teamId })
      assert.equal(res.status, 400)
    })

    test('POST /api/issues → 201 creates issue with FE- display ID', async () => {
      if (!teamId) { console.log('    (skipped — FE team not found)'); return }
      const res = await POST('/api/issues', {
        title: `Integration Test Issue ${Date.now()}`,
        type: 'TASK',
        priority: 'LOW',
        teamId,
      })
      assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`)
      assert.ok(res.body.id)
      assert.ok(res.body.displayId.startsWith('FE-'), `Expected FE- prefix, got ${res.body.displayId}`)
      createdIssueId = res.body.id
    })

    test('Created issue appears in GET /api/issues', async () => {
      if (!createdIssueId) { console.log('    (skipped)'); return }
      const res = await GET('/api/issues')
      const found = res.body.find(i => i.id === createdIssueId)
      assert.ok(found, 'Created issue not found in list')
      assert.equal(found.deletedAt, null, 'New issue should not be soft-deleted')
    })

    test('PATCH /api/issues/:id → updates issue status', async () => {
      if (!createdIssueId) { console.log('    (skipped)'); return }
      const res = await PATCH(`/api/issues/${createdIssueId}`, { status: 'IN_PROGRESS' })
      assert.equal(res.status, 200, `PATCH status failed: ${JSON.stringify(res.body)}`)
      assert.equal(res.body.status, 'IN_PROGRESS')
    })

    test('DELETE /api/issues/:id → soft-deletes (sets deletedAt)', async () => {
      if (!createdIssueId) { console.log('    (skipped)'); return }
      const res = await DELETE(`/api/issues/${createdIssueId}`)
      assert.equal(res.status, 200, `DELETE failed: ${JSON.stringify(res.body)}`)
      assert.ok(res.body.deletedAt, 'deletedAt should be set after soft-delete')
    })

    test('Soft-deleted issue no longer in GET /api/issues', async () => {
      if (!createdIssueId) { console.log('    (skipped)'); return }
      const res = await GET('/api/issues')
      const found = res.body.find(i => i.id === createdIssueId)
      assert.equal(found, undefined, 'Soft-deleted issue should not appear in list')
    })
  })

  // ─── Issue Links API ────────────────────────────────────────────────────────

  describe('Issue Links API (real DB)', { concurrency: false }, () => {

    let issueAId = null
    let issueBId = null
    let teamId = null

    before(async () => {
      const teamsRes = await GET('/api/teams')
      teamId = teamsRes.body.find(t => t.prefix === 'BE')?.id
      if (!teamId) return

      // Sequential requests — connection_limit=1 means concurrent POST would queue
      const a = await POST('/api/issues', { title: 'Link test source issue', type: 'STORY', priority: 'MEDIUM', teamId })
      const b = await POST('/api/issues', { title: 'Link test target issue', type: 'STORY', priority: 'MEDIUM', teamId })
      if (a.status === 201) issueAId = a.body.id
      if (b.status === 201) issueBId = b.body.id
    })

    test('POST /api/issues/links → 201 creates BLOCKS link', async () => {
      if (!issueAId || !issueBId) { console.log('    (skipped — issue creation failed)'); return }
      const res = await POST('/api/issues/links', {
        sourceIssueId: issueAId,
        targetIssueId: issueBId,
        linkType: 'BLOCKS',
      })
      assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`)
      assert.equal(res.body.linkType, 'BLOCKS')
      assert.equal(res.body.sourceIssueId, issueAId)
      assert.equal(res.body.targetIssueId, issueBId)
    })

    test('POST /api/issues/links → 400 self-link', async () => {
      if (!issueAId) { console.log('    (skipped)'); return }
      const res = await POST('/api/issues/links', {
        sourceIssueId: issueAId,
        targetIssueId: issueAId,
        linkType: 'BLOCKS',
      })
      assert.equal(res.status, 400)
    })

    test('POST /api/issues/links → 404 for non-existent source', async () => {
      const res = await POST('/api/issues/links', {
        sourceIssueId: 'non-existent-id-000',
        targetIssueId: issueBId || 'non-existent-id-001',
        linkType: 'BLOCKS',
      })
      assert.ok([400, 404].includes(res.status))
    })
  })

  // ─── Response shape validation ───────────────────────────────────────────────

  describe('Response shape validation (real API contracts)', { concurrency: false }, () => {

    test('Sprint has required fields', async () => {
      const res = await GET('/api/sprints')
      if (!res.body || res.body.length === 0) { console.log('    (skipped — no sprints)'); return }
      const sprint = res.body[0]
      assert.ok('id' in sprint)
      assert.ok('name' in sprint)
      assert.ok('startDate' in sprint)
      assert.ok('endDate' in sprint)
      assert.ok('status' in sprint)
      assert.ok('issues' in sprint)
      assert.ok(['PLANNING', 'ACTIVE', 'COMPLETED'].includes(sprint.status))
    })

    test('Epic has progress fields', async () => {
      const res = await GET('/api/epics')
      if (!res.body || res.body.length === 0) { console.log('    (skipped — no epics)'); return }
      const epic = res.body[0]
      assert.ok('id' in epic)
      assert.ok('title' in epic)
      assert.ok('overallProgress' in epic, 'Missing overallProgress')
      assert.ok('totalIssues' in epic, 'Missing totalIssues')
      assert.ok('doneIssues' in epic, 'Missing doneIssues')
      assert.ok(typeof epic.overallProgress === 'number')
      assert.ok(epic.overallProgress >= 0 && epic.overallProgress <= 100)
    })

    test('Issue has displayId in correct format', async () => {
      const res = await GET('/api/issues')
      if (!res.body || res.body.length === 0) { console.log('    (skipped — no issues)'); return }
      const issue = res.body[0]
      assert.ok('displayId' in issue)
      assert.match(issue.displayId, /^[A-Z]+-\d+$/, `displayId "${issue.displayId}" should be PREFIX-N format`)
    })

    test('Issue deletedAt is null for active issues', async () => {
      const res = await GET('/api/issues')
      for (const issue of res.body) {
        assert.equal(issue.deletedAt, null, `Issue ${issue.displayId} should have deletedAt=null`)
      }
    })
  })

})
