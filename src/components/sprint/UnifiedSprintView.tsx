'use client'

import { Sprint, IssueWithRelations } from '@/types'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, getStatusHex } from '@/lib/colors'
import { AlertCircle, User } from 'lucide-react'

interface UnifiedSprintViewProps {
  sprint: Sprint
  issues: IssueWithRelations[]
}

// ── Status config: uses centralized palette ─────────────────────────
const STATUS_CONFIG = [
  { key: 'DONE', color: STATUS_COLORS.DONE.bar, dot: STATUS_COLORS.DONE.dot, label: 'Done' },
  { key: 'IN_PROGRESS', color: STATUS_COLORS.IN_PROGRESS.bar, dot: STATUS_COLORS.IN_PROGRESS.dot, label: 'In Progress' },
  { key: 'READY_FOR_QA', color: STATUS_COLORS.READY_FOR_QA.bar, dot: STATUS_COLORS.READY_FOR_QA.dot, label: 'Ready for QA' },
  { key: 'IN_REVIEW', color: STATUS_COLORS.IN_REVIEW.bar, dot: STATUS_COLORS.IN_REVIEW.dot, label: 'Review' },
  { key: 'BLOCKED', color: STATUS_COLORS.BLOCKED.bar, dot: STATUS_COLORS.BLOCKED.dot, label: 'Blocked' },
  { key: 'TODO', color: STATUS_COLORS.TODO.bar, dot: STATUS_COLORS.TODO.dot, label: 'Todo' },
]

// ── SVG Progress Ring ──────────────────────────────────────────────
function ProgressRing({ percentage }: { percentage: number }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width="88" height="88" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="#ecfdf5" strokeWidth="6"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke={getStatusHex('DONE')} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-gray-900">{Math.round(percentage)}%</span>
      </div>
    </div>
  )
}

