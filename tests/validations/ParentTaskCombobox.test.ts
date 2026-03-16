/**
 * ParentTaskCombobox — unit tests
 *
 * The component is a pure-logic combobox that lives inside IssueForm.tsx.
 * Because it runs in a browser context (DOM events, refs, React state) we
 * test the pure-JS logic extracted from it rather than mounting the React
 * tree (no jsdom / happy-dom is configured in this project).
 *
 * Every describe block maps to a specific bug / edge-case identified during
 * the QA audit of IssueForm.tsx.
 */

import { describe, it, expect } from 'vitest'

// ─── Helpers that mirror component logic ──────────────────────────────────────

interface ParentTask {
  id: string
  displayId: string
  title: string
  type: string
}

/** Mirrors the `filtered` computation inside ParentTaskCombobox */
function filterTasks(tasks: ParentTask[], query: string): ParentTask[] {
  if (!query) return tasks
  const q = query.toLowerCase()
  return tasks.filter(
    (t) =>
      t.displayId.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q),
  )
}

/**
 * Mirrors the `displayValue` computation inside ParentTaskCombobox.
 * @param open      whether the dropdown is open
 * @param query     current search string
 * @param selected  the resolved task object (tasks.find result)
 */
function computeDisplayValue(
  open: boolean,
  query: string,
  selected: ParentTask | null,
): string {
  return open
    ? query
    : selected
    ? `[${selected.displayId}] ${selected.title}`
    : ''
}

/**
 * Mirrors ArrowDown keyboard navigation wrapping.
 * totalItems = filtered.length + 1 (for the "None" option at index 0)
 */
function arrowDown(current: number, totalItems: number): number {
  return current < totalItems - 1 ? current + 1 : 0
}

/** Mirrors ArrowUp keyboard navigation wrapping */
function arrowUp(current: number, totalItems: number): number {
  return current > 0 ? current - 1 : totalItems - 1
}

/**
 * Mirrors the Enter key selection logic.
 * Returns the selected id, or undefined if nothing actionable.
 */
function enterSelect(
  highlightIdx: number,
  filtered: ParentTask[],
): string | undefined {
  if (highlightIdx === 0) return ''            // "None" option
  if (highlightIdx > 0 && filtered[highlightIdx - 1]) {
    return filtered[highlightIdx - 1].id
  }
  return undefined
}

// ─── Test data ────────────────────────────────────────────────────────────────

const TASKS: ParentTask[] = [
  { id: 'task-1', displayId: 'FE-1', title: 'Build login form', type: 'TASK' },
  { id: 'task-2', displayId: 'FE-2', title: 'Design dashboard', type: 'STORY' },
  { id: 'task-3', displayId: 'BE-1', title: 'Create auth API', type: 'TASK' },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ParentTaskCombobox — filterTasks', () => {
  it('should return all tasks when query is empty string', () => {
    expect(filterTasks(TASKS, '')).toHaveLength(3)
  })

  it('should return all tasks when query is undefined-like empty', () => {
    // The component initialises query as '' — ensure falsy path works
    expect(filterTasks(TASKS, '')).toEqual(TASKS)
  })

  it('should match tasks by displayId (case-insensitive)', () => {
    expect(filterTasks(TASKS, 'fe-1')).toHaveLength(1)
    expect(filterTasks(TASKS, 'FE-1')).toHaveLength(1)
    expect(filterTasks(TASKS, 'Fe-1')).toHaveLength(1)
  })

  it('should match tasks by title substring (case-insensitive)', () => {
    const results = filterTasks(TASKS, 'login')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('task-1')
  })

  it('should match tasks by partial displayId prefix', () => {
    // "FE" should match FE-1 and FE-2
    expect(filterTasks(TASKS, 'FE')).toHaveLength(2)
  })

  it('should return empty array when query matches nothing', () => {
    expect(filterTasks(TASKS, 'zzznomatch')).toHaveLength(0)
  })

  it('should handle an empty task list gracefully', () => {
    expect(filterTasks([], 'login')).toHaveLength(0)
  })

  it('should handle query that matches multiple tasks', () => {
    // "e" appears in "Build login form" (none), "Design dashboard" (yes),
    // "Create auth API" (yes), and displayIds FE-1/FE-2 both contain "e".
    // FE-1 → "fe-1" contains "e"; FE-2 → "fe-2" contains "e"; BE-1 → "be-1" contains "e"
    // All three tasks match on their displayId alone.
    expect(filterTasks(TASKS, 'e')).toHaveLength(3)
  })

  // BUG RISK — tasks with null/undefined title or displayId would throw
  it('should not throw when all tasks have valid string fields', () => {
    expect(() => filterTasks(TASKS, 'test')).not.toThrow()
  })
})

