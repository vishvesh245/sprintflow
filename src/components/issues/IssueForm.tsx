'use client'

import { useState, useEffect } from 'react'

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
      fetch('/api/issues?type=TASK').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/issues?type=STORY').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([tasks, stories]) => {
        const combined: ParentTask[] = [...tasks, ...stories].map((i: any) => ({
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
          placeholder="Issue title"
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
          placeholder="Issue description"
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

      {/* ── Parent / Linked Task dropdown — shown for BUG and SUBTASK ── */}
      {needsParentTask && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <label className="block text-sm font-semibold text-blue-800">
            {parentFieldLabel}
          </label>
          <p className="mb-2 text-xs text-blue-600">{parentFieldHint}</p>
          {loadingParentTasks ? (
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
              Loading tasks…
            </div>
          ) : (
            <select
              value={formData.type === 'SUBTASK' ? formData.parentIssueId : formData.linkedTaskId}
              onChange={(e) =>
                setFormData(
                  formData.type === 'SUBTASK'
                    ? { ...formData, parentIssueId: e.target.value }
                    : { ...formData, linkedTaskId: e.target.value }
                )
              }
              className="mt-1 w-full rounded border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">
                {formData.type === 'SUBTASK'
                  ? '— No parent task (standalone subtask)'
                  : '— No linked task (standalone bug)'}
              </option>
              {parentTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  [{task.displayId}] {task.title}
                </option>
              ))}
            </select>
          )}
          {parentTasks.length === 0 && !loadingParentTasks && (
            <p className="mt-1 text-xs text-gray-500">
              No tasks or stories found. Create one first if needed.
            </p>
          )}
        </div>
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
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Issue' : 'Create Issue'}
        </button>
      </div>
    </form>
  )
}
