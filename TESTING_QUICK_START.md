# SprintSync Testing - Quick Start Guide

## ⚠️ Important: Run Commands from Your Mac Terminal

The Next.js dev server must be started from **your Mac terminal**, not through the AI assistant.
This is because the SWC compiler binary (`swc-darwin-arm64`) only works on macOS, not the Linux VM.

## 5-Minute Setup

### 1. Open your Mac terminal and navigate to the project folder

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Dev Server (keep this terminal open)
```bash
npm run dev
```
App will be at http://localhost:3000

### 4. In a second Mac terminal, run the tests
```bash
# Quick smoke tests (server must be running)
npm run test:smoke

# Full unit test suite (mocked - no server needed)
npm test
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Rerun tests on file changes (development) |
| `npm run test:ui` | Interactive test viewer in browser |
| `npm run test:smoke` | Test live server at localhost:3000 |
| `npm test -- sprints.test.ts` | Run specific test file |
| `npm test -- --grep "QA team"` | Run tests matching pattern |

## Test Anatomy

### Simple Test
```typescript
it('should validate title length', () => {
  const data = {
    title: 'A', // Too short
    type: 'TASK',
    priority: 'MEDIUM',
    teamId: 'team-1',
  }

  const result = createIssueSchema.safeParse(data)
  expect(result.success).toBe(false)
})
```

### API Test
```typescript
it('should create issue with valid data', async () => {
  const body = {
    title: 'New Issue',
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
})
```

## Test Files

### Unit Tests (Pure validation)
- `tests/validations/issue.test.ts` - Issue schema validation
- `tests/validations/sprint.test.ts` - Sprint schema validation

### Integration Tests (API mocking)
- `tests/api/sprints.test.ts` - Sprint endpoints
- `tests/api/issues.test.ts` - Issue endpoints
- `tests/api/epics.test.ts` - Epic endpoints
- `tests/api/links.test.ts` - Issue link endpoints

### Smoke Tests (Live server)
- `tests/smoke.test.ts` - Vitest-based
- `tests/smoke.js` - Pure Node.js, run with `npm run test:smoke`

## What Tests Cover

### Sprints
- Creating sprints (validation, constraints)
- Fetching sprints (filtering by status)
- Updating sprint status (state machine)
- Completing sprints (issue handling)
- Date validation (endDate > startDate)

### Issues
- Creating issues (validation, team checking)
- Filtering issues (by sprint, team, status, backlog)
- QA team test link requirements
- Soft-delete (sets deletedAt, not removed from DB)
- Never returns soft-deleted issues

### Epics
- Creating epics (title requirement)
- Fetching with progress metrics
- Calculating progress (overall and per-team)
- Status updates

### Links
- Creating cross-team dependencies (BLOCKS, TESTS, etc.)
- Auto-creating inverse links (BLOCKED_BY, TESTED_BY)
- Circular dependency detection
- Deleting links and their inverses

## Debug a Test

### Run single test
```bash
npm test -- sprints.test.ts
```

### Watch and rerun
```bash
npm run test:watch -- sprints.test.ts
```

### Use test name matching
```bash
npm test -- --grep "should reject if endDate"
```

### Add console.log
```typescript
it('should work', async () => {
  const response = await mockPOST(request)
  console.log('Response:', response.status)
  expect(response.status).toBe(201)
})
```

## Mock Data Available

All tests have access to mocked data:

```typescript
createMockUser()           // Test user
createMockTeam()           // Test team (Frontend)
createMockSprint()         // Test sprint
createMockIssue()          // Test issue
createMockEpic()           // Test epic
createMockIssueLink()      // Test link

// In test:
const user = createMockUser({ email: 'custom@test.com' })
```

## Common Assertions

```typescript
// Response status
expect(response.status).toBe(201)
expect([200, 201]).toContain(response.status)

// Validation
expect(result.success).toBe(true)
expect(result.success).toBe(false)
expect(result.error?.issues[0].message).toContain('at least 3')

// Data
expect(data.title).toBe('Expected Title')
expect(data.issues).toHaveLength(5)

// Mocks
expect(vi.mocked(prisma.issue.create)).toHaveBeenCalled()
expect(vi.mocked(prisma.issue.create)).toHaveBeenCalledWith(
  expect.objectContaining({ data: { title: 'Test' } })
)
```

## Test Server (Smoke Tests)

For `npm run test:smoke`, start the server first:
```bash
npm run dev
# In another terminal
npm run test:smoke
```

Tests check:
- Public pages load (200)
- Auth-protected APIs return 401
- Protected pages redirect
- Server responsiveness

## Adding a New Test

### 1. Create file
```bash
touch tests/api/myfeature.test.ts
```

### 2. Add imports
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
```

### 3. Write tests
```typescript
describe('My Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something', async () => {
    // Arrange
    const data = { /* ... */ }

    // Act
    const result = await someFunction(data)

    // Assert
    expect(result).toBe(expected)
  })
})
```

### 4. Run
```bash
npm test -- myfeature.test.ts
```

## Troubleshooting

### Tests timeout
Add to test:
```typescript
it('test name', async () => {
  // test code
}, 10000) // 10 second timeout
```

### Mock not working
Check `tests/setup.ts` for mock definition. You can override per test:
```typescript
vi.mocked(auth).mockResolvedValueOnce(null)
```

### Can't find module
Check path alias in `vitest.config.ts`:
```typescript
alias: {
  '@': path.resolve(__dirname, './src'),
}
```

### Smoke tests fail
1. Start dev server: `npm run dev`
2. Check localhost:3000 is accessible
3. No port conflicts
4. Run: `npm run test:smoke`

## Coverage Report

Generate HTML coverage report:
```bash
npm test -- --coverage
```

Open `coverage/index.html` in browser to see detailed results.

## CI/CD Integration

### GitHub Actions
```yaml
- name: Install
  run: npm ci

- name: Test
  run: npm test

- name: Coverage
  run: npm test -- --coverage
```

### Pre-commit Hook
Add to `.husky/pre-commit`:
```bash
npm test
```

## Performance Tips

- Use `npm run test:watch` during development
- Only run affected tests: `npm test -- [file.test.ts]`
- Smoke tests take longer (they hit real server)
- Unit tests are very fast (< 1 second each)

## Resources

- Full guide: `TESTING.md`
- Test summary: `TEST_SUITE_SUMMARY.md`
- Vitest docs: https://vitest.dev/
- Zod docs: https://zod.dev/

## Next Steps

1. Run `npm test` to verify setup
2. Explore test files to understand patterns
3. Add tests when creating new features
4. Use `npm run test:watch` during development
5. Run `npm test` before committing code
