'use client'

import { useState } from 'react'

interface DesignItemFormData {
  title: string
  description: string
  priority: string
  figmaLink: string
  assigneeId: string
  visualDesignerId: string
  teamId: string
  startDate: string
  endDate: string
  status?: string
}

interface User {
  id: string
  name: string | null
  email: string
}

interface Team {
  id: string
  name: string
  prefix: string
}

interface DesignItemFormProps {
  teams: Team[]
  users: User[]
  onSubmit: (data: DesignItemFormData) => Promise<void>
  onCancel: () => void
  initialData?: Partial<DesignItemFormData>
  isEditing?: boolean
  hideTeam?: boolean
}

export function DesignItemForm({
  teams,
  users,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
  hideTeam = false,
}: DesignItemFormProps) {
  const [formData, setFormData] = useState<DesignItemFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || '',
    figmaLink: initialData?.figmaLink || '',
    assigneeId: initialData?.assigneeId || '',
    visualDesignerId: initialData?.visualDesignerId || '',
    teamId: initialData?.teamId || (hideTeam && teams.length > 0 ? teams[0].id : ''),
    startDate: initialData?.startDate || '',
    endDate: initialData?.endDate || '',
    status: initialData?.status || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.title || formData.title.length < 3 || formData.title.length > 255) {
      newErrors.title = 'Title must be between 3 and 255 characters'
    }
    if (!hideTeam && !formData.teamId) {
      newErrors.teamId = 'Team is required'
    }
    if (formData.figmaLink && !formData.figmaLink.startsWith('http')) {
      newErrors.figmaLink = 'Must be a valid URL'
    }
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      newErrors.endDate = 'End date must be after start date'
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          placeholder="Design ticket title"
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
          placeholder="Design brief or notes"
          rows={3}
        />
      </div>

      {/* Status (edit mode only) */}
      {isEditing && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="DRAFT">Draft</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>
        </div>
      )}

      {/* Priority and Team */}
      <div className={`grid ${hideTeam ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
        <div>
          <label className="block text-sm font-medium text-gray-700">Priority</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">No priority</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {!hideTeam && (
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
        )}
      </div>

      {/* Assignee and Visual Designer */}
      <div className="grid grid-cols-2 gap-4">
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

        <div>
          <label className="block text-sm font-medium text-gray-700">Visual Designer</label>
          <select
            value={formData.visualDesignerId}
            onChange={(e) => setFormData({ ...formData, visualDesignerId: e.target.value })}
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
      </div>

      {/* Figma Link */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Figma Link</label>
        <input
          type="url"
          value={formData.figmaLink}
          onChange={(e) => setFormData({ ...formData, figmaLink: e.target.value })}
          className={`mt-1 w-full rounded border ${
            errors.figmaLink ? 'border-red-500' : 'border-gray-300'
          } px-3 py-2 text-sm focus:border-blue-500 focus:outline-none`}
          placeholder="https://figma.com/..."
        />
        {errors.figmaLink && <p className="mt-1 text-xs text-red-600">{errors.figmaLink}</p>}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className={`mt-1 w-full rounded border ${
              errors.endDate ? 'border-red-500' : 'border-gray-300'
            } px-3 py-2 text-sm focus:border-blue-500 focus:outline-none`}
          />
          {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
        </div>
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
          {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create Design Ticket'}
        </button>
      </div>
    </form>
  )
}
