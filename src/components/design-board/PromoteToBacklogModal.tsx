'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { DesignItem } from '@/hooks/useDesignItems'

interface Team {
  id: string
  name: string
  prefix: string
}

interface PromoteToBacklogModalProps {
  item: DesignItem
  teams: Team[]
  onPromote: (data: {
    designItemId: string
    targetTeamId: string
    title: string
    description: string
    type: 'STORY' | 'TASK'
    priority: string
  }) => Promise<void>
  onClose: () => void
}

export function PromoteToBacklogModal({
  item,
  teams,
  onPromote,
  onClose,
}: PromoteToBacklogModalProps) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description || '')
  const [targetTeamId, setTargetTeamId] = useState('')
  const [type, setType] = useState<'STORY' | 'TASK'>('TASK')
  const [priority, setPriority] = useState<string>(item.priority || 'MEDIUM')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetTeamId) {
      setError('Please select a target team')
      return
    }
    if (!title || title.length < 3) {
      setError('Title must be at least 3 characters')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onPromote({
        designItemId: item.id,
        targetTeamId,
        title,
        description,
        type,
        priority,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Promote to Engineering Backlog</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {item.figmaLink && (
            <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
              <span className="text-xs font-medium text-purple-700">Figma: </span>
              <a
                href={item.figmaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-600 hover:underline break-all"
              >
                {item.figmaLink}
              </a>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Title*</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              rows={3}
            />
          </div>

          {/* Target Team and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Team*</label>
              <select
                value={targetTeamId}
                onChange={(e) => setTargetTeamId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.prefix})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Issue Type*</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'STORY' | 'TASK')}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="TASK">Task</option>
                <option value="STORY">Story</option>
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Promoting...' : 'Promote to Backlog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
