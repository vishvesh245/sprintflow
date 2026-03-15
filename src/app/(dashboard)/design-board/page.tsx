'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { LayoutGrid, List, Plus, X, Search, ExternalLink, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getStatusColor, getStatusBadge } from '@/lib/colors'
import { useDesignItems, DesignItem } from '@/hooks/useDesignItems'
import { useTeams } from '@/hooks/useTeams'
import { useUsers } from '@/hooks/useUsers'
import { DesignItemCard } from '@/components/design-board/DesignItemCard'
import { DesignItemForm } from '@/components/design-board/DesignItemForm'
import { MorphingShapeLoader } from '@/components/ui/loaders'

type DesignStatus = 'DRAFT' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
type ViewMode = 'board' | 'list'

const VIEW_PREF_KEY = 'sprintsync-design-board-view'

const COLUMNS: Array<{ status: DesignStatus; title: string }> = [
  { status: 'DRAFT', title: 'Draft' },
  { status: 'IN_PROGRESS', title: 'In Progress' },
  { status: 'IN_REVIEW', title: 'In Review' },
  { status: 'DONE', title: 'Done' },
]

const DESIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-300',
  IN_PROGRESS: getStatusColor('IN_PROGRESS').bar,
  IN_REVIEW: getStatusColor('IN_REVIEW').bar,
  DONE: getStatusColor('DONE').bar,
}

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

type SortOption = 'priority' | 'title' | 'newest' | 'oldest'

const COLUMN_STATUSES = new Set<string>(COLUMNS.map((c) => c.status))

const CHEVRON_STYLE = {
  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundSize: '16px',
  backgroundPosition: 'right 8px center',
  backgroundRepeat: 'no-repeat',
} as const

