'use client'

import { useEffect, useState } from 'react'
import { EpicCard } from '@/components/epics/EpicCard'
import { ProgressSlideLoader } from '@/components/ui/loaders'

interface Epic {
  id: string
  title: string
  status: string
  targetSprint?: {
    name: string
  }
  issues: any[]
  teams?: any[]
}

interface TeamProgress {
  team: string
  progress: number
  color: string
}

export default function EpicsPage() {
  const [epics, setEpics] = useState<Epic[]>([])
  const [filteredEpics, setFilteredEpics] = useState<Epic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>(
    'all'
  )
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'ACTIVE',
    targetSprintId: '',
  })

  useEffect(() => {
    fetchEpics()
  }, [])

  useEffect(() => {
    filterEpics()
  }, [epics, statusFilter])

  const fetchEpics = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/epics')
      if (!res.ok) throw new Error('Failed to fetch epics')
      const data = await res.json()
      setEpics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const filterEpics = () => {
    let filtered = epics

    if (statusFilter !== 'all') {
      filtered = filtered.filter((epic) => {
        if (statusFilter === 'active') return epic.status === 'ACTIVE'
        if (statusFilter === 'completed') return epic.status === 'COMPLETED'
        if (statusFilter === 'cancelled') return epic.status === 'CANCELLED'
        return true
      })
    }

    setFilteredEpics(filtered)
  }

  const calculateProgress = (epic: Epic) => {
    if (epic.issues.length === 0) return { overall: 0, byTeam: {} }

    const completedCount = epic.issues.filter((i) => i.status === 'DONE').length
    const overallProgress = Math.round((completedCount / epic.issues.length) * 100)

    const byTeam: Record<string, TeamProgress> = {}

    const teamKeys = ['FE', 'BE', 'QA']
    teamKeys.forEach((key) => {
      const teamIssues = epic.issues.filter((i) => i.team?.prefix === key)
      if (teamIssues.length > 0) {
        const completed = teamIssues.filter((i) => i.status === 'DONE').length
        const progress = Math.round((completed / teamIssues.length) * 100)

        const colorMap: Record<string, string> = {
          FE: 'bg-blue-500',
          BE: 'bg-purple-500',
          QA: 'bg-green-500',
        }

        byTeam[key] = {
          team: key,
          progress,
          color: colorMap[key],
        }
      }
    })

    return { overall: overallProgress, byTeam }
  }

  const handleCreateEpic = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    try {
      const res = await fetch('/api/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || undefined,
          status: formData.status,
          targetSprintId: formData.targetSprintId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create epic')
      }

      setFormData({ title: '', description: '', status: 'ACTIVE', targetSprintId: '' })
      setShowCreateForm(false)
      fetchEpics()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create epic')
    }
  }

  if (loading) {
    return <ProgressSlideLoader message="Loading epics..." />
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header actions */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : '+ Create Epic'}
        </button>
      </div>

      {/* Create Epic Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl mx-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Create Epic</h2>
            <form onSubmit={handleCreateEpic} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title*</label>
                <input
                  type="text"
                  value={formData.title}
                  placeholder="e.g. User Authentication"
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  autoFocus
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  placeholder="Optional description..."
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setFormError(null) }}
                  className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Epic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded px-4 py-2 text-sm font-medium transition ${
            statusFilter === 'all'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`rounded px-4 py-2 text-sm font-medium transition ${
            statusFilter === 'active'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`rounded px-4 py-2 text-sm font-medium transition ${
            statusFilter === 'completed'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setStatusFilter('cancelled')}
          className={`rounded px-4 py-2 text-sm font-medium transition ${
            statusFilter === 'cancelled'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Cancelled
        </button>
      </div>

      {/* Epic cards */}
      {error && <p className="text-red-600">{error}</p>}

      {filteredEpics.length === 0 ? (
        <div className="rounded bg-gray-50 p-8 text-center">
          <p className="text-gray-500">No epics found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEpics.map((epic) => {
            const progress = calculateProgress(epic)
            return (
              <EpicCard
                key={epic.id}
                id={epic.id}
                title={epic.title}
                status={epic.status}
                targetSprint={epic.targetSprint}
                issueCount={epic.issues.length}
                overallProgress={progress.overall}
                teamProgress={Object.values(progress.byTeam)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