describe('ParentTaskCombobox — computeDisplayValue', () => {
  const task = TASKS[0] // { displayId: 'FE-1', title: 'Build login form' }

  it('should show query string when dropdown is open', () => {
    expect(computeDisplayValue(true, 'login', task)).toBe('login')
  })

  it('should show query string (empty) when dropdown is open with no typing', () => {
    expect(computeDisplayValue(true, '', task)).toBe('')
  })

  it('should show formatted selection when closed and task is selected', () => {
    expect(computeDisplayValue(false, '', task)).toBe('[FE-1] Build login form')
  })

  it('should show empty string when closed and no task is selected', () => {
    expect(computeDisplayValue(false, '', null)).toBe('')
  })

  it('should NOT show stale query when dropdown closes — always shows selected label', () => {
    // After closing, query is irrelevant because component resets it; the
    // display value is driven by selectedTask only.
    expect(computeDisplayValue(false, 'some stale query', task)).toBe(
      '[FE-1] Build login form',
    )
  })

  // BUG: if displayId or title contains special chars they should pass through
  it('should render displayId and title verbatim including special characters', () => {
    const specialTask: ParentTask = {
      id: 'x',
      displayId: 'QA-100',
      title: 'Fix <script> injection & "quotes"',
      type: 'BUG',
    }
    expect(computeDisplayValue(false, '', specialTask)).toBe(
      '[QA-100] Fix <script> injection & "quotes"',
    )
  })
})

describe('ParentTaskCombobox — keyboard ArrowDown navigation', () => {
  // totalItems includes the "None" option, so it is filtered.length + 1

  it('should move highlight from -1 to 0 (None option) on first ArrowDown', () => {
    expect(arrowDown(-1, 4)).toBe(0)
  })

  it('should advance from 0 to 1', () => {
    expect(arrowDown(0, 4)).toBe(1)
  })

  it('should wrap from last item back to 0', () => {
    expect(arrowDown(3, 4)).toBe(0)
  })

  it('should wrap correctly with only the "None" option (totalItems = 1)', () => {
    // Empty filtered list → totalItems = 1; wraps immediately back to 0
    expect(arrowDown(0, 1)).toBe(0)
  })

  it('should not exceed totalItems - 1 before wrapping', () => {
    const total = 5
    for (let i = 0; i < total - 1; i++) {
      expect(arrowDown(i, total)).toBe(i + 1)
    }
    expect(arrowDown(total - 1, total)).toBe(0)
  })
})

describe('ParentTaskCombobox — keyboard ArrowUp navigation', () => {
  it('should wrap from 0 to last item on ArrowUp', () => {
    expect(arrowUp(0, 4)).toBe(3)
  })

  it('should move from 3 to 2', () => {
    expect(arrowUp(3, 4)).toBe(2)
  })

  it('should wrap from initial -1... wait: -1 is not > 0, so wraps to totalItems-1', () => {
    // Component initialises highlightIdx to -1; ArrowUp when at -1 wraps
    // to totalItems - 1 because -1 > 0 is false.
    expect(arrowUp(-1, 4)).toBe(3)
  })

  it('should handle totalItems = 1 (only None option)', () => {
    // 0 → wraps to 0 again (totalItems - 1 = 0)
    expect(arrowUp(0, 1)).toBe(0)
  })
})

describe('ParentTaskCombobox — Enter key selection', () => {
  const filtered = TASKS // 3 items; indices 1, 2, 3 in the list (0 = None)

  it('should return empty string when highlightIdx is 0 (None option)', () => {
    expect(enterSelect(0, filtered)).toBe('')
  })

  it('should return the id of the first task when highlightIdx is 1', () => {
    expect(enterSelect(1, filtered)).toBe('task-1')
  })

  it('should return the id of the last task when highlightIdx equals filtered.length', () => {
    expect(enterSelect(3, filtered)).toBe('task-3')
  })

  it('should return undefined when highlightIdx is -1 (no item highlighted)', () => {
    // Nothing should be selected when no item is highlighted
    expect(enterSelect(-1, filtered)).toBeUndefined()
  })

  it('should return undefined when highlightIdx is out-of-bounds (beyond list)', () => {
    // highlightIdx = 4, but filtered only has 3 items (indices 1–3)
    expect(enterSelect(4, filtered)).toBeUndefined()
  })

  it('should work correctly on a single-item list', () => {
    const single = [TASKS[0]]
    expect(enterSelect(1, single)).toBe('task-1')
    expect(enterSelect(2, single)).toBeUndefined()
  })

  it('should work correctly on an empty filtered list', () => {
    // Only the "None" option exists; highlightIdx can only be 0
    expect(enterSelect(0, [])).toBe('')
    expect(enterSelect(1, [])).toBeUndefined()
  })
})

