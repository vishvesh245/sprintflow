'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Team {
  id: string
  name: string
  prefix: string
}

interface Sprint {
  id: string
  name: string
}

interface User {
  id: string
  name: string | null
  email: string
}

interface ParentTask {
  id: string
  displayId: string
  title: string
  type: string
}

export interface IssueFormData {
  title: string
  description: string
  type: string
  priority: string
  teamId: string
  sprintId: string
  assigneeId: string
  storyPoints: number
  /** Set for SUBTASK — the parent issue's UUID */
  parentIssueId: string
  /** Set for BUG — the task/story this bug tests (maps to testLinks in the API) */
  linkedTaskId: string
}

interface IssueFormProps {
  teams: Team[]
  sprints: Sprint[]
  users: User[]
  onSubmit: (data: IssueFormData) => Promise<void>
  onCancel: () => void
  initialData?: Partial<IssueFormData>
  isEditing?: boolean
}

/* ── Combobox for selecting a parent / linked task ── */
function ParentTaskCombobox({
  label,
  hint,
  tasks,
  loading,
  value,
  placeholder,
  onChange,
}: {
  label: string
  hint: string
  tasks: ParentTask[]
  loading: boolean
  value: string
  placeholder: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedTask = tasks.find((t) => t.id === value) || null

  // Filter tasks by search query (matches displayId or title)
  const filtered = tasks.filter((t) => {
    if (!query) return true
    const q = query.toLowerCase()
    return t.displayId.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIdx(-1)
  }, [query])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-combobox-item]')
      items[highlightIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIdx])

  const selectTask = useCallback(
    (id: string) => {
      onChange(id)
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    },
    [onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // total items = filtered tasks + 1 for the "none" option
    const totalItems = filtered.length + 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlightIdx((prev) => (prev < totalItems - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setHighlightIdx((prev) => (prev > 0 ? prev - 1 : totalItems - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (highlightIdx === 0) {
        selectTask('')
      } else if (highlightIdx > 0 && filtered[highlightIdx - 1]) {
        selectTask(filtered[highlightIdx - 1].id)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  // Display value in the input
  const displayValue = open
    ? query
    : selectedTask
      ? `[${selectedTask.displayId}] ${selectedTask.title}`
      : ''

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <label className="block text-sm font-semibold text-blue-800">{label}</label>
      <p className="mb-2 text-xs text-blue-600">{hint}</p>

      {loading ? (
        <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
          Loading tasks…
        </div>
      ) : (
        <div ref={wrapperRef} className="relative mt-1">
          {/* Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={displayValue}
              placeholder={placeholder}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => {
                if (!selectedTask) {
                  setQuery('')
                  setOpen(true)
                }
              }}
              onKeyDown={handleKeyDown}
              className="w-full rounded border border-blue-200 bg-white py-2 pl-3 pr-16 text-sm focus:border-blue-500 focus:outline-none"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {selectedTask && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    setQuery('')
                    inputRef.current?.focus()
                  }}
                  className="rounded p-0.5 text-gray-400 hover:text-blue-600"
                  title="Clear selection"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(!open)
                  if (!open) inputRef.current?.focus()
                }}
                className="rounded p-0.5 text-gray-400 hover:text-blue-600"
                title="Toggle list"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform ${open ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          </div>

          {/* Dropdown */}
          {open && (
            <div
              ref={listRef}
              className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              {/* "None" option */}
              <div
                data-combobox-item
                onClick={() => selectTask('')}
                className={`cursor-pointer px-3 py-2 text-sm italic text-gray-500 hover:bg-blue-50 ${
                  highlightIdx === 0 ? 'bg-blue-50' : ''
                } ${!value ? 'font-medium text-blue-600' : ''}`}
              >
                — No linked task (standalone)
              </div>

              {filtered.length === 0 && query ? (
                <div className="px-3 py-3 text-center text-xs text-gray-400">
                  No tasks match &ldquo;{query}&rdquo;
                </div>
              ) : (
                filtered.map((task, idx) => (
                  <div
                    key={task.id}
                    data-combobox-item
                    onClick={() => selectTask(task.id)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 ${
                      highlightIdx === idx + 1 ? 'bg-blue-50' : ''
                    } ${value === task.id ? 'bg-blue-100 font-medium' : ''}`}
                  >
                    <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-600">
                      {task.displayId}
                    </span>
                    <span className="truncate">{task.title}</span>
                    {value === task.id && (
                      <svg
                        className="ml-auto shrink-0 text-blue-600"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {tasks.length === 0 && !loading && (
        <p className="mt-1 text-xs text-gray-500">
          No tasks or stories found. Create one first if needed.
        </p>
      )}
    </div>
  )
}

export function IssueForm({
  teams,
  sprints,
  users,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
}: IssueFormProps) {
  const [formData, setFormData] = useState<IssueFormData>(
    initialData
      ? {
          title: initialData.title || '',
          description: initialData.description || '',
          type: initialData.type || 'TASK',
          priority: initialData.priority || 'MEDIUM',
          teamId: initialData.teamId || '',
          sprintId: initialData.sprintId || '',
          assigneeId: initialData.assigneeId || '',
          storyPoints: initialData.storyPoints || 0,
          parentIssueId: initialData.parentIssueId || '',
          linkedTaskId: initialData.linkedTaskId || '',
        }
      : {
          title: '',
          description: '',
          type: 'TASK',
          priority: 'MEDIUM',
          teamId: '',
          sprintId: '',
          assigneeId: '',
          storyPoints: 0,
          parentIssueId: '',
          linkedTaskId: '',
        }
  )

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Parent task list — loaded lazily when type is BUG or SUBTASK
  const [parentTasks, setParentTasks] = useState<ParentTask[]>([])
  const [loadingParentTasks, setLoadingParentTasks] = useState(false)

  const needsParentTask = formData.type === 'BUG' || formData.type === 'SUBTASK'

  useEffect(() => {
    if (!needsParentTask) {
      setParentTasks([])
      return
    }
    setLoadingParentTasks(true)
    Promise.all([
      fetch('/api/issues?type=TASK').then((r) => (r.ok ? r.json() : { data: [] })),
      fetch('/api/issues?type=STORY').then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([tasksRes, storiesRes]) => {
        const combined: ParentTask[] = [...(tasksRes.data || []), ...(storiesRes.data || [])].map((i: any) => ({
          id: i.id,
          displayId: i.displayId,
          title: i.title,
          type: i.type,
        }))
        // Sort by displayId
        combined.sort((a, b) => a.displayId.localeCompare(b.displayId))
        setParentTasks(combined)
      })
      .catch(() => setParentTasks([]))
      .finally(() => setLoadingParentTasks(false))
  }, [needsParentTask])

  // Clear parent/linked task when type changes away from BUG/SUBTASK
  const handleTypeChange = (newType: string) => {
    setFormData((prev) => ({
      ...prev,
      type: newType,
      parentIssueId: newType === 'SUBTASK' ? prev.parentIssueId : '',
      linkedTaskId: newType === 'BUG' ? prev.linkedTaskId : '',
    }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.title || formData.title.length < 3 || formData.title.length > 255) {
      newErrors.title = 'Title must be between 3 and 255 characters'
    }
    if (!formData.teamId) {
      newErrors.teamId = 'Team is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const parentFieldLabel =
    formData.type === 'SUBTASK' ? 'Parent Task' : 'Tests Task (optional)'
  const parentFieldHint =
    formData.type === 'SUBTASK'
      ? 'This subtask will be tracked under the selected task'
      : 'Link this bug to the task/story it was found in'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Title*</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className={`mt-1 w-full rounded border ${
            errors.title ? 'border-red-500' : 'border-gray-300'
          } px-3 py-2 text-sm focus:border-blue-500 focus:outline-none`}
          placeholder="Ticket title"
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="Ticket description"
          rows={3}
        />
      </div>

      {/* Type and Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Type*</label>
          <select
            value={formData.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="STORY">Story</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
            <option value="SUBTASK">Subtask</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Priority*</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* ── Parent / Linked Task combobox — shown for BUG and SUBTASK ── */}
      {needsParentTask && (
        <ParentTaskCombobox
          label={parentFieldLabel}
          hint={parentFieldHint}
          tasks={parentTasks}
          loading={loadingParentTasks}
          value={formData.type === 'SUBTASK' ? formData.parentIssueId : formData.linkedTaskId}
          placeholder={
            formData.type === 'SUBTASK'
              ? 'Search or select a parent task...'
              : 'Search or select a linked task...'
          }
          onChange={(id) =>
            setFormData((prev) =>
              prev.type === 'SUBTASK'
                ? { ...prev, parentIssueId: id }
                : { ...prev, linkedTaskId: id }
            )
          }
        />
      )}

      {/* Team and Sprint */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Team*</label>
          <select
            value={formData.teamId}
            onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
            className={`mt-1 w-full rounded border ${
              errors.teamId ? 'border-red-500' : 'border-gray-300'
            } px-3 py-2 text-sm focus:border-blue-500 focus:outline-none`}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.prefix})
              </option>
            ))}
          </select>
          {errors.teamId && <p className="mt-1 text-xs text-red-600">{errors.teamId}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Sprint</label>
          <select
            value={formData.sprintId}
            onChange={(e) => setFormData({ ...formData, sprintId: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">No sprint</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Assignee */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Assignee</label>
        <select
          value={formData.assigneeId}
          onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name || user.email}
            </option>
          ))}
        </select>
      </div>

      {/* Story Points */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Story Points</label>
        <input
          type="number"
          value={formData.storyPoints}
          onChange={(e) =>
            setFormData({ ...formData, storyPoints: parseInt(e.target.value) || 0 })
          }
          min="0"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Ticket' : 'Create Ticket'}
        </button>
      </div>
    </form>
  )
}
