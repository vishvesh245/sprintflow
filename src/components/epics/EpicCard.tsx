'use client'

import Link from 'next/link'
import { StatusBadge } from '../issues/StatusBadge'

interface TeamProgress {
  team: string
  progress: number
  color: string
}

interface EpicCardProps {
  id: string
  title: string
  status: string
  targetSprint?: {
    name: string
  }
  issueCount: number
  overallProgress: number
  teamProgress: TeamProgress[]
}

export function EpicCard({
  id,
  title,
  status,
  targetSprint,
  issueCount,
  overallProgress,
  teamProgress,
}: EpicCardProps) {
  const isCompleted = status === 'COMPLETED'

  return (
    <Link href={`/epics/${id}`}>
      <div
        className={`rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-lg ${
          isCompleted ? 'opacity-60' : ''
        }`}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 hover:text-blue-600">
                {title}
              </h3>
              {targetSprint && (
                <p className="mt-1 text-xs text-gray-500">{targetSprint.name}</p>
              )}
            </div>
            <StatusBadge status={status} size="sm" />
          </div>

          {/* Progress bars by team */}
          <div className="space-y-2">
            {teamProgress.map((tp) => (
              <div key={tp.team} className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">{tp.team}</p>
                  <p className="text-xs text-gray-500">{tp.progress}%</p>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full ${tp.color}`}
                    style={{ width: `${tp.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Overall progress and count */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">
                {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
              </p>
              <p className="text-xs font-semibold text-gray-900">
                {overallProgress}% complete
              </p>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
