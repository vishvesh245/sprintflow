'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useSprints } from '@/hooks/useSprints'
import { Sprint } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── Sprint card — navigates to /sprint/[id] on click ─────────────────────────

function SprintCard({ sprint }: { sprint: { id: string; name: string; startDate: string | Date; endDate: string | Date; status: string } }) {
  const isCompleted = sprint.status === 'COMPLETED'

  return (
    <Link
      href={`/sprint/${sprint.id}`}
      className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50"
    >
      <Calendar className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-blue-500" />

      <span className="text-sm font-semibold text-gray-900">{sprint.name}</span>

      <span className="text-xs text-gray-400">
        {fmt(sprint.startDate)} – {fmt(sprint.endDate)}
      </span>

      <span className="ml-auto flex items-center gap-2">
        {isCompleted ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Completed
          </span>
        ) : (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            Planning
          </span>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
      </span>
    </Link>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface SprintHistorySectionProps {
  planningSprints?: Sprint[]
}

export default function SprintHistorySection({ planningSprints = [] }: SprintHistorySectionProps) {
  const [showCompleted, setShowCompleted] = useState(false)
  const [showUpcoming, setShowUpcoming] = useState(true)

  // Fetch completed sprints with summary mode (no issue data)
  const { sprints: completedSprints, isLoading } = useSprints('COMPLETED', { summary: true })

  // Use planning sprints passed from parent (already fetched via useSprints('PLANNING'))
  const upcomingSprints = planningSprints

  if (isLoading) return (
    <div className="px-6 pb-10 mt-2">
      <div className="mb-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-gray-200" />
        <div className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-lg border border-gray-100 bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )

  if (completedSprints.length === 0 && upcomingSprints.length === 0) return null

  return (
    <div className="px-6 pb-10 mt-2">
      {/* Divider */}
      <div className="mb-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Sprint History
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="space-y-6">

        {/* ── Upcoming Sprints ── */}
        {upcomingSprints.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowUpcoming(u => !u)}
              className="flex w-full items-center gap-2 text-left"
            >
              {showUpcoming
                ? <ChevronDown className="h-4 w-4 text-gray-400" />
                : <ChevronRight className="h-4 w-4 text-gray-400" />
              }
              <span className="text-sm font-semibold text-gray-900">Upcoming Sprints</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                {upcomingSprints.length}
              </span>
            </button>

            {showUpcoming && (
              <div className="space-y-1.5 pl-6">
                {upcomingSprints.map(sprint => (
                  <SprintCard key={sprint.id} sprint={sprint} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Completed Sprints ── */}
        {completedSprints.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowCompleted(c => !c)}
              className="flex w-full items-center gap-2 text-left"
            >
              {showCompleted
                ? <ChevronDown className="h-4 w-4 text-gray-400" />
                : <ChevronRight className="h-4 w-4 text-gray-400" />
              }
              <span className="text-sm font-semibold text-gray-900">Completed Sprints</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                {completedSprints.length}
              </span>
            </button>

            {showCompleted && (
              <div className="space-y-1.5 pl-6">
                {completedSprints.map(sprint => (
                  <SprintCard key={sprint.id} sprint={sprint} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
