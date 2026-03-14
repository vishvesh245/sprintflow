'use client'

import { IssueWithRelations } from '@/types'
import { X } from 'lucide-react'
import { getPriorityBadge, STATUS_COLORS } from '@/lib/colors'
import { usePrefetchIssue } from '@/hooks/usePrefetchIssue'
import { useIssueSlideOver } from '@/contexts/IssueSlideOverContext'

interface BacklogListProps {
  issues: IssueWithRelations[]
  selectedIssueIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  onRemoveFromSprint: (issueId: string, sprintId: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  READY_FOR_QA: 'Ready for QA',
  IN_REVIEW: 'In Review',
  BLOCKED: 'Blocked',
  DONE: 'Done',
}

export default function BacklogList({
  issues,
  selectedIssueIds,
  onSelectionChange,
  onRemoveFromSprint,
}: BacklogListProps) {
  const prefetchIssue = usePrefetchIssue()
  const { openIssue } = useIssueSlideOver()

  const toggleIssueSelection = (issueId: string) => {
    const newSelected = new Set(selectedIssueIds)
    if (newSelected.has(issueId)) {
      newSelected.delete(issueId)
    } else {
      newSelected.add(issueId)
    }
    onSelectionChange(newSelected)
  }

  const toggleAllSelection = () => {
    const allIds = issues.map(i => i.id)
    if (allIds.length > 0 && allIds.every(id => selectedIssueIds.has(id))) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(allIds))
    }
  }

  const getPriorityColor = (priority: string) => getPriorityBadge(priority)

  const TYPE_LABEL: Record<string, string> = {
    STORY: 'Story',
    TASK: 'Task',
    BUG: 'Bug',
    SUBTASK: 'Subtask',
  }

  const getTeamColor = (teamName?: string) => {
    switch (teamName) {
      case 'Frontend': return 'bg-blue-100 text-blue-800'
      case 'Backend': return 'bg-green-100 text-green-800'
      case 'QA': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS]
    return colors?.badge || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="space-y-2">
      {/* Issues Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <input
            type="checkbox"
            checked={issues.length > 0 && issues.every(i => selectedIssueIds.has(i.id))}
            onChange={toggleAllSelection}
            className="h-4 w-4 text-blue-600 border border-gray-300 rounded cursor-pointer"
          />
          <div className="flex-1 grid gap-3 text-xs font-semibold text-gray-700" style={{ gridTemplateColumns: '72px 1fr 90px 100px 110px 64px 80px 40px 64px' }}>
            <div>ID</div>
            <div>Title</div>
            <div>Status</div>
            <div>Sprint</div>
            <div>Team</div>
            <div>Type</div>
            <div>Priority</div>
            <div>Pts</div>
            <div>Assignee</div>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-200">
          {issues.map(issue => (
            <div
              key={issue.id}
              className="px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 group"
            >
              <input
                type="checkbox"
                checked={selectedIssueIds.has(issue.id)}
                onChange={() => toggleIssueSelection(issue.id)}
                className="h-4 w-4 text-blue-600 border border-gray-300 rounded cursor-pointer"
              />
              <div
                onClick={() => openIssue(issue.id)}
                onMouseEnter={() => prefetchIssue(issue.id)}
                className="flex-1 grid gap-3 items-center text-sm hover:text-blue-600 cursor-pointer min-w-0"
                style={{ gridTemplateColumns: '72px 1fr 90px 100px 110px 64px 80px 40px 64px' }}
              >
                <div className="font-semibold text-gray-900 truncate" title={issue.displayId}>{issue.displayId}</div>
                <div className="text-gray-700 truncate" title={issue.title}>{issue.title}</div>
                <div className="min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium truncate max-w-full ${getStatusBadge(issue.status)}`} title={STATUS_LABEL[issue.status] || issue.status}>
                    {STATUS_LABEL[issue.status] || issue.status}
                  </span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  {issue.sprint ? (
                    <div className="flex items-center gap-1 group/sprint min-w-0">
                      <span className="truncate text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full" title={issue.sprint.name}>
                        {issue.sprint.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onRemoveFromSprint(issue.id, issue.sprintId!)
                        }}
                        className="shrink-0 opacity-0 group-hover/sprint:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                        title="Remove from sprint"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
                <div className="min-w-0">
                  {issue.team && (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium truncate max-w-full ${getTeamColor(issue.team.name)}`} title={issue.team.name}>
                      {issue.team.name}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 truncate" title={TYPE_LABEL[issue.type] || issue.type}>{TYPE_LABEL[issue.type] || issue.type}</div>
                <div className="min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium truncate max-w-full ${getPriorityColor(issue.priority)}`} title={issue.priority}>
                    {issue.priority}
                  </span>
                </div>
                <div className="text-gray-600 text-sm">{issue.storyPoints ?? '—'}</div>
                <div className="flex items-center">
                  {issue.assignee ? (
                    <div
                      className="h-6 w-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-semibold text-blue-900 shrink-0"
                      title={issue.assignee.name || issue.assignee.email}
                    >
                      {(issue.assignee.name || issue.assignee.email || 'A')[0].toUpperCase()}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {issues.length === 0 && (
          <div className="px-4 py-10 text-center text-gray-500">
            <p className="text-sm">No issues match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
