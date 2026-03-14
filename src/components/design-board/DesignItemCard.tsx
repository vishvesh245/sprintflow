'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DesignItem } from '@/hooks/useDesignItems'
import { cn, getTeamColor } from '@/lib/utils'
import { getPriorityColor } from '@/lib/colors'
import { ExternalLink } from 'lucide-react'

interface DesignItemCardProps {
  item: DesignItem
  onClick?: (item: DesignItem) => void
}

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

export function DesignItemCard({ item, onClick }: DesignItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const assigneeColorClass = getTeamColor(item.assignee?.name || 'A')

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(item)}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-shadow duration-200 select-none',
        'border-l-4 border-l-gray-400',
      )}
    >
      {/* Row 1: Priority + Figma link */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {item.priority && (
            <span
              className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                getPriorityColor(item.priority).badge,
              )}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {item.figmaLink && (
            <a
              href={item.figmaLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-500 hover:text-blue-700 transition-colors"
              title="Open in Figma"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Row 2: Title */}
      <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 leading-snug">
        {item.title}
      </h3>

      {/* Row 3: Assignee + Visual Designer */}
      <div className="flex items-center gap-2">
        {item.assignee ? (
          <div
            className={cn(
              'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold',
              assigneeColorClass,
            )}
            title={`Assignee: ${item.assignee.name || item.assignee.email}`}
          >
            {(item.assignee.name || item.assignee.email || 'A').charAt(0).toUpperCase()}
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-gray-100 text-gray-400 text-xs"
            title="Unassigned"
          >
            ?
          </div>
        )}
        {item.visualDesigner && (
          <div
            className={cn(
              'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white',
              getTeamColor(item.visualDesigner.name || 'V'),
            )}
            title={`Visual Designer: ${item.visualDesigner.name || item.visualDesigner.email}`}
          >
            {(item.visualDesigner.name || item.visualDesigner.email || 'V').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}