function DesignColumn({
  status,
  title,
  items,
  onItemClick,
}: {
  status: string
  title: string
  items: DesignItem[]
  onItemClick: (item: DesignItem) => void
}) {
  const { setNodeRef } = useDroppable({ id: status })
  const headerColor = DESIGN_STATUS_COLORS[status] || 'bg-gray-300'

  return (
    <div className="flex flex-col w-full min-w-80 bg-gray-50 rounded-lg border border-gray-200 h-fit">
      <div className={cn('h-1.5 rounded-t-lg', headerColor)} />
      <div className="px-4 py-3.5 border-b-2 border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 tracking-tight">{title}</h3>
          <span className="text-xs font-bold text-gray-700 bg-gray-200 px-2.5 py-1 rounded-full min-w-[28px] text-center">
            {items.length}
          </span>
        </div>
      </div>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-96">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p className="text-sm">No items</p>
            </div>
          ) : (
            items.map((item) => (
              <DesignItemCard
                key={item.id}
                item={item}
                onClick={onItemClick}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

export default function DesignBoardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { items, isLoading } = useDesignItems()
  const { teams } = useTeams()
  const { users } = useUsers()

  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssigneeId, setFilterAssigneeId] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('priority')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [dueDateSort, setDueDateSort] = useState<'asc' | 'desc' | null>(null)

  // Find the Design team to filter assignees
  const designTeam = useMemo(
    () => teams.find((t) => t.prefix === 'DS' || t.name === 'Design'),
    [teams],
  )
  // Only show design team members in the assignee filter and form
  const designUsers = useMemo(
    () => designTeam ? users.filter((u) => u.teamId === designTeam.id) : users,
    [users, designTeam],
  )

  // Local state for optimistic drag updates
  const [localItems, setLocalItems] = useState<DesignItem[]>(items)
  const pendingMove = useRef<{ id: string; status: DesignStatus } | null>(null)

  useEffect(() => {
    if (!pendingMove.current) {
      setLocalItems(items)
    } else {
      const { id, status } = pendingMove.current
      const serverHasCaughtUp = items.some((i) => i.id === id && i.status === status)
      const merged = items.map((i) =>
        i.id === id && !serverHasCaughtUp ? { ...i, status } : i,
      )
      setLocalItems(merged)
      if (serverHasCaughtUp) pendingMove.current = null
    }
  }, [items])

  // Restore persisted view preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_PREF_KEY)
      if (saved === 'board' || saved === 'list') setViewMode(saved)
    } catch {}
  }, [])

  const handleSetView = (mode: ViewMode) => {
    setViewMode(mode)
    try { localStorage.setItem(VIEW_PREF_KEY, mode) } catch {}
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  // Client-side filtering + search + sort
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const filtered = localItems.filter((item) => {
      const matchStatus = filterStatus === 'all' || item.status === filterStatus
      const matchPriority = filterPriority === 'all' || item.priority === filterPriority
      const matchAssignee = filterAssigneeId === 'all'
        || (filterAssigneeId === 'unassigned' ? !item.assignee : item.assignee?.id === filterAssigneeId)
      const matchSearch = !query || item.title.toLowerCase().includes(query)
      return matchStatus && matchPriority && matchAssignee && matchSearch
    })

    // Sort
    const sorted = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority': {
          const pa = a.priority ? PRIORITY_ORDER[a.priority] ?? 99 : 99
          const pb = b.priority ? PRIORITY_ORDER[b.priority] ?? 99 : 99
          return pa - pb
        }
        case 'title':
          return a.title.localeCompare(b.title)
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        default:
          return 0
      }
    })

    // Apply due date sort if active (overrides primary sort)
    if (dueDateSort) {
      return sorted.sort((a, b) => {
        const da = a.endDate ? new Date(a.endDate).getTime() : Infinity
        const db = b.endDate ? new Date(b.endDate).getTime() : Infinity
        return dueDateSort === 'asc' ? da - db : db - da
      })
    }

    return sorted
  }, [localItems, filterStatus, filterPriority, filterAssigneeId, searchQuery, sortBy, dueDateSort])

  // Group by status for kanban
  const groupedItems = useMemo(() => {
    return COLUMNS.reduce(
      (acc, column) => {
        acc[column.status] = filteredItems.filter((i) => i.status === column.status)
        return acc
      },
      {} as Record<DesignStatus, DesignItem[]>,
    )
  }, [filteredItems])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeItem = localItems.find((i) => i.id === active.id)

    let newStatus: DesignStatus
    if (COLUMN_STATUSES.has(over.id as string)) {
      newStatus = over.id as DesignStatus
    } else {
      const overItem = localItems.find((i) => i.id === over.id)
      if (!overItem) return
      newStatus = overItem.status
    }

    if (!activeItem || activeItem.status === newStatus) return

    // Optimistic update
    const snapshot = localItems
    setLocalItems(localItems.map((i) =>
      i.id === activeItem.id ? { ...i, status: newStatus } : i,
    ))
    pendingMove.current = { id: activeItem.id, status: newStatus }

    const columnTitle = COLUMNS.find((c) => c.status === newStatus)?.title ?? newStatus
    const toastId = toast.success(`Moved to ${columnTitle}`)

    try {
      const res = await fetch(`/api/design-items/${activeItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        toast.dismiss(toastId)
        toast.error('Failed to move item')
        pendingMove.current = null
        setLocalItems(snapshot)
      } else {
        queryClient.invalidateQueries({ queryKey: ['design-items'] })
      }
    } catch {
      toast.dismiss(toastId)
      toast.error('Network error')
      pendingMove.current = null
      setLocalItems(snapshot)
    }
  }

  const handleCreateItem = async (formData: any) => {
    const payload: any = {
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority || undefined,
      figmaLink: formData.figmaLink || undefined,
      assigneeId: formData.assigneeId || undefined,
      visualDesignerId: formData.visualDesignerId || undefined,
      teamId: formData.teamId,
    }
    if (formData.startDate) {
      payload.startDate = new Date(formData.startDate).toISOString()
    }
    if (formData.endDate) {
      payload.endDate = new Date(formData.endDate).toISOString()
    }

    const res = await fetch('/api/design-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to create design item')
    }

    setShowCreateModal(false)
    toast.success('Design ticket created')
    queryClient.invalidateQueries({ queryKey: ['design-items'] })
  }

  const handleItemClick = (item: DesignItem) => {
    router.push(`/design-board/${item.id}`)
  }

  const hasActiveFilters = filterStatus !== 'all' || filterPriority !== 'all' || filterAssigneeId !== 'all' || searchQuery !== ''

  const clearFilters = () => {
    setFilterStatus('all')
    setFilterPriority('all')
    setFilterAssigneeId('all')
    setSearchQuery('')
  }

  if (!session) {
    return <MorphingShapeLoader message="Loading designs..." fullScreen />
  }

  return (
    <div className="w-full h-full flex flex-col p-6">
      {/* Header — visually distinct from cards */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-end gap-3">
            {/* Create button — matches dashboard blue */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Design Ticket
            </button>

            {/* View toggle — matches dashboard blue */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                onClick={() => handleSetView('board')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                  viewMode === 'board'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Board
              </button>
              <div className="w-px h-6 bg-gray-200" />
              <button
                onClick={() => handleSetView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                  viewMode === 'list'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                )}
              >
                <List className="h-4 w-4" />
                List
              </button>
            </div>
        </div>

        {/* Filter bar — inside the header section */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              className="rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-600 focus:border-blue-400 focus:outline-none w-48"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={CHEVRON_STYLE}
            className="rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-600 focus:border-blue-400 focus:outline-none appearance-none"
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            style={CHEVRON_STYLE}
            className="rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-600 focus:border-blue-400 focus:outline-none appearance-none"
          >
            <option value="all">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={filterAssigneeId}
            onChange={(e) => setFilterAssigneeId(e.target.value)}
            style={CHEVRON_STYLE}
            className="rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-600 focus:border-blue-400 focus:outline-none appearance-none"
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {designUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.name || user.email}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={CHEVRON_STYLE}
            className="rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-600 focus:border-blue-400 focus:outline-none appearance-none"
          >
            <option value="priority">Sort: Priority</option>
            <option value="title">Sort: Title</option>
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
          </select>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {filteredItems.length} of {localItems.length} item{localItems.length !== 1 ? 's' : ''}
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <MorphingShapeLoader message="Loading designs..." className="flex-1" />
      ) : (
        <>
          {/* Board view */}
          <div className={viewMode === 'board' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
              <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
                {COLUMNS.map((column) => (
                  <DesignColumn
                    key={column.status}
                    status={column.status}
                    title={column.title}
                    items={groupedItems[column.status] || []}
                    onItemClick={handleItemClick}
                  />
                ))}
              </div>
            </DndContext>
          </div>

          {/* List view */}
          <div className={viewMode === 'list' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No design tickets found.</div>
            ) : (
              <div className="overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-left border-b-2 border-gray-300">
                    <tr>
                      <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider w-[28%]">Title</th>
                      <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider w-[11%]">Status</th>
                      <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider w-[10%]">Priority</th>
                      <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider w-[14%]">Assignee</th>
                      <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider w-[14%]">Visual Designer</th>
                      <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider w-[7%] text-center">Figma</th>
                      <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider w-[10%]">
                        <button
                          onClick={() => setDueDateSort(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}
                          className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                        >
                          Due Date
                          <ArrowUpDown className={cn('h-3.5 w-3.5', dueDateSort ? 'text-blue-600' : 'text-gray-400')} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleItemClick(item)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{item.title}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs font-medium px-2 py-1 rounded-full',
                            item.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' : getStatusBadge(item.status),
                          )}>
                            {COLUMNS.find((c) => c.status === item.status)?.title || item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {item.priority || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {item.assignee?.name || item.assignee?.email || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {item.visualDesigner?.name || item.visualDesigner?.email || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.figmaLink ? (
                            <a
                              href={item.figmaLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center text-blue-500 hover:text-blue-700 transition-colors"
                              title="Open in Figma"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {item.endDate
                            ? new Date(item.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Design Item Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false)
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Design Ticket</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <DesignItemForm
                teams={designTeam ? [designTeam] : teams}
                users={designUsers}
                onSubmit={handleCreateItem}
                onCancel={() => setShowCreateModal(false)}
                hideTeam
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
