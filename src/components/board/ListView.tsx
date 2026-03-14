'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, BookOpen, CheckSquare, Bug, GitBranch } from 'lucide-react'
import { IssueWithRelations } from '@/types'
import { cn, getTeamColor } from '@/lib/utils'
import { STATUS_COLORS, TYPE_COLORS, getPriorityColor } from '@/lib/colors'
import { usePrefetchIssue } from '@/hooks/usePrefetchIssue'
import { useIssueSlideOver } from '@/contexts/IssueSlideOverContext'

// ── Config ────────────────────────────────────────────────────────────────────

const GROUPS = [
  { status: 'TODO',        label: 'To Do',       dot: STATUS_COLORS.TODO.dot },
  { status: 'IN_PROGRESS', label: 'In Progress',  dot: STATUS_COLORS.IN_PROGRESS.dot },
  { status: 'READY_FOR_QA', label: 'Ready for QA', dot: STATUS_COLORS.READY_FOR_QA.dot },
  { status: 'IN_REVIEW',   label: 'In Review',    dot: STATUS_COLORS.IN_REVIEW.dot },
  { status: 'BLOCKED',     label: 'Blocked',      dot: STATUS_COLORS.BLOCKED.dot },
  { status: 'DONE',        label: 'Done',         dot: STATUS_COLORS.DONE.dot },
]

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
}

// Type icons get a subtle color so they're identifiable without being loud
const TYPE_ICONS: Record<string, any> = {
  STORY:   BookOpen,
  TASK:    CheckSquare,
  BUG:     Bug,
  SUBTASK: GitBranch,
}

// Shared grid column template — used by header + every row
const GRID = 'grid-cols-[minmax(0,2.5fr)_140px_130px_130px_minmax(0,1.2fr)]'

// ── Component ─────────────────────────────────────────────────────────────────

interface ListViewProps {
  issues: IssueWithRelations[]
}

export function ListView({ issues }: ListViewProps) {
  const { openIssue } = useIssueSlideOver()
  const prefetchIssue = usePrefetchIssue()

  // Search state (Priority / Type / Team / Assignee are handled by the board-level filter bar)
  const [search, setSearch] = useState('')

  // Track which groups are manually toggled; default = open if has issues
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({})

  // Apply title/ID search (board-level filters already narrowed down the issues prop)
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return issues
    return issues.filter(issue =>
      issue.title.toLowerCase().includes(q) ||
      issue.displayId?.toLowerCase().includes(q)
    )
  }, [issues, search])

  const getGroupIssues = (status: string) =>
    status === 'TODO'
      ? filtered.filter(i => i.status === 'TODO' || i.status === 'BACKLOG')
      : filtered.filter(i => i.status === status)

  const isOpen = (status: string) => {
    if (status in toggledGroups) return toggledGroups[status]
    return getGroupIssues(status).length > 0  // open by default if has issues
  }

  const toggle = (status: string) => {
    setToggledGroups(prev => ({ ...prev, [status]: !isOpen(status) }))
  }

  const activeFilters = search !== ''

  return (
    <div className="flex flex-col gap-3">

      {/* ── Search bar ── */}
      <div className="flex items-center gap-3">
        <div className="relative min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search title or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {filtered.length} of {issues.length} issue{issues.length !== 1 ? 's' : ''}
          </span>
          {activeFilters && (
            <button
              onClick={() => setSearch('')}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

        {/* Single column header */}
        <div className={cn('grid border-b border-gray-200 bg-gray-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400', GRID)}>
          <span>Title</span>
          <span>Priority</span>
          <span>Type</span>
          <span>Team</span>
          <span>Assignee</span>
        </div>

        {/* Status groups — empty groups are hidden */}
        {GROUPS.map((group, groupIdx) => {
          const groupIssues = getGroupIssues(group.status)

          // Skip empty groups entirely — no visual noise
          if (groupIssues.length === 0) return null

          const open    = isOpen(group.status)
          const isLast  = groupIdx === GROUPS.length - 1

          return (
            <div key={group.status} className={cn(!isLast && 'border-b border-gray-100')}>

              {/* Group header — clean, white, no tint */}
              <button
                onClick={() => toggle(group.status)}
                className="flex w-full items-center gap-2.5 border-b border-gray-100 bg-white px-5 py-2.5 text-left transition-colors hover:bg-gray-50"
              >
                {open
                  ? <ChevronDown  className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                }
                <span className={cn('h-2 w-2 rounded-full shrink-0', group.dot)} />
                <span className="text-xs font-semibold text-gray-700">{group.label}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {groupIssues.length}
                </span>
              </button>

              {/* Issue rows */}
              {open && (
                <div className="divide-y divide-gray-50">
                  {groupIssues.map(issue => {
                    const TypeIcon     = TYPE_ICONS[issue.type] || CheckSquare
                    const typeColor    = TYPE_COLORS[issue.type as keyof typeof TYPE_COLORS] || 'text-gray-400'
                    const assigneeColor = getTeamColor(issue.assignee?.name || 'A')

                    return (
                      <div
                        key={issue.id}
                        onClick={() => openIssue(issue.id)}
                        onMouseEnter={() => prefetchIssue(issue.id)}
                        className={cn(
                          'grid cursor-pointer items-center px-5 py-3 transition-colors hover:bg-blue-50/50',
                          GRID,
                        )}
                      >
                        {/* Title + ID */}
                        <div className="flex min-w-0 items-center gap-3 pr-6">
                          <span className="w-12 shrink-0 font-mono text-xs font-semibold text-gray-300">
                            {issue.displayId}
                          </span>
                          <span className="truncate text-sm font-medium text-gray-800" title={issue.title}>
                            {issue.title}
                          </span>
                        </div>

                        {/* Priority — dot + muted pill */}
                        <div className="flex items-center">
                          {(() => {
                            const pc = getPriorityColor(issue.priority)
                            return (
                              <span className={cn(
                                'flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                                pc.bg, pc.text,
                              )}>
                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', pc.dot)} />
                                {PRIORITY_LABELS[issue.priority] || issue.priority}
                              </span>
                            )
                          })()}
                        </div>

                        {/* Type — colored icon, gray text */}
                        <div className="flex items-center gap-1.5">
                          <TypeIcon className={cn('h-3.5 w-3.5 shrink-0', typeColor)} />
                          <span className="text-xs text-gray-600">
                            {issue.type.charAt(0) + issue.type.slice(1).toLowerCase()}
                          </span>
                        </div>

                        {/* Team + story points */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            {issue.team?.name || '—'}
                          </span>
                          {issue.storyPoints != null && issue.storyPoints > 0 && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-400">
                              {issue.storyPoints}
                            </span>
                          )}
                        </div>

                        {/* Assignee */}
                        <div className="flex items-center gap-2">
                          {issue.assignee ? (
                            <>
                              <div
                                className={cn(
                                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                                  assigneeColor,
                                )}
                                title={issue.assignee.name || issue.assignee.email}
                              >
                                {(issue.assignee.name || issue.assignee.email || 'A').charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate text-xs text-gray-600" title={issue.assignee.name || issue.assignee.email}>
                                {issue.assignee.name?.split(' ')[0] || issue.assignee.email.split('@')[0]}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs italic text-gray-400">Unassigned</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">
              {issues.length === 0 ? 'No issues in this sprint' : 'No issues match your filters'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