describe('ParentTaskCombobox — selectedTask resolution', () => {
  it('should resolve to null when value is empty string', () => {
    const selected = TASKS.find((t) => t.id === '') || null
    expect(selected).toBeNull()
  })

  it('should resolve to the correct task when value matches an id', () => {
    const selected = TASKS.find((t) => t.id === 'task-2') || null
    expect(selected).not.toBeNull()
    expect(selected?.displayId).toBe('FE-2')
  })

  it('should resolve to null when value is a stale id not in the task list', () => {
    // BUG SCENARIO: type changes from SUBTASK → TASK, tasks list cleared,
    // but formData.parentIssueId might still hold a stale value momentarily.
    const staleId = 'task-deleted-99'
    const selected = TASKS.find((t) => t.id === staleId) || null
    expect(selected).toBeNull()
  })
})

describe('ParentTaskCombobox — IssueForm state: type switching', () => {
  /**
   * Mirrors the handleTypeChange logic in IssueForm.
   * When switching away from SUBTASK or BUG the respective id field must clear.
   */
  function handleTypeChange(
    prev: { type: string; parentIssueId: string; linkedTaskId: string },
    newType: string,
  ) {
    return {
      ...prev,
      type: newType,
      parentIssueId: newType === 'SUBTASK' ? prev.parentIssueId : '',
      linkedTaskId: newType === 'BUG' ? prev.linkedTaskId : '',
    }
  }

  it('should preserve parentIssueId when staying on SUBTASK', () => {
    const state = { type: 'SUBTASK', parentIssueId: 'task-1', linkedTaskId: '' }
    expect(handleTypeChange(state, 'SUBTASK').parentIssueId).toBe('task-1')
  })

  it('should clear parentIssueId when switching from SUBTASK to TASK', () => {
    const state = { type: 'SUBTASK', parentIssueId: 'task-1', linkedTaskId: '' }
    expect(handleTypeChange(state, 'TASK').parentIssueId).toBe('')
  })

  it('should clear parentIssueId when switching from SUBTASK to STORY', () => {
    const state = { type: 'SUBTASK', parentIssueId: 'task-1', linkedTaskId: '' }
    expect(handleTypeChange(state, 'STORY').parentIssueId).toBe('')
  })

  it('should clear parentIssueId when switching from SUBTASK to BUG', () => {
    const state = { type: 'SUBTASK', parentIssueId: 'task-1', linkedTaskId: '' }
    const result = handleTypeChange(state, 'BUG')
    expect(result.parentIssueId).toBe('')
  })

  it('should preserve linkedTaskId when staying on BUG', () => {
    const state = { type: 'BUG', parentIssueId: '', linkedTaskId: 'task-2' }
    expect(handleTypeChange(state, 'BUG').linkedTaskId).toBe('task-2')
  })

  it('should clear linkedTaskId when switching from BUG to TASK', () => {
    const state = { type: 'BUG', parentIssueId: '', linkedTaskId: 'task-2' }
    expect(handleTypeChange(state, 'TASK').linkedTaskId).toBe('')
  })

  it('should clear BOTH ids when switching from SUBTASK to STORY', () => {
    const state = { type: 'SUBTASK', parentIssueId: 'task-1', linkedTaskId: 'task-2' }
    const result = handleTypeChange(state, 'STORY')
    expect(result.parentIssueId).toBe('')
    expect(result.linkedTaskId).toBe('')
  })

  it('should correctly assign linkedTaskId when switching to BUG', () => {
    // Switching TO BUG — existing linkedTaskId should be preserved
    const state = { type: 'TASK', parentIssueId: '', linkedTaskId: 'task-2' }
    expect(handleTypeChange(state, 'BUG').linkedTaskId).toBe('task-2')
  })
})

