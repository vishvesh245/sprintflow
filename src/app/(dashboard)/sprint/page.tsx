'use client'

import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useSprintOverview } from '@/hooks/useSprintOverview'
import { IssueWithRelations, Sprint } from '@/types'
import UnifiedSprintView from '@/components/sprint/UnifiedSprintView'
import SprintCompleteModal from '@/components/sprint/SprintCompleteModal'
import SprintHistorySection from '@/components/sprint/SprintHistorySection'
import { Button } from '@/components/ui/button'
import { SprintBarsLoader } from '@/components/ui/loaders'
import { RefreshCw, CheckCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function SprintPage() {
  const queryClient = useQueryClient()
  const [selectedEpic, setSelectedEpic] = useState<string | 'all'>('all')

  // Create sprint form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '' })
  const [createError, setCreateError] = useState<string | null>(null)

  // Complete sprint state
  const [showCompleteModal, setShowCompleteModal] = useState(false)

  // Plan next sprint state
  const [showPlanNextSprint, setShowPlanNextSprint] = useState(false)
  const [nextSprintForm, setNextSprintForm] = useState({ name: '', startDate: '', endDate: '' })
  const [nextSprintError, setNextSprintError] = useState<string | null>(null)

  // ── Data queries (single combined fetch) ─────────────────────
  const {
    activeSprint: sprint,
    planningSprints,
    issues,
    isLoading: loading,
    error: overviewError,
  } = useSprintOverview()

  // Only show planning sprint when there's no active sprint
  const planningSprint = sprint ? null : (planningSprints[0] ?? null)
  const error = overviewError?.message ?? null

  // ── Mutations ─────────────────────────────────────────────────
  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sprint-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['sprints'] }),
      queryClient.invalidateQueries({ queryKey: ['issues'] }),
    ])

  const { mutate: createSprint, isPending: creating } = useMutation({
    mutationFn: async (data: { name: string; startDate: string; endDate: string }) => {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create sprint')
      return json
    },
    onSuccess: () => {
      setFormData({ name: '', startDate: '', endDate: '' })
      setShowCreateForm(false)
      setCreateError(null)
      invalidateAll()
    },
    onError: (err) => setCreateError(err instanceof Error ? err.message : 'Failed to create sprint'),
  })

  const { mutate: startSprint, isPending: starting } = useMutation({
    mutationFn: async (sprintId: string) => {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to start sprint')
      return json
    },
    onSuccess: () => invalidateAll(),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to start sprint'),
  })

  const { mutate: createNextSprint, isPending: creatingNextSprint } = useMutation({
    mutationFn: async (data: { name: string; startDate: string; endDate: string }) => {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create sprint')
      return json
    },
    onSuccess: () => {
      setNextSprintForm({ name: '', startDate: '', endDate: '' })
      setShowPlanNextSprint(false)
      setNextSprintError(null)
      invalidateAll()
    },
    onError: (err) => setNextSprintError(err instanceof Error ? err.message : 'Failed to create sprint'),
  })

  // Open complete sprint modal — planning sprints already in cache from useSprints('PLANNING')
  const handleOpenCompleteModal = () => setShowCompleteModal(true)

  const handleCompleteSprintSubmit = async (data: {
    issueUpdates: Array<{ issueId: string; sprintId: string | null }>
  }) => {
    const issueActions = data.issueUpdates.map((u) => {
      if (!u.sprintId || u.sprintId === 'null') {
        return { issueId: u.issueId, action: 'backlog' as const }
      }
      return { issueId: u.issueId, action: 'next_sprint' as const, targetSprintId: u.sprintId }
    })

    const res = await fetch(`/api/sprints/${sprint!.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueActions }),
    })

    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error || 'Failed to complete sprint')
    }

    setShowCompleteModal(false)
    await invalidateAll()
  }

  // Filter issues by epic
  const filteredIssues = selectedEpic === 'all'
    ? issues
    : issues.filter(issue => issue.epicId === selectedEpic)

  // Get unique epics from current issues
  const epics = Array.from(
    new Map(
      issues.filter(i => i.epic).map(i => [i.epicId, i.epic])
    ).values()
  )

  // ── Loading state ─────────────────────────────────────────────
  // Wait for active sprints query to resolve before rendering anything,
  // otherwise the planning sprint UI flashes while the active query is in-flight.
  if (loading) {
    return <SprintBarsLoader message="Crunching sprint data..." fullScreen />
  }

  // ── No sprint: show create form ───────────────────────────────
  if (!sprint && !planningSprint) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Sprint</h2>
              <p className="text-gray-600 text-sm">Create a sprint to start tracking your team's work.</p>
            </div>

            {!showCreateForm ? (
              <Button className="w-full" onClick={() => setShowCreateForm(true)}>
                + Create Sprint
              </Button>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); createSprint(formData) }} className="space-y-4">
                {createError && (
                  <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {createError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sprint Name*</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Sprint 1"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date*</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date*</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setShowCreateForm(false); setCreateError(null) }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Sprint'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Planning sprint: show details and Start Sprint button ──────
  if (!sprint && planningSprint) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-lg mx-auto pt-16 pb-8 px-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-gray-900">{planningSprint.name}</h2>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">PLANNING</span>
              </div>
              <p className="text-sm text-gray-600">
                {new Date(planningSprint.startDate).toLocaleDateString()} – {new Date(planningSprint.endDate).toLocaleDateString()}
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              This sprint is in planning. Go to the <strong>Backlog</strong> to assign issues to this sprint, then start it when ready.
            </div>

            {error && (
              <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.location.href = '/backlog'}
              >
                Go to Backlog
              </Button>
              <Button
                className="flex-1"
                onClick={() => startSprint(planningSprint.id)}
                disabled={starting}
              >
                {starting ? 'Starting...' : 'Start Sprint'}
              </Button>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <button
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setShowCreateForm(true)}
              >
                + Create another sprint
              </button>
              {showCreateForm && (
                <form onSubmit={(e) => { e.preventDefault(); createSprint(formData) }} className="mt-4 space-y-3">
                  {createError && (
                    <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{createError}</div>
                  )}
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Sprint name"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required className="rounded border border-gray-300 px-3 py-2 text-sm" />
                    <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} required className="rounded border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1" disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Sprint history visible even from planning state */}
        <SprintHistorySection planningSprints={planningSprints} />
      </div>
    )
  }

  // ── Active sprint: normal view ─────────────────────────────────
  return (
    <div className="h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-lg font-semibold text-gray-900">{sprint!.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-gray-500">
                    {new Date(sprint!.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(sprint!.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {Math.max(0, Math.ceil((new Date(sprint!.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}d left
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Epic Filter */}
              {epics.length > 0 && (
                <select
                  value={selectedEpic}
                  onChange={(e) => setSelectedEpic(e.target.value)}
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundSize: '16px',
                    backgroundPosition: 'right 8px center',
                    backgroundRepeat: 'no-repeat',
                  }}
                  className="rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-600 focus:border-blue-400 focus:outline-none appearance-none"
                >
                  <option value="all">All Epics</option>
                  {epics.map(epic => (
                    <option key={epic?.id} value={epic?.id}>{epic?.title}</option>
                  ))}
                </select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPlanNextSprint(!showPlanNextSprint)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Plan Next Sprint
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={handleOpenCompleteModal}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete Sprint
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => invalidateAll()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Plan Next Sprint — inline form */}
          {showPlanNextSprint && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Plan Next Sprint</h3>
              {nextSprintError && (
                <div className="mb-3 rounded bg-red-50 border border-red-200 p-2 text-sm text-red-700">
                  {nextSprintError}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); createNextSprint(nextSprintForm) }} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sprint Name*</label>
                  <input
                    type="text"
                    value={nextSprintForm.name}
                    onChange={(e) => setNextSprintForm({ ...nextSprintForm, name: e.target.value })}
                    required
                    placeholder="e.g., Sprint 2"
                    className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date*</label>
                    <input
                      type="date"
                      value={nextSprintForm.startDate}
                      onChange={(e) => setNextSprintForm({ ...nextSprintForm, startDate: e.target.value })}
                      required
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date*</label>
                    <input
                      type="date"
                      value={nextSprintForm.endDate}
                      onChange={(e) => setNextSprintForm({ ...nextSprintForm, endDate: e.target.value })}
                      required
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowPlanNextSprint(false); setNextSprintError(null) }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={creatingNextSprint}>
                    {creatingNextSprint ? 'Creating...' : 'Create Sprint'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Sprint View */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        <UnifiedSprintView sprint={sprint!} issues={filteredIssues} />
      </div>

      {/* Sprint History — upcoming + completed sprints */}
      <SprintHistorySection planningSprints={planningSprints} />

      {/* Complete Sprint Modal */}
      {sprint && (
        <SprintCompleteModal
          isOpen={showCompleteModal}
          sprint={sprint}
          issues={issues}
          nextSprints={planningSprints}
          onClose={() => setShowCompleteModal(false)}
          onSubmit={handleCompleteSprintSubmit}
        />
      )}
    </div>
  )
}
