'use client'

import { IssueWithRelations } from '@/types'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import SprintProgress from './SprintProgress'

interface TeamSwimLaneProps {
  teamName: string
  teamColor: 'blue' | 'green' | 'purple'
  issues: IssueWithRelations[]
  teamId?: string
}

const TEAM_COLORS = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', progress: 'bg-blue-600' },
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', progress: 'bg-green-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', progress: 'bg-purple-600' },
}

export default function TeamSwimLane({ teamName, teamColor, issues, teamId }: TeamSwimLaneProps) {
  const router = useRouter()
  const colors = TEAM_COLORS[teamColor]

  const handleCardClick = () => {
    router.push(teamId ? `/board?teamId=${teamId}` : '/board')
  }

  // Count issues by status
  const statusCounts = useMemo(() => {
    return {
      todo: issues.filter(i => i.status === 'TODO').length,
      in_progress: issues.filter(i => i.status === 'IN_PROGRESS').length,
      ready_for_qa: issues.filter(i => i.status === 'READY_FOR_QA').length,
      in_review: issues.filter(i => i.status === 'IN_REVIEW').length,
      blocked: issues.filter(i => i.status === 'BLOCKED').length,
      done: issues.filter(i => i.status === 'DONE').length,
    }
  }, [issues])

  const totalDone = issues.filter(i => i.status === 'DONE').length

  return (
    <div
      className={`${colors.bg} border ${colors.border} rounded-lg overflow-hidden flex flex-col h-full cursor-pointer hover:shadow-md transition-shadow`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className={`${colors.text} bg-white border-b ${colors.border} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">{teamName}</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {issues.length} issues
          </span>
        </div>
        <SprintProgress total={issues.length} done={totalDone} teamColor={teamColor} />
      </div>

      {/* Status Counts */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="grid grid-cols-6 gap-2 text-xs">
          <div>
            <div className="font-semibold text-gray-900">{statusCounts.todo}</div>
            <div className="text-gray-600">Todo</div>
          </div>
          <div>
            <div className="font-semibold text-yellow-600">{statusCounts.in_progress}</div>
            <div className="text-gray-600">In Progress</div>
          </div>
          <div>
            <div className="font-semibold text-orange-600">{statusCounts.ready_for_qa}</div>
            <div className="text-gray-600">Ready QA</div>
          </div>
          <div>
            <div className="font-semibold text-purple-600">{statusCounts.in_review}</div>
            <div className="text-gray-600">Review</div>
          </div>
          <div>
            <div className="font-semibold text-red-600">{statusCounts.blocked}</div>
            <div className="text-gray-600">Blocked</div>
          </div>
          <div>
            <div className="font-semibold text-green-600">{statusCounts.done}</div>
            <div className="text-gray-600">Done</div>
          </div>
        </div>
      </div>

      {/* Done Count */}
      <div className={`px-4 py-3 bg-green-50 border-t border-green-200 text-center`}>
        <div className="text-2xl font-bold text-green-700">{totalDone}</div>
        <div className="text-xs text-green-600 font-medium">Issues Completed</div>
      </div>
    </div>
  )
}
