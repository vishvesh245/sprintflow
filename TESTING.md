# SprintSync Test Suite

A comprehensive test suite for the SprintSync project covering unit tests, integration tests, validation tests, and smoke tests.

## Quick Start

### Installation

```bash
npm install
```

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (rerun tests on file changes)
npm run test:watch

# UI mode (interactive test viewer)
npm run test:ui

# Smoke tests (test against live server)
npm run test:smoke
```

## Test Structure

### 1. Unit Tests

#### `tests/validations/issue.test.ts`
Tests the Zod validation schema for creating issues.

**Coverage:**
- Title validation (3-255 characters)
- Issue type validation (STORY, TASK, BUG, SUBTASK)
- Priority validation (CRITICAL, HIGH, MEDIUM, LOW)
- Story points validation (positive integers only)
- Labels validation (array of strings)
- Required vs optional fields
- Edge cases (empty strings, boundary values)

**Run:** `npm test -- validations/issue.test.ts`

#### `tests/validations/sprint.test.ts`
Tests the Zod validation schemas for sprints.

**Coverage:**
- Sprint name validation
- Date validation (endDate must be after startDate)
- Date coercion (strings, timestamps)
- Complete sprint schema with issue actions
- Action types (backlog, next_sprint)

**Run:** `npm test -- validations/sprint.test.ts`

### 2. API Integration Tests

#### `tests/api/sprints.test.ts`
Tests sprint API endpoints.

**Coverage:**
- `GET /api/sprints` - fetch list with filters
- `POST /api/sprints` - create new sprint
  - Validates endDate > startDate
  - Prevents multiple ACTIVE sprints
  - Rejects overlapping sprint dates
- `PATCH /api/sprints/[id]` - update sprint status
  - PLANNING → ACTIVE transitions
  - State machine enforcement (no direct PLANNING → COMPLETED)
- `POST /api/sprints/[id]/complete` - complete sprint
  - Move incomplete issues to backlog
  - Move issues to next sprint

**Run:** `npm test -- api/sprints.test.ts`

#### `tests/api/issues.test.ts`
Tests issue API endpoints.

**Coverage:**
- `GET /api/issues` - fetch with filters
  - Filter by sprintId, teamId, status
  - Backlog filtering (sprintId=null)
  - Never returns soft-deleted issues
- `POST /api/issues` - create new issue
  - Title length validation (3-255 chars)
  - QA team requires test links for non-TASK issues
  - Allows QA TASKs without test links
  - Team existence validation
- `DELETE /api/issues/[id]` - soft-delete
  - Sets deletedAt timestamp
  - Data not removed from database

**Run:** `npm test -- api/issues.test.ts`

#### `tests/api/epics.test.ts`
Tests epic API endpoints.

**Coverage:**
- `GET /api/epics` - fetch all epics with progress
  - Progress calculation (% done)
  - Per-team progress breakdown
  - Status filtering (ACTIVE, COMPLETED, CANCELLED)
- `POST /api/epics` - create new epic
  - Requires title
  - Optional description and status
- `PATCH /api/epics/[id]` - update epic
  - Status transitions
  - Metadata updates
- Progress metrics
  - Overall progress percentage
  - Per-team issue counts
  - Done vs total issue counts

**Run:** `npm test -- api/epics.test.ts`

#### `tests/api/links.test.ts`
Tests issue linking (cross-team dependencies).

**Coverage:**
- `POST /api/issues/[id]/links` - create links
  - BLOCKS link creates auto-inverse BLOCKED_BY
  - TESTS link creates auto-inverse TESTED_BY
  - Circular dependency detection (BLOCKS)
  - Prevents A blocks B, B blocks A scenarios
- `DELETE /api/issues/[id]/links` - delete links
  - Removes link and its inverse
  - Handles all link types correctly
- Link type behaviors
  - RELATES_TO (no circular restriction)
  - DUPLICATES (no circular restriction)

**Run:** `npm test -- api/links.test.ts`

### 3. Smoke Tests

#### `tests/smoke.test.ts`
Vitest-based smoke tests against a live server.

**Coverage:**
- Server connectivity
- Public pages load (200 status)
- Auth-protected APIs return 401
- Protected pages redirect
- Response times
- Concurrent request handling

**Requires:** Running server at `http://localhost:3000`

