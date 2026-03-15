'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, X, Play } from 'lucide-react'
import { SpinArcLoader } from '@/components/ui/loaders'
import { getPriorityBadge, getStatusBadge } from '@/lib/colors'
import { toast } from 'sonner'
import { usePrefetchIssue } from '@/hooks/usePrefetchIssue'
import { useIssueSlideOver } from '@/contexts/IssueSlideOverContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SprintDetail {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED'
  issues: SprintIssue[]
}

interface SprintIssue {
  id: string
  displayId: string
  title: string
  status: string
  priority: string
  type: string
  storyPoints: number | null
  team?: { name: string; prefix: string } | null
  assignee?: { name: string | null; email: string } | null
}

// ── Display maps ──────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

const STATUS_LABEL: Record<string, string> = {
  BACKLOG:     'Backlog',
  TODO:        'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW:   'In Review',
  BLOCKED:     'Blocked',
  DONE:        'Done',
}

const TYPE_LABEL: Record<string, string> = {
  STORY:   'Story',
  TASK:    'Task',
  BUG:     'Bug',
  SUBTASK: 'Subtask',
}

const TYPE_ICON: Record<string, string> = {
  STORY:   '📖',
  TASK:    '✓',
  BUG:     '🐛',
  SUBTASK: '↳',
}

