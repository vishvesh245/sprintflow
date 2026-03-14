#!/usr/bin/env node

const BASE_URL = 'http://localhost:3000'
let passCount = 0
let failCount = 0
const results = []

async function test(name, fn) {
  try {
    await fn()
    console.log(`✅ PASS: ${name}`)
    results.push({ name, status: 'PASS' })
    passCount++
  } catch (error) {
    console.log(`❌ FAIL: ${name}`)
    if (error.message) {
      console.log(`   Error: ${error.message}`)
    }
    results.push({ name, status: 'FAIL', error: error.message })
    failCount++
  }
}

async function fetchTest(url, options = {}) {
  const response = await fetch(url, options)
  return response
}

async function runTests() {
  console.log('🚀 Starting SprintSync Smoke Tests\n')
  console.log(`Target: ${BASE_URL}\n`)

  // Check if server is running
  console.log('Checking server connectivity...')
  try {
    await fetch(BASE_URL)
  } catch (error) {
    console.error(`\n❌ Server at ${BASE_URL} is not responding`)
    console.error(`Make sure the development server is running with: npm run dev\n`)
    process.exit(1)
  }

  console.log('✅ Server is reachable\n')
  console.log('Running tests...\n')

  // Public pages
  console.log('--- Public Pages ---')
  await test('GET /login returns 200', async () => {
    const response = await fetchTest(`${BASE_URL}/login`)
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`)
    }
  })

  // API endpoints without auth
  console.log('\n--- API Endpoints (No Auth) ---')
  await test('GET /api/sprints returns 401 without auth', async () => {
    const response = await fetchTest(`${BASE_URL}/api/sprints`)
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`)
    }
  })

  await test('GET /api/issues returns 401 without auth', async () => {
    const response = await fetchTest(`${BASE_URL}/api/issues`)
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`)
    }
  })

  await test('GET /api/epics returns 401 without auth', async () => {
    const response = await fetchTest(`${BASE_URL}/api/epics`)
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`)
    }
  })

  await test('POST /api/issues returns 401 without auth', async () => {
    const response = await fetchTest(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Issue',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }),
    })
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`)
    }
  })

  await test('POST /api/sprints returns 401 without auth', async () => {
    const response = await fetchTest(`${BASE_URL}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Sprint',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      }),
    })
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`)
    }
  })

  // Protected pages
  console.log('\n--- Protected Pages (Redirect to Login) ---')
  await test('GET /sprint redirects when unauthenticated', async () => {
    const response = await fetchTest(`${BASE_URL}/sprint`, { redirect: 'manual' })
    if (![302, 307, 401].includes(response.status)) {
      throw new Error(`Expected redirect or 401, got ${response.status}`)
    }
  })

  await test('GET /board redirects when unauthenticated', async () => {
    const response = await fetchTest(`${BASE_URL}/board`, { redirect: 'manual' })
    if (![302, 307, 401].includes(response.status)) {
      throw new Error(`Expected redirect or 401, got ${response.status}`)
    }
  })

  await test('GET /backlog redirects when unauthenticated', async () => {
    const response = await fetchTest(`${BASE_URL}/backlog`, { redirect: 'manual' })
    if (![302, 307, 401].includes(response.status)) {
      throw new Error(`Expected redirect or 401, got ${response.status}`)
    }
  })

  await test('GET /epics redirects when unauthenticated', async () => {
    const response = await fetchTest(`${BASE_URL}/epics`, { redirect: 'manual' })
    if (![302, 307, 401].includes(response.status)) {
      throw new Error(`Expected redirect or 401, got ${response.status}`)
    }
  })

  // API route health
  console.log('\n--- API Route Health ---')
  await test('GET /api/teams responds', async () => {
    const response = await fetchTest(`${BASE_URL}/api/teams`)
    if (![200, 401].includes(response.status)) {
      throw new Error(`Expected 200 or 401, got ${response.status}`)
    }
  })

  await test('GET /api/health (or 404) responds', async () => {
    const response = await fetchTest(`${BASE_URL}/api/health`)
    // Health endpoint may not exist, but server should respond
    if (![200, 404, 405].includes(response.status)) {
      throw new Error(`Unexpected status ${response.status}`)
    }
  })

  // Request handling
  console.log('\n--- Request Handling ---')
  await test('Handles malformed JSON gracefully', async () => {
    const response = await fetchTest(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json}',
    })
    if (![400, 401, 500].includes(response.status)) {
      throw new Error(`Expected error status, got ${response.status}`)
    }
  })

  await test('Response times are reasonable', async () => {
    const startTime = Date.now()
    await fetchTest(`${BASE_URL}/api/teams`)
    const duration = Date.now() - startTime
    if (duration > 5000) {
      throw new Error(`Response took ${duration}ms, expected < 5000ms`)
    }
  })

  await test('Handles concurrent requests', async () => {
    const promises = Array.from({ length: 5 }, () =>
      fetchTest(`${BASE_URL}/api/teams`)
    )
    const responses = await Promise.all(promises)
    for (const response of responses) {
      if (![200, 401].includes(response.status)) {
        throw new Error(`One of concurrent requests failed: ${response.status}`)
      }
    }
  })

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Test Summary')
  console.log('='.repeat(50))
  console.log(`✅ Passed: ${passCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log(`📈 Total:  ${passCount + failCount}`)
  console.log('='.repeat(50) + '\n')

  if (failCount > 0) {
    console.log('Failed Tests:')
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`  - ${r.name}`)
      if (r.error) console.log(`    ${r.error}`)
    })
    console.log()
    process.exit(1)
  } else {
    console.log('🎉 All tests passed!\n')
    process.exit(0)
  }
}

runTests().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