**Run:** `npm test -- smoke.test.ts`

#### `tests/smoke.js`
Pure Node.js smoke tests (no test framework).

**Coverage:**
- Public page availability
- API auth enforcement
- Page redirects
- Route health
- Server responsiveness
- Concurrent request handling

**Run:** `npm run test:smoke`

**Output Example:**
```
✅ PASS: GET /login returns 200
✅ PASS: GET /api/sprints returns 401 without auth
❌ FAIL: GET /board redirects when unauthenticated
   Error: Expected redirect or 401, got 200
📊 Test Summary
✅ Passed: 18
❌ Failed: 1
📈 Total:  19
```

## Test Configuration

### `vitest.config.ts`
Main Vitest configuration.

**Settings:**
- Environment: Node.js (no DOM required)
- Test file patterns: `src/**/*.test.ts`, `tests/**/*.test.ts`
- Global test setup: `tests/setup.ts`
- Coverage reporter: text, json, html

### `tests/setup.ts`
Global test setup and mocking.

**Mocks:**
- `next-auth` → returns test user session
- `@/lib/auth` → returns test user session
- `@/lib/prisma` → returns mock PrismaClient with test data

**Environment:**
```
DATABASE_URL=postgresql://test:test@localhost:5432/sprintsync_test
AUTH_SECRET=test-secret-key-for-testing-only
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=test
```

## Running Specific Tests

### By file:
```bash
npm test -- sprints.test.ts
npm test -- issues.test.ts
npm test -- epics.test.ts
```

### By pattern:
```bash
npm test -- api/
npm test -- validations/
npm test -- --grep "QA team"
```

### Watch specific file:
```bash
npm run test:watch -- issues.test.ts
```

## Test Coverage

To generate coverage report:

```bash
npm test -- --coverage
```

Coverage files are created in the default Vitest coverage directory.

## Mocked Data

All tests use mocked Prisma client. Mock data includes:

- Teams: Frontend (FE), Backend (BE), QA
- Sprints: Planning, Active, and Completed states
- Issues: Various types, priorities, and statuses
- Epics: With issue associations
- Users: Test user (test-user-id) with session

## Common Test Patterns

### Testing validation:
```typescript
const result = createIssueSchema.safeParse(invalidData)
expect(result.success).toBe(false)
expect(result.error?.issues[0].message).toContain('expected text')
```

### Testing API endpoints:
```typescript
const response = await mockPOST(request)
expect(response.status).toBe(201)
expect(vi.mocked(prisma.issue.create)).toHaveBeenCalled()
```

### Testing authorization:
```typescript
vi.mocked(auth).mockResolvedValueOnce(null)
const response = await mockGET(request)
expect(response.status).toBe(401)
```

## Continuous Integration

For CI/CD pipelines:

```bash
# Run all tests (fail if any fail)
npm test

# Generate coverage report
npm test -- --coverage

# Run only smoke tests against staging server
npm run test:smoke
```

## Troubleshooting

### Tests timeout
Increase timeout in vitest.config.ts:
```typescript
test: {
  testTimeout: 10000, // 10 seconds
}
```

### Mock not working
Ensure mocks are defined in `tests/setup.ts` and test file imports match mock paths.

### Smoke tests fail
- Check server is running: `npm run dev`
- Verify `http://localhost:3000` is accessible
- Check for port conflicts

## Adding New Tests

1. Create test file in appropriate directory:
   - API tests: `tests/api/[feature].test.ts`
   - Validation tests: `tests/validations/[schema].test.ts`
   - Unit tests: `src/[module].test.ts`

2. Import testing utilities:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

3. Follow existing test patterns for consistency

4. Run: `npm test -- [feature].test.ts`

## Best Practices

1. **Test isolation**: Each test should be independent
2. **Clear names**: Describe what the test validates
3. **Arrange-Act-Assert**: Structure tests with clear phases
4. **Mock external dependencies**: Use vi.mock() for external services
5. **Edge cases**: Test boundary values and error conditions
6. **Coverage**: Aim for >80% coverage of critical paths

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Zod Validation](https://zod.dev/)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)
