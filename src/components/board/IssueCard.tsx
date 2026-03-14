'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IssueWithRelations } from '@/types'
import { cn, getTeamColor } from '@/lib/utils'
import { getPriorityColor } from '@/lib/colors'
import { BookOpen, CheckSquare, Bug, GitBranch } from 'lucide-react'
import { usePrefetchIssue } from '@/hooks/usePrefetchIssue'
import { useIssueSlideOver } from '@/contexts/IssueSlideOverContext'

interface IssueCardProps {
  issue: IssueWithRelations
  /** Show sprint name badge on the card (used in backlog board view) */
  showSprintBadge?: boolean
}

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

const TYPE_ICONS: Record<string, any> = {
  STORY: BookOpen,
  TASK: CheckSquare,
  BUG: Bug,
  SUBTASK: GitBranch,
}

// Map bg-* classes → border-l-* classes for the left accent border.
// Static mapping is required because Tailwind JIT won't tree-shake dynamic strings.
const BORDER_COLOR_MAP: Record<string, string> = {
  'bg-blue-500': 'border-l-blue-500',
  'bg-purple-500': 'border-l-purple-500',
  'bg-pink-500': 'border-l-pink-500',
  'bg-green-500': 'border-l-green-500',
  'bg-yellow-500': 'border-l-yellow-500',
  'bg-red-500': 'border-l-red-500',
  'bg-indigo-500': 'border-l-indigo-500',
  'bg-cyan-500': 'border-l-cyan-500',
}

export function IssueCard({ issue, showSprintBadge }: IssueCardProps) {
  const { openIssue } = useIssueSlideOver()
  const prefetchIssue = usePrefetchIssue()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const TypeIcon = TYPE_ICONS[issue.type] || CheckSquare
  const teamColorClass = getTeamColor(issue.team?.prefix || 'default')
  const borderColorClass = BORDER_COLOR_MAP[teamColorClass] || 'border-l-blue-500'
  const assigneeColorClass = getTeamColor(issue.assignee?.name || 'A')

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => openIssue(issue.id)}
      onMouseEnter={() => prefetchIssue(issue.id)}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-shadow duration-200 select-none',
        'border-l-4',
        borderColorClass,
      )}
    >
      {/* Row 1: [TypeIcon + ID]  [Priority pill] */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <TypeIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-semibold text-gray-500 truncate" title={issue.displayId || `${issue.team?.prefix}-${issue.id.slice(0, 5)}`}>
            {issue.displayId || `${issue.team?.prefix}-${issue.id.slice(0, 5)}`}
          </span>
        </div>
        <span
          className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
            getPriorityColor(issue.priority).badge,
          )}
        >
          {PRIORITY_LABELS[issue.priority] || issue.priority}
        </span>
      </div>

      {/* Row 2: Title */}
      <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 leading-snug" title={issue.title}>
        {issue.title}
      </h3>

      {/* Optional sprint badge (backlog board view) */}
      {showSprintBadge && issue.sprint && (
        <span className="inline-block text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full mb-2 truncate max-w-full" title={issue.sprint.name}>
          {issue.sprint.name}
        </span>
      )}

      {/* Row 3: [team dot + prefix + points]   [assignee avatar] */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className={cn('w-2 h-2 rounded-full shrink-0', teamColorClass)} />
          <span className="text-xs text-gray-400">{issue.team?.prefix}</span>
          {issue.storyPoints != null && (
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ml-1">
              {issue.storyPoints}
            </span>
          )}
        </div>

        {issue.assignee ? (
          <div
            className={cn(
              'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold',
              assigneeColorClass,
            )}
            title={issue.assignee.name || issue.assignee.email}
          >
            {(issue.assignee.name || issue.assignee.email || 'A').charAt(0).toUpperCase()}
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-gray-100 text-gray-400 text-xs"
            title="Unassigned"
          >
            ?
          </div>
        )}
      </div>
    </div>
  )
}
