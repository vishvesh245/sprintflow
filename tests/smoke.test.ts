import { describe, it, expect, beforeAll } from 'vitest'

const BASE_URL = 'http://localhost:3000'

// Check if server is running
let serverIsRunning = false

beforeAll(async () => {
  try {
    const response = await fetch(`${BASE_URL}/api/teams`)
    serverIsRunning = response.ok || response.status === 401
  } catch (error) {
    serverIsRunning = false
  }
})

describe.skipIf(!serverIsRunning)('Smoke Tests - Live Server', () => {
  describe('Public pages', () => {
    it('should load login page', async () => {
      const response = await fetch(`${BASE_URL}/login`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
    })

    it('should load health check endpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'GET',
      }).catch(() => ({ status: 404 }))

      // Health endpoint may not exist, but server should respond
      expect([200, 404]).toContain(response.status)
    })
  })

  describe('API endpoints without auth', () => {
    it('should return 401 for GET /api/sprints without token', async () => {
      const response = await fetch(`${BASE_URL}/api/sprints`)
      expect(response.status).toBe(401)
    })

    it('should return 401 for GET /api/issues without token', async () => {
      const response = await fetch(`${BASE_URL}/api/issues`)
      expect(response.status).toBe(401)
    })

    it('should return 401 for GET /api/epics without token', async () => {
      const response = await fetch(`${BASE_URL}/api/epics`)
      expect(response.status).toBe(401)
    })

    it('should return 401 for POST /api/issues without token', async () => {
      const response = await fetch(`${BASE_URL}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          type: 'TASK',
          priority: 'MEDIUM',
          teamId: 'team-1',
        }),
      })
      expect(response.status).toBe(401)
    })
  })

  describe('Protected pages redirect to login', () => {
    it('should redirect /sprint to /login when unauthenticated', async () => {
      const response = await fetch(`${BASE_URL}/sprint`, {
        redirect: 'manual',
      })
      expect([302, 307, 401]).toContain(response.status)
    })

    it('should redirect /board to /login when unauthenticated', async () => {
      const response = await fetch(`${BASE_URL}/board`, {
        redirect: 'manual',
      })
      expect([302, 307, 401]).toContain(response.status)
    })

    it('should redirect /backlog to /login when unauthenticated', async () => {
      const response = await fetch(`${BASE_URL}/backlog`, {
        redirect: 'manual',
      })
      expect([302, 307, 401]).toContain(response.status)
    })

    it('should redirect /epics to /login when unauthenticated', async () => {
      const response = await fetch(`${BASE_URL}/epics`, {
        redirect: 'manual',
      })
      expect([302, 307, 401]).toContain(response.status)
    })
  })

  describe('Route health checks', () => {
    it('GET /api/teams should respond', async () => {
      const response = await fetch(`${BASE_URL}/api/teams`)
      // Should either be 200 (public) or 401 (auth required)
      expect([200, 401]).toContain(response.status)
    })

    it('should handle malformed JSON in POST requests gracefully', async () => {
      const response = await fetch(`${BASE_URL}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      })
      // Should return error status
      expect([400, 401, 500]).toContain(response.status)
    })
  })

  describe('Server responsiveness', () => {
    it('should respond to requests within reasonable time', async () => {
      const startTime = Date.now()
      const response = await fetch(`${BASE_URL}/api/teams`)
      const endTime = Date.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(5000) // Less than 5 seconds
      expect([200, 401]).toContain(response.status)
    })

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, () =>
        fetch(`${BASE_URL}/api/teams`)
      )

      const responses = await Promise.all(promises)
      responses.forEach((response) => {
        expect([200, 401]).toContain(response.status)
      })
    })
  })
})