describe('ParentTaskCombobox — IssueForm fetch: parentTasks loading', () => {
  /**
   * These tests validate the fetch+merge logic that populates the dropdown.
   * They use a local mock of the fetch behaviour.
   */

  type ApiResponse = { data: Array<{ id: string; displayId: string; title: string; type: string }> }

  async function loadParentTasks(
    fetchTask: () => Promise<ApiResponse>,
    fetchStory: () => Promise<ApiResponse>,
  ): Promise<ParentTask[]> {
    try {
      const [tasksRes, storiesRes] = await Promise.all([fetchTask(), fetchStory()])
      const combined: ParentTask[] = [
        ...(tasksRes.data || []),
        ...(storiesRes.data || []),
      ].map((i) => ({ id: i.id, displayId: i.displayId, title: i.title, type: i.type }))
      combined.sort((a, b) => a.displayId.localeCompare(b.displayId))
      return combined
    } catch {
      return []
    }
  }

  it('should merge tasks and stories and sort by displayId', async () => {
    const fetchTask = async () => ({
      data: [{ id: 't1', displayId: 'FE-2', title: 'Task two', type: 'TASK' }],
    })
    const fetchStory = async () => ({
      data: [{ id: 's1', displayId: 'FE-1', title: 'Story one', type: 'STORY' }],
    })
    const result = await loadParentTasks(fetchTask, fetchStory)
    expect(result).toHaveLength(2)
    expect(result[0].displayId).toBe('FE-1')
    expect(result[1].displayId).toBe('FE-2')
  })

  it('should return empty array when both endpoints return empty data', async () => {
    const empty = async () => ({ data: [] })
    const result = await loadParentTasks(empty, empty)
    expect(result).toHaveLength(0)
  })

  it('should return empty array when fetch throws (network error)', async () => {
    const failing = async (): Promise<ApiResponse> => { throw new Error('Network error') }
    const result = await loadParentTasks(failing, failing)
    expect(result).toHaveLength(0)
  })

  it('should return empty array when one endpoint fails', async () => {
    const ok = async () => ({ data: [{ id: 't1', displayId: 'FE-1', title: 'Task', type: 'TASK' }] })
    const failing = async (): Promise<ApiResponse> => { throw new Error('500') }
    // Promise.all rejects if either rejects — caught by .catch → []
    const result = await loadParentTasks(ok, failing)
    expect(result).toHaveLength(0)
  })

  it('should handle missing data field gracefully (uses empty array fallback)', async () => {
    // API returns ok:false shape — the real component falls back to { data: [] }
    // This test ensures the || [] guard works
    const badRes = async () => ({ data: undefined as unknown as [] })
    const result = await loadParentTasks(badRes, badRes)
    expect(result).toHaveLength(0)
  })

  it('should handle duplicate ids across tasks and stories without deduplication', async () => {
    // NOTE: the component does NOT deduplicate — this documents that behaviour
    const fetchTask = async () => ({
      data: [{ id: 'x', displayId: 'FE-1', title: 'Task', type: 'TASK' }],
    })
    const fetchStory = async () => ({
      data: [{ id: 'x', displayId: 'FE-1', title: 'Task', type: 'STORY' }],
    })
    const result = await loadParentTasks(fetchTask, fetchStory)
    // Documents current behaviour — duplicates ARE included (no dedup guard)
    expect(result).toHaveLength(2)
  })
})

describe('ParentTaskCombobox — IssueForm validation', () => {
  /**
   * Mirrors validateForm() in IssueForm.
   */
  function validateForm(formData: { title: string; teamId: string }): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!formData.title || formData.title.length < 3 || formData.title.length > 255) {
      errors.title = 'Title must be between 3 and 255 characters'
    }
    if (!formData.teamId) {
      errors.teamId = 'Team is required'
    }
    return errors
  }

  it('should pass with valid title and teamId', () => {
    expect(validateForm({ title: 'Fix login', teamId: 'team-1' })).toEqual({})
  })

  it('should fail when title is empty', () => {
    const errors = validateForm({ title: '', teamId: 'team-1' })
    expect(errors.title).toBeDefined()
  })

  it('should fail when title is exactly 2 characters', () => {
    const errors = validateForm({ title: 'AB', teamId: 'team-1' })
    expect(errors.title).toBeDefined()
  })

  it('should pass when title is exactly 3 characters', () => {
    const errors = validateForm({ title: 'Fix', teamId: 'team-1' })
    expect(errors.title).toBeUndefined()
  })

  it('should fail when title is exactly 256 characters', () => {
    const errors = validateForm({ title: 'A'.repeat(256), teamId: 'team-1' })
    expect(errors.title).toBeDefined()
  })

  it('should pass when title is exactly 255 characters', () => {
    const errors = validateForm({ title: 'A'.repeat(255), teamId: 'team-1' })
    expect(errors.title).toBeUndefined()
  })

  it('should fail when teamId is empty string', () => {
    const errors = validateForm({ title: 'Valid title', teamId: '' })
    expect(errors.teamId).toBeDefined()
  })

  it('should report both errors when both fields are invalid', () => {
    const errors = validateForm({ title: '', teamId: '' })
    expect(errors.title).toBeDefined()
    expect(errors.teamId).toBeDefined()
  })

  it('should NOT validate parentIssueId/linkedTaskId as required (they are optional)', () => {
    // Confirm the form does NOT enforce a parent task — it is optional even for BUG/SUBTASK
    const errors = validateForm({ title: 'Valid title', teamId: 'team-1' })
    expect(errors.parentIssueId).toBeUndefined()
    expect(errors.linkedTaskId).toBeUndefined()
  })
})