export default function UnifiedSprintView({ sprint, issues }: UnifiedSprintViewProps) {
  const router = useRouter()

  // ── Stats ────────────────────────────────────────────────────────
  const totalIssues = issues.length
  const totalDone = issues.filter(i => i.status === 'DONE').length
  const overallProgress = totalIssues > 0 ? (totalDone / totalIssues) * 100 : 0

  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(sprint.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  )

  const totalDays = Math.max(
    1,
    Math.ceil((new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) / (1000 * 60 * 60 * 24))
  )
  const daysElapsed = totalDays - daysRemaining

  // ── Status counts ────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    STATUS_CONFIG.forEach(s => { counts[s.key] = 0 })
    issues.forEach(issue => {
      if (counts[issue.status] !== undefined) counts[issue.status]++
      else counts[issue.status] = 1
    })
    return counts
  }, [issues])

  // ── Dynamic team grouping ────────────────────────────────────────
  const teamGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; issues: IssueWithRelations[] }>()
    issues.forEach(issue => {
      if (!issue.team) return
      const existing = map.get(issue.team.id)
      if (existing) existing.issues.push(issue)
      else map.set(issue.team.id, { id: issue.team.id, name: issue.team.name, issues: [issue] })
    })
    return Array.from(map.values()).sort((a, b) => b.issues.length - a.issues.length)
  }, [issues])

  // ── Alert counts ─────────────────────────────────────────────────
  const blockedCount = statusCounts['BLOCKED'] || 0
  const unassignedCount = issues.filter(i => !i.assigneeId && i.status !== 'DONE').length

  // (Pace chip removed)

  // ── Helper: most notable non-done status for a team ──────────────
  function teamHighlight(teamIssues: IssueWithRelations[]) {
    const blocked = teamIssues.filter(i => i.status === 'BLOCKED').length
    if (blocked > 0) return { label: `${blocked} blocked`, isBlocked: true }
    const inReview = teamIssues.filter(i => i.status === 'IN_REVIEW').length
    if (inReview > 0) return { label: `${inReview} in review`, isBlocked: false }
    const readyForQA = teamIssues.filter(i => i.status === 'READY_FOR_QA').length
    if (readyForQA > 0) return { label: `${readyForQA} ready for QA`, isBlocked: false }
    const inProgress = teamIssues.filter(i => i.status === 'IN_PROGRESS').length
    if (inProgress > 0) return { label: `${inProgress} active`, isBlocked: false }
    const todo = teamIssues.filter(i => i.status === 'TODO').length
    if (todo > 0) return { label: `${todo} todo`, isBlocked: false }
    return null
  }

  return (
    <div className="space-y-3">

      {/* ── Hero Card: Ring + Stats + Status Bar ────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-8">
          {/* Progress Ring */}
          <ProgressRing percentage={overallProgress} />

          {/* Stats */}
          <div className="flex-1 space-y-3.5">
            {/* Top line */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {totalDone} / {totalIssues} completed
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-400">
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </span>
            </div>

            {/* Segmented status bar — blue shades */}
            {totalIssues > 0 ? (
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                {STATUS_CONFIG.map(status => {
                  const count = statusCounts[status.key] || 0
                  const pct = (count / totalIssues) * 100
                  if (pct === 0) return null
                  return (
                    <div
                      key={status.key}
                      className={cn(status.color, 'transition-all duration-500')}
                      style={{ width: `${pct}%` }}
                      title={`${status.label}: ${count}`}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="h-2 rounded-full bg-gray-100" />
            )}

            {/* Status legend — muted */}
            <div className="flex items-center gap-4 flex-wrap">
              {STATUS_CONFIG.map(status => {
                const count = statusCounts[status.key] || 0
                return (
                  <button
                    key={status.key}
                    onClick={() => router.push(`/board?status=${status.key}`)}
                    className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                  >
                    <span className={cn('w-2 h-2 rounded-full', status.dot)} />
                    <span className="text-xs text-gray-500">{status.label}</span>
                    <span className="text-xs font-semibold text-gray-700">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Team Breakdown: Horizontal Cards ────────────────────── */}
      {teamGroups.length > 0 && (
        <div className={cn(
          'grid gap-3',
          teamGroups.length === 1 && 'grid-cols-1',
          teamGroups.length === 2 && 'grid-cols-2',
          teamGroups.length >= 3 && teamGroups.length <= 4 && 'grid-cols-4',
          teamGroups.length >= 5 && 'grid-cols-3',
        )}>
          {teamGroups.map((team) => {
            const done = team.issues.filter(i => i.status === 'DONE').length
            const pct = team.issues.length > 0 ? Math.round((done / team.issues.length) * 100) : 0
            const highlight = teamHighlight(team.issues)

            return (
              <div
                key={team.id}
                onClick={() => router.push(`/board?teamId=${team.id}`)}
                className="rounded-xl border border-gray-200 bg-white p-4 cursor-pointer transition-all hover:border-blue-200 hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">{team.name}</span>
                  <span className="text-sm font-semibold text-blue-600">{pct}%</span>
                </div>
                <div className="h-1.5 bg-blue-50 rounded-full overflow-hidden mb-2.5">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {done} / {team.issues.length} done
                  </span>
                  {highlight && (
                    <span className={cn(
                      'text-[11px] font-medium',
                      highlight.isBlocked ? 'text-red-400' : 'text-gray-400',
                    )}>
                      {highlight.label}
                    </span>
                  )}
                  {!highlight && pct === 100 && (
                    <span className="text-[11px] font-medium text-blue-500">Complete</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Alerts Row ──────────────────────────────────────────── */}
      {(blockedCount > 0 || unassignedCount > 0 || totalIssues > 0) && (
        <div className="flex items-center gap-2 px-1">
          {blockedCount > 0 && (
            <button
              onClick={() => router.push(`/board?status=BLOCKED`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-100 bg-red-50/60 px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-100/60 transition-colors"
            >
              <AlertCircle className="w-3 h-3" />
              {blockedCount} blocked
            </button>
          )}
          {unassignedCount > 0 && (
            <button
              onClick={() => router.push(`/board?unassigned=true`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <User className="w-3 h-3" />
              {unassignedCount} unassigned
            </button>
          )}
          {/* Pace chip removed — was showing x/day rate */}
        </div>
      )}
    </div>
  )
}
