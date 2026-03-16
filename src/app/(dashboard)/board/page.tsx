'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, List } from 'lucide-react'
import { useBoardData } from '@/hooks/useBoardData'
import { useTeams } from '@/hooks/useTeams'
import { useUsers } from '@/hooks/useUsers'
import { useSSE } from '@/hooks/useSSE'
import dynamic from 'next/dynamic'
import { KanbanBoard } from '@/components/board/KanbanBoard'

const ListView = dynamic(() => import('@/components/board/ListView').then((m) => ({ default: m.ListView })))
import { IssueWithRelations } from '@/types'
import { cn } from '@/lib/utils'
import { KanbanCardsLoader } from '@/components/ui/loaders'
import { invalidateIssueCaches } from '@/lib/invalidateRelatedCaches'

type ViewMode = 'board' | 'list'

const VIEW_PREF_KEY = 'sprintflow-board-view'

const CHEVRON_STYLE = {
  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundSize: '16px',
  backgroundPosition: 'right 8px center',
  backgroundRepeat: 'no-repeat',
} as const

export default function BoardPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [selectedTeam, setSelectedTeam] = useState<string | 'ALL'>(searchParams.get('teamId') || 'ALL')
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [filterPriority,   setFilterPriority]   = useState('all')
  const [filterType,       setFilterType]       = useState('all')
  const [filterAssigneeId, setFilterAssigneeId] = useState(searchParams.get('unassigned') === 'true' ? 'unassigned' : 'all')
  const [filterStatus,     setFilterStatus]     = useState(searchParams.get('status') || 'all')
  const [sortBy,           setSortBy]           = useState('priority')

  // Initialize SSE connection
  useSSE()

  // Restore persisted view preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_PREF_KEY)
      if (saved === 'board' || saved === 'list') setViewMode(saved)
    } catch {}
  }, [])

  const handleSetView = (mode: ViewMode) => {
    setViewMode(mode)
    try { localStorage.setItem(VIEW_PREF_KEY, mode) } catch {}
  }

  // Single combined fetch: sprint + issues in one round-trip
  const { sprint, issues, isLoading, error } = useBoardData(selectedTeam)

  // Use cached hooks (already warm from TopNav, 5-min staleTime)
  const { teams } = useTeams()
  const { users } = useUsers()

  const queryClient = useQueryClient()

  // Called by KanbanBoard after a successful drag-and-drop PATCH.
  const handleIssueUpdated = useCallback((updated: IssueWithRelations) => {
    // Immediately patch the board cache so there's no flicker
    queryClient.setQueryData(
      ['board', { teamId: selectedTeam || 'ALL' }],
      (old: { sprint: any; issues: IssueWithRelations[] } | undefined) =>
        old ? { ...old, issues: old.issues.map((i) => (i.id === updated.id ? updated : i)) } : old,
    )
    // Also invalidate other views that show issue status (sprint overview, epics, etc.)
    invalidateIssueCaches(queryClient)
  }, [queryClient, selectedTeam])

  // Client-side filtering on top of the server-side team filter
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchPriority = filterPriority   === 'all' || issue.priority === filterPriority
      const matchType     = filterType       === 'all' || issue.type     === filterType
      const matchAssignee = filterAssigneeId === 'all'
        || (filterAssigneeId === 'unassigned' ? (!issue.assignee && issue.status !== 'DONE') : issue.assignee?.id === filterAssigneeId)
      const matchStatus   = filterStatus     === 'all' || issue.status   === filterStatus
      return matchPriority && matchType && matchAssignee && matchStatus
    })
  }, [issues, filterPriority, filterType, filterAssigneeId, filterStatus])

  const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

  const sortedIssues = useMemo(() => {
    const sorted = [...filteredIssues]
    switch (sortBy) {
      case 'priority':
        return sorted.sort((a, b) => (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9))
      case 'points-desc':
        return sorted.sort((a, b) => (b.storyPoints ?? -1) - (a.storyPoints ?? -1))
      case 'points-asc':
        return sorted.sort((a, b) => (a.storyPoints ?? 999) - (b.storyPoints ?? 999))
      case 'newest':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title))
      default:
        return sorted
    }
  }, [filteredIssues, sortBy])

  const hasActiveFilters = selectedTeam !== 'ALL' || filterPriority !== 'all' || filterType !== 'all' || filterAssigneeId !== 'all' || filterStatus !== 'all' || sortBy !== 'priority'

  const clearFilters = () => {
    setSelectedTeam('ALL')
    setFilterPriority('all')
    setFilterType('all')
    setFilterAssigneeId('all')
    setFilterStatus('all')
    setSortBy('priority')
  }

  // Calculate days remaining
  useEffect(() => {
    if (sprint?.endDate) {
      const days = Math.ceil(
        (new Date(sprint.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      setDaysRemaining(Math.max(0, days))
    }
  }, [sprint])

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Please sign in to access the board.</p>
      </div>
    )
  }

  if (isLoading) {
    return <KanbanCardsLoader message="Loading your board..." fullScreen />
  }

  if (!sprint) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Sprint</h2>
          <p className="text-gray-600">
            There is no active sprint. Please create or start a sprint to begin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col p-6">
      {/* ── Row 1: Sprint info + View toggle ── */}
      <div className="mb-3 flex items-start justify-between gap-4">
        {/* Sprint info */}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{sprint.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {daysRemaining == null
              ? '\u00A0'
              : daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
                : 'Sprint ended'}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden shrink-0">
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

      {/* ── Row 2: Filter bar ── */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        {/* Team */}
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
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
          <option value="TODO">Todo</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="READY_FOR_QA">Ready for QA</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="DONE">Done</option>
        </select>

        {/* Assignee */}
        <select
          value={filterAssigneeId}
          onChange={(e) => setFilterAssigneeId(e.target.value)}
          style={CHEVRON_STYLE}
          className={cn(
            'rounded-lg border pl-3 pr-8 py-1.5 text-sm focus:border-blue-400 focus:outline-none transition-colors appearance-none',
            filterAssigneeId !== 'all'
              ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
              : 'border-gray-200 bg-white text-gray-600'
          )}
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name || user.email}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={CHEVRON_STYLE}
          className={cn(
            'rounded-lg border pl-3 pr-8 py-1.5 text-sm focus:border-blue-400 focus:outline-none transition-colors appearance-none',
            sortBy !== 'priority'
              ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
              : 'border-gray-200 bg-white text-gray-600'
          )}
        >
          <option value="priority">Sort: Priority</option>
          <option value="points-desc">Points: High to Low</option>
          <option value="points-asc">Points: Low to High</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">A-Z Title</option>
        </select>

        {/* Issue count + Clear */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {sortedIssues.length} of {issues.length} issue{issues.length !== 1 ? 's' : ''}
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

      {/* ── Content ── */}
      <>
        {/* Both views stay mounted — toggled by CSS only so KanbanBoard never
            loses its local optimistic state when the user switches views. */}
        <div className={viewMode === 'board' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
          <KanbanBoard issues={sortedIssues} onIssueUpdated={handleIssueUpdated} />
        </div>
        <div className={viewMode === 'list' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
          <ListView issues={sortedIssues} />
        </div>
      </>
    </div>
  )
}
