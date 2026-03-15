'use client'

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { IssueWithRelations } from '@/types'
import { IssueCard } from './IssueCard'
import { cn } from '@/lib/utils'
import { getStatusColor } from '@/lib/colors'

interface KanbanColumnProps {
  status: string
  title: string
  issues: IssueWithRelations[]
  color: string
  showSprintBadge?: boolean
}

export function KanbanColumn({
  status,
  title,
  issues,
  color,
  showSprintBadge,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
  })

  const headerColor = getStatusColor(status).bar

  return (
    <div className="flex flex-col w-full min-w-80 bg-gray-50 rounded-lg border border-gray-200 h-fit">
      {/* Column Header */}
      <div
        className={cn(
          'h-1 rounded-t-lg',
          headerColor,
        )}
      />

      <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {issues.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-96"
      >
        <SortableContext
          items={issues.map((issue) => issue.id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p className="text-sm">No tickets</p>
            </div>
          ) : (
            issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} showSprintBadge={showSprintBadge} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}