const TEAM_BADGE: Record<string, string> = {
  Frontend: 'bg-blue-100 text-blue-800',
  Backend:  'bg-green-100 text-green-800',
  QA:       'bg-purple-100 text-purple-800',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SprintDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const sprintId = params.id as string

  const { data: sprint, isLoading: loading, error: queryError } = useQuery<SprintDetail>({
    queryKey: ['sprint', sprintId],
    queryFn: async () => {
      const res = await fetch(`/api/sprints/${sprintId}`)
      if (!res.ok) throw new Error('Sprint not found')
      return res.json()
    },
    enabled: !!sprintId,
    staleTime: 30_000,
  })
  const error = queryError ? (queryError as Error).message : null

  const prefetchIssue = usePrefetchIssue()
  const { openIssue } = useIssueSlideOver()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [startingSprint, setStartingSprint] = useState(false)

  // Filter state
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState<'priority' | 'status' | 'team' | 'type'>('priority')

  // Remove issue from upcoming sprint → back to backlog
  const handleRemove = async (issue: SprintIssue) => {
    setRemovingId(issue.id)
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprintId: null, status: 'BACKLOG' }),
      })
      if (res.ok) {
        queryClient.setQueryData<SprintDetail>(['sprint', sprintId], prev =>
          prev ? { ...prev, issues: prev.issues.filter(i => i.id !== issue.id) } : prev
        )
      }
    } finally {
      setRemovingId(null)
    }
  }

  // Start sprint (PLANNING → ACTIVE)
  const handleStartSprint = async () => {
    setStartingSprint(true)
    try {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to start sprint')
      }
      // Update cache to reflect the change
      queryClient.setQueryData<SprintDetail>(['sprint', sprintId], prev =>
        prev ? { ...prev, status: 'ACTIVE' } : prev
      )
      toast.success(`${sprint?.name} is now active!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start sprint')
    } finally {
      setStartingSprint(false)
    }
  }

  // Unique filter options derived from issues
  const issues: SprintIssue[] = sprint?.issues ?? []
  const teams      = useMemo(() => Array.from(new Set(issues.map(i => i.team?.name).filter(Boolean) as string[])), [issues])
  const types      = useMemo(() => Array.from(new Set(issues.map(i => i.type))), [issues])
  const priorities = useMemo(() => Array.from(new Set(issues.map(i => i.priority))), [issues])
  const statuses   = useMemo(() => Array.from(new Set(issues.map(i => i.status))), [issues])

  const filtered = useMemo(() => {
    let result = issues.filter(issue => {
      const q = search.toLowerCase()
      const matchesSearch =
        issue.displayId.toLowerCase().includes(q) ||
        issue.title.toLowerCase().includes(q)
      const matchesTeam     = filterTeam     === 'all' || issue.team?.name === filterTeam
      const matchesType     = filterType     === 'all' || issue.type === filterType
      const matchesPriority = filterPriority === 'all' || issue.priority === filterPriority
      const matchesStatus   = filterStatus   === 'all' || issue.status === filterStatus
      return matchesSearch && matchesTeam && matchesType && matchesPriority && matchesStatus
    })

    result.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
        case 'status':
          return a.status.localeCompare(b.status)
        case 'team':
          return (a.team?.name ?? '').localeCompare(b.team?.name ?? '')
        case 'type':
          return a.type.localeCompare(b.type)
        default:
          return 0
      }
    })
    return result
  }, [issues, search, filterTeam, filterType, filterPriority, filterStatus, sortBy])

  const isCompleted = sprint?.status === 'COMPLETED'
  const isPlanning  = sprint?.status === 'PLANNING'
  const isReadOnly  = !isPlanning

  const doneCount  = issues.filter(i => i.status === 'DONE').length
  const totalPts   = issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0)
  const donePts    = issues.filter(i => i.status === 'DONE').reduce((s, i) => s + (i.storyPoints ?? 0), 0)
  const pct        = issues.length > 0 ? Math.round((doneCount / issues.length) * 100) : 0

  // ── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return <SpinArcLoader message="Loading sprint..." />
  }

  if (error || !sprint) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-red-600">{error ?? 'Sprint not found'}</p>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="h-full bg-white flex flex-col">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="px-6 py-4 space-y-3">

          {/* Back + title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.back()}
                className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-base font-semibold text-gray-800 truncate">{sprint.name}</span>
                  {sprint.status === 'COMPLETED' ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-sm font-semibold text-emerald-700 shrink-0">
                      Completed
                    </span>
                  ) : sprint.status === 'ACTIVE' ? (
                    <span className="rounded-full bg-blue-100 px-3 py-0.5 text-sm font-semibold text-blue-700 shrink-0">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-0.5 text-sm font-semibold text-amber-700 shrink-0">
                      Planning
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {fmt(sprint.startDate)} – {fmt(sprint.endDate)}
                </p>
              </div>
            </div>

            {/* Stats chips — completed only */}
            {isCompleted && issues.length > 0 && (
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Done</p>
                  <p className="text-base font-bold text-gray-900">{doneCount}/{issues.length}</p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Completion</p>
                  <p className={cn('text-base font-bold', pct === 100 ? 'text-green-600' : 'text-blue-600')}>
                    {pct}%
                  </p>
                </div>
                {totalPts > 0 && (
                  <>
                    <div className="h-8 w-px bg-gray-200" />
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Story pts</p>
                      <p className="text-base font-bold text-gray-900">{donePts}/{totalPts}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Actions for non-completed sprints */}
            {!isCompleted && (
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/backlog"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  + Add tickets from Backlog
                </Link>
                {sprint.status === 'PLANNING' && (
                  <button
                    onClick={handleStartSprint}
                    disabled={startingSprint || issues.length === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    title={issues.length === 0 ? 'Add tickets before starting the sprint' : undefined}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {startingSprint ? 'Starting…' : 'Start Sprint'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress bar — completed only */}
          {isCompleted && issues.length > 0 && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-4">

          {/* ── Search + filters ── */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID or title…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select value={filterTeam}     onChange={e => setFilterTeam(e.target.value)}     className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Teams</option>
                {teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterType}     onChange={e => setFilterType(e.target.value)}     className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Types</option>
                {types.map(t => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
              </select>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Priorities</option>
                {priorities.map(p => <option key={p} value={p}>{p.charAt(0)+p.slice(1).toLowerCase()}</option>)}
              </select>
              <select value={filterStatus}   onChange={e => setFilterStatus(e.target.value)}   className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
              </select>
              <select value={sortBy}         onChange={e => setSortBy(e.target.value as typeof sortBy)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="priority">Sort: Priority</option>
                <option value="status">Sort: Status</option>
                <option value="team">Sort: Team</option>
                <option value="type">Sort: Type</option>
              </select>
            </div>
          </div>

          {/* ── Issue table ── */}
          <div className="overflow-hidden rounded-lg border border-gray-200">

            {/* Table header */}
            <div className="grid bg-gray-100 border-b border-gray-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500"
              style={{ gridTemplateColumns: isReadOnly
                ? '72px minmax(0,1fr) 100px 80px 90px 110px 48px 72px'
                : '72px minmax(0,1fr) 100px 80px 90px 110px 48px 72px 40px'
              }}
            >
              <span>ID</span>
              <span>Title</span>
              <span>Team</span>
              <span>Type</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Pts</span>
              <span>Assignee</span>
              {!isReadOnly && <span />}
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100">
              {filtered.map((issue, idx) => (
                <div
                  key={issue.id}
                  className={cn(
                    'group grid items-center px-4 py-3 text-sm transition-colors hover:bg-blue-50',
                    idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white',
                  )}
                  style={{ gridTemplateColumns: isReadOnly
                    ? '72px minmax(0,1fr) 100px 80px 90px 110px 48px 72px'
                    : '72px minmax(0,1fr) 100px 80px 90px 110px 48px 72px 40px'
                  }}
                >
                  {/* All data cells — Link with display:contents */}
                  <div onClick={() => openIssue(issue.id)} onMouseEnter={() => prefetchIssue(issue.id)} className="contents cursor-pointer">

                    <span className="flex items-center text-xs font-semibold text-gray-400">
                      {issue.displayId}
                    </span>

                    <span className="flex items-center pr-4 text-gray-800 truncate">
                      {issue.title}
                    </span>

                    <div className="flex items-center">
                      {issue.team && (
                        <span className={cn('truncate rounded px-2 py-0.5 text-xs font-medium max-w-full', TEAM_BADGE[issue.team.name] ?? 'bg-gray-100 text-gray-600')}>
                          {issue.team.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span className="shrink-0">{TYPE_ICON[issue.type] ?? '•'}</span>
                      <span className="truncate">{TYPE_LABEL[issue.type] ?? issue.type}</span>
                    </div>

                    <div className="flex items-center">
                      <span className={cn('rounded px-2 py-0.5 text-xs font-medium', getPriorityBadge(issue.priority))}>
                        {issue.priority.charAt(0) + issue.priority.slice(1).toLowerCase()}
                      </span>
                    </div>

                    <div className="flex items-center">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', getStatusBadge(issue.status))}>
                        {STATUS_LABEL[issue.status] ?? issue.status}
                      </span>
                    </div>

                    <span className="flex items-center text-xs text-gray-500">
                      {issue.storyPoints ?? '—'}
                    </span>

                    <div className="flex items-center">
                      {issue.assignee ? (
                        <div
                          className="h-6 w-6 shrink-0 rounded-full bg-blue-200 flex items-center justify-center text-xs font-semibold text-blue-900"
                          title={issue.assignee.name ?? issue.assignee.email}
                        >
                          {(issue.assignee.name ?? issue.assignee.email ?? 'A')[0].toUpperCase()}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>

                  </div>

                  {/* Remove button — upcoming only, last grid cell */}
                  {!isReadOnly && (
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => handleRemove(issue)}
                        disabled={removingId === issue.id}
                        title="Remove from sprint → back to backlog"
                        className="rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400 italic">
                {issues.length === 0 ? 'No tickets in this sprint' : 'No tickets match your filters'}
              </div>
            )}
          </div>

          {/* ── Results summary ── */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Showing {filtered.length} of {issues.length} tickets</span>
            {isCompleted && issues.length > 0 && (
              <span className="font-medium text-gray-700">
                {doneCount} completed · {issues.length - doneCount} not completed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
