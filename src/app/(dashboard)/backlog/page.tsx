'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useIssues } from '@/hooks/useIssues'
import { useSprints } from '@/hooks/useSprints'
import { useTeams } from '@/hooks/useTeams'
import { IssueWithRelations } from '@/types'
import BacklogList from '@/components/backlog/BacklogList'
import { KanbanBoard } from '@/components/board/KanbanBoard'
import { ListView } from '@/components/board/ListView'
import { LayoutGrid, List, Table2, Search } from 'lucide-react'
import { StackedCardsLoader } from '@/components/ui/loaders'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ViewMode = 'table' | 'board' | 'list'
type SortBy = 'priority' | 'team' | 'created' | 'points'

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const TEAM_ORDER: Record<string, number> = { Frontend: 0, Backend: 1, QA: 2 }

const CHEVRON_STYLE = {
  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundSize: '16px',
  backgroundPosition: 'right 8px center',
  backgroundRepeat: 'no-repeat',
} as const

export default function BacklogPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  // ── View mode ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const urlView = searchParams.get('view')
    if (urlView === 'board' || urlView === 'list' || urlView === 'table') return urlView
    return 'table'
  })

  const handleSetView = (mode: ViewMode) => {
    setViewMode(mode)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', mode)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // ── Team filter ──────────────────────────────────────────────
  // Priority: URL param > user's team > 'ALL'
  const urlTeamId = searchParams.get('teamId')
  const [selectedTeam, setSelectedTeam] = useState<string>(urlTeamId || 'ALL')
  const [teamAutoDefaulted, setTeamAutoDefaulted] = useState(false)

  // Use cached hook (5-min staleTime, likely warm from TopNav)
  const { teams, isLoading: teamsLoading } = useTeams()

  // Team is "resolved" once we know the final selectedTeam value.
  const teamResolved = !!urlTeamId || !teamsLoading

  useEffect(() => {
    if (teamsLoading || teamAutoDefaulted) return
    if (urlTeamId) {
      // Validate URL teamId
      if (urlTeamId !== 'ALL' && !teams.find(t => t.id === urlTeamId)) {
        setSelectedTeam('ALL')
      }
    } else {
      // No URL param — auto-default to user's team if available
      const userTeamId = (session?.user as any)?.teamId
      if (userTeamId && teams.find(t => t.id === userTeamId)) {
        setSelectedTeam(userTeamId)
        setTeamAutoDefaulted(true)
      }
    }
  }, [teams, teamsLoading, session, teamAutoDefaulted, urlTeamId])

  const handleSetTeam = (teamId: string) => {
    setSelectedTeam(teamId)
    const params = new URLSearchParams(searchParams.toString())
    if (teamId === 'ALL') {
      params.delete('teamId')
    } else {
      params.set('teamId', teamId)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // ── Page-level filters ───────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSprint, setFilterSprint] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('priority')

  // ── Selection state ──────────────────────────────────────────
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set())
  const [selectedBulkSprintId, setSelectedBulkSprintId] = useState<string | null>(null)

  // ── Data queries ─────────────────────────────────────────────
  const issuesParams = useMemo(() => ({
    backlog: true as const,
    ...(selectedTeam !== 'ALL' && { teamId: selectedTeam }),
    enabled: teamResolved,
  }), [selectedTeam, teamResolved])

  const { issues: backlogIssues, isLoading: backlogLoading, error: backlogError } = useIssues(issuesParams)
  const { sprints: allSprints, isLoading: sprintsLoading } = useSprints(undefined, { summary: true })

  const assignableSprints = useMemo(
    () => allSprints.filter(s => s.status !== 'COMPLETED'),
    [allSprints],
  )

  const loading = !teamResolved || backlogLoading || sprintsLoading
  const error = backlogError?.message ?? null

  // API now returns backlog + planning sprint issues in one query
  const allIssues = backlogIssues

  // Sprint options for the sprint filter dropdown (derived from data)
  const sprintOptions = useMemo(() => {
    const seen = new Map<string, { name: string; status: string }>()
    allIssues.forEach(i => {
      if (i.sprintId && i.sprint?.name)
        seen.set(i.sprintId, { name: i.sprint.name, status: i.sprint.status })
    })
    return Array.from(seen.entries()).map(([id, { name, status }]) => ({ id, name, status }))
  }, [allIssues])

  // ── Filtering + sorting ──────────────────────────────────────
  const filteredIssues = useMemo(() => {
    const filtered = allIssues.filter(issue => {
      const matchesSearch = !searchQuery ||
        issue.displayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = filterType === 'all' || issue.type === filterType
      const matchesPriority = filterPriority === 'all' || issue.priority === filterPriority
      const matchesStatus = filterStatus === 'all' || issue.status === filterStatus
      const matchesSprint =
        filterSprint === 'all' ||
        (filterSprint === 'none' ? !issue.sprintId : issue.sprintId === filterSprint)
      return matchesSearch && matchesType && matchesPriority && matchesStatus && matchesSprint
    })

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (PRIORITY_ORDER[a.priority] ?? 999) - (PRIORITY_ORDER[b.priority] ?? 999)
        case 'team': {
          const teamA = TEAM_ORDER[a.team?.name as string] ?? 999
          const teamB = TEAM_ORDER[b.team?.name as string] ?? 999
          return teamA - teamB
        }
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'points':
          return (b.storyPoints ?? 0) - (a.storyPoints ?? 0)
        default:
          return 0
      }
    })
  }, [allIssues, searchQuery, filterType, filterPriority, filterStatus, filterSprint, sortBy])

  const hasActiveFilters = filterPriority !== 'all' || filterType !== 'all' || filterStatus !== 'all' || filterSprint !== 'all' || sortBy !== 'priority' || searchQuery !== ''

  const clearFilters = () => {
    setSearchQuery('')
    setFilterPriority('all')
    setFilterType('all')
    setFilterStatus('all')
    setFilterSprint('all')
    setSortBy('priority')
  }

  // ── Mutations ────────────────────────────────────────────────
  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['issues'] }),
      queryClient.invalidateQueries({ queryKey: ['sprints'] }),
    ])

  const { mutate: assignToSprint, isPending: assigning } = useMutation({
    mutationFn: async ({ issueIds, sprintId }: { issueIds: string[]; sprintId: string }) => {
      const responses = await Promise.all(
        issueIds.map(id =>
          fetch(`/api/issues/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sprintId }),
          })
        )
      )
      if (!responses.every(r => r.ok)) throw new Error('Some issues failed to assign')
      return responses
    },
    onSuccess: () => {
      setSelectedIssueIds(new Set())
      setSelectedBulkSprintId(null)
      invalidateAll()
    },
    onError: (err) => toast.error(err.message || 'Failed to assign issues to sprint'),
  })

  const { mutate: removeFromSprint } = useMutation({
    mutationFn: async (issueId: string) => {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprintId: null }),
      })
      if (!res.ok) throw new Error('Failed to remove from sprint')
    },
    onSuccess: () => invalidateAll(),
    onError: (err) => toast.error(err.message || 'Failed to remove from sprint'),
  })

  // ── Kanban drag-and-drop handler ─────────────────────────────
  const handleIssueUpdated = useCallback((updated: IssueWithRelations) => {
    queryClient.setQueryData(
      ['issues', issuesParams],
      (old: IssueWithRelations[] | undefined) =>
        old ? old.map((i) => (i.id === updated.id ? updated : i)) : old,
    )
  }, [queryClient, issuesParams])

  const handleAssignToSprint = (issueIds: string[], sprintId: string) => {
    assignToSprint({ issueIds, sprintId })
  }

  const handleRemoveFromSprint = (issueId: string, _sprintId: string) => {
    removeFromSprint(issueId)
  }

  const selectedBulkSprint = selectedBulkSprintId
    ? assignableSprints.find(s => s.id === selectedBulkSprintId)
    : null

  // Selected team name for empty state
  const selectedTeamName = selectedTeam !== 'ALL'
    ? teams.find(t => t.id === selectedTeam)?.name || 'Selected team'
    : null

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {loading ? (
            <StackedCardsLoader message="Organizing your backlog..." fullScreen />
          ) : (
            <>
              {/* ── Row 1: Team dropdown (left) + View toggle (right) ── */}
              <div className="flex items-center justify-between gap-4">
                <select
                  value={selectedTeam}
                  onChange={(e) => handleSetTeam(e.target.value)}
                  style={CHEVRON_STYLE}
                  className={cn(
                    'rounded-lg border pl-3 pr-8 py-1.5 text-sm focus:border-blue-400 focus:outline-none transition-colors appearance-none',
                    selectedTeam !== 'ALL'
                      ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-600'
                  )}
                >
                  <option value="ALL">All Teams</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name} ({team.prefix})</option>
                  ))}
                </select>

                <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden shrink-0">
                  <button
                    onClick={() => handleSetView('table')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                      viewMode === 'table'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                    )}
                  >
                    <Table2 className="h-4 w-4" />
                    Table
                  </button>
                  <div className="w-px h-6 bg-gray-200" />
                  <button
                    onClick={() => handleSetView('board')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                      viewMode === 'board'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Board
                  </button>
                  <div className="w-px h-6 bg-gray-200" />
                  <button
                    onClick={() => handleSetView('list')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                      viewMode === 'list'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                    )}
                  >
                    <List className="h-4 w-4" />
                    List
                  </button>
                </div>
              </div>

              {/* ── Row 2: Search | divider | Filters | count ── */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search (first item) */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 w-48"
                  />
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-gray-200 mx-0.5" />

                {/* Sprint */}
                <select
                  value={filterSprint}
                  onChange={(e) => setFilterSprint(e.target.value)}
                  style={CHEVRON_STYLE}
                  className={cn(
                    'rounded-lg border pl-3 pr-8 py-1.5 text-sm focus:border-blue-400 focus:outline-none transition-colors appearance-none',
                    filterSprint !== 'all'
                      ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-600'
                  )}
                >
                  <option value="all">All Sprints</option>
                  <option value="none">Unassigned</option>
                  {sprintOptions.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.status === 'PLANNING' ? ' (Planning)' : ''}</option>
                  ))}
                </select>

                {/* Priority */}
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  style={CHEVRON_STYLE}
                  className={cn(
                    'rounded-lg border pl-3 pr-8 py-1.5 text-sm focus:border-blue-400 focus:outline-none transition-colors appearance-none',
                    filterPriority !== 'all'
                      ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-600'
                  )}
                >
                  <option value="all">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                {/* Type */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={CHEVRON_STYLE}
                  className={cn(
                    'rounded-lg border pl-3 pr-8 py-1.5 text-sm focus:border-blue-400 focus:outline-none transition-colors appearance-none',
                    filterType !== 'all'
                      ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-600'
                  )}
                >
                  <option value="all">All Types</option>
                  <option value="STORY">Story</option>
                  <option value="TASK">Task</option>
                  <option value="BUG">Bug</option>
                  <option value="SUBTASK">Subtask</option>
                </select>

                {/* Status */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={CHEVRON_STYLE}
                  className={cn(
                    'rounded-lg border pl-3 pr-8 py-1.5 text-sm focus:border-blue-400 focus:outline-none transition-colors appearance-none',
                    filterStatus !== 'all'
                      ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-600'
                  )}
                >
                  <option value="all">All Statuses</option>
                  <option value="BACKLOG">Backlog</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="READY_FOR_QA">Ready for QA</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="DONE">Done</option>
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  style={CHEVRON_STYLE}
                  className={cn(
                    'rounded-lg border pl-3 pr-8 py-1.5 text-sm focus:border-blue-400 focus:outline-none transition-colors appearance-none',
                    sortBy !== 'priority'
                      ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-600'
                  )}
                >
                  <option value="priority">Sort: Priority</option>
                  <option value="team">Sort: Team</option>
                  <option value="created">Sort: Created</option>
                  <option value="points">Sort: Story Points</option>
                </select>

                {/* Count + Clear (pushed to the right) */}
                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-xs text-gray-400">
                    {filteredIssues.length} of {allIssues.length} issue{allIssues.length !== 1 ? 's' : ''}
                  </span>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {/* ── Bulk action bar ── */}
              {selectedIssueIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <span className="shrink-0 text-sm font-semibold text-blue-900">
                    {selectedIssueIds.size} issue{selectedIssueIds.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex-1" />
                  {assignableSprints.length > 0 ? (
                    <>
                      <select
                        value={selectedBulkSprintId ?? ''}
                        onChange={(e) => setSelectedBulkSprintId(e.target.value || null)}
                        className="rounded-lg border border-blue-300 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-600 focus:border-blue-400 focus:outline-none appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
                      >
                        <option value="">Assign to Sprint\u2026</option>
                        {assignableSprints.map(sprint => (
                          <option key={sprint.id} value={sprint.id}>
                            {sprint.name}{sprint.status === 'ACTIVE' ? ' (Active)' : ''}
                          </option>
                        ))}
                      </select>
                      {selectedBulkSprint && (
                        <button
                          disabled={assigning}
                          onClick={() => handleAssignToSprint(Array.from(selectedIssueIds), selectedBulkSprint.id)}
                          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {assigning ? 'Assigning\u2026' : `Move to ${selectedBulkSprint.name}`}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 italic">No planning sprints available</span>
                  )}
                  <button
                    onClick={() => { setSelectedIssueIds(new Set()); setSelectedBulkSprintId(null) }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* ── Content views ── */}
              {filteredIssues.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedTeamName
                      ? `No backlog items for ${selectedTeamName}`
                      : 'No Backlog Items'}
                  </h3>
                  <p className="text-gray-600">
                    {selectedTeamName
                      ? 'Switch to All Teams to see all items, or create issues for this team.'
                      : 'Create issues to start planning your sprint.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className={viewMode === 'table' ? '' : 'hidden'}>
                    <BacklogList
                      issues={filteredIssues}
                      selectedIssueIds={selectedIssueIds}
                      onSelectionChange={setSelectedIssueIds}
                      onRemoveFromSprint={handleRemoveFromSprint}
                    />
                  </div>
                  <div className={viewMode === 'board' ? 'min-h-[500px]' : 'hidden'}>
                    <KanbanBoard issues={filteredIssues} onIssueUpdated={handleIssueUpdated} showSprintBadge />
                  </div>
                  <div className={viewMode === 'list' ? '' : 'hidden'}>
                    <ListView issues={filteredIssues} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
