'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { IssueWithRelations, IssueStatus } from '@/types'
import { KanbanColumn } from './KanbanColumn'

interface KanbanBoardProps {
  issues: IssueWithRelations[]
  /** Called with the full updated issue returned by the PATCH response */
  onIssueUpdated?: (updated: IssueWithRelations) => void
  /** Show sprint name badge on cards (used in backlog board view) */
  showSprintBadge?: boolean
}

const COLUMNS: Array<{ status: IssueStatus; title: string }> = [
  { status: 'TODO', title: 'To Do' },
  { status: 'IN_PROGRESS', title: 'In Progress' },
  { status: 'READY_FOR_QA', title: 'Ready for QA' },
  { status: 'IN_REVIEW', title: 'In Review' },
  { status: 'BLOCKED', title: 'Blocked' },
  { status: 'DONE', title: 'Done' },
]

const COLUMN_STATUSES = new Set<string>(COLUMNS.map((c) => c.status))

export function KanbanBoard({ issues, onIssueUpdated, showSprintBadge }: KanbanBoardProps) {
  const [localIssues, setLocalIssues] = useState<IssueWithRelations[]>(issues)
  // Track the id+status of the issue currently being moved so we can preserve
  // the optimistic update while the parent refetches stale data.
  const pendingMove = useRef<{ id: string; status: IssueStatus } | null>(null)

  useEffect(() => {
    if (!pendingMove.current) {
      // No in-flight move — just sync from parent (initial load or external change)
      setLocalIssues(issues)
    } else {
      // A move just completed. Merge: keep the moved issue at its new status
      // in case the refetch hasn't returned the updated row yet.
      const { id, status } = pendingMove.current
      const serverHasCaughtUp = issues.some((i) => i.id === id && i.status === status)
      const merged = issues.map((i) =>
        i.id === id && !serverHasCaughtUp ? { ...i, status } : i,
      )
      setLocalIssues(merged)
      if (serverHasCaughtUp) {
        pendingMove.current = null
      }
    }
  }, [issues])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const groupedIssues = COLUMNS.reduce(
    (acc, column) => {
      if (column.status === 'TODO') {
        // Issues assigned to a sprint may still carry BACKLOG status —
        // treat them as "To Do" so they're visible and draggable on the board.
        acc[column.status] = localIssues.filter(
          (issue) => issue.status === 'TODO' || issue.status === 'BACKLOG',
        )
      } else {
        acc[column.status] = localIssues.filter(
          (issue) => issue.status === column.status,
        )
      }
      return acc
    },
    {} as Record<IssueStatus, IssueWithRelations[]>,
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const activeIssue = localIssues.find((i) => i.id === active.id)

    // over.id can be either a column status (dropped on the column background)
    // OR another issue's id (dropped on top of a card, because cards are
    // sortable and therefore also act as drop targets). Resolve both cases.
    let newStatus: IssueStatus
    if (COLUMN_STATUSES.has(over.id as string)) {
      newStatus = over.id as IssueStatus
    } else {
      // Dropped on another card — derive the column from that card's status.
      const overIssue = localIssues.find((i) => i.id === over.id)
      if (!overIssue) return
      // BACKLOG issues are displayed in the TODO column
      newStatus = (overIssue.status === 'BACKLOG' ? 'TODO' : overIssue.status) as IssueStatus
    }

    if (!activeIssue || activeIssue.status === newStatus) {
      return
    }

    console.log('[Board] drag →', activeIssue.displayId, activeIssue.status, '→', newStatus)

    // Snapshot before optimistic update — used for accurate revert on error
    const snapshot = localIssues

    // Optimistic UI update
    const updatedIssues = localIssues.map((issue) =>
      issue.id === activeIssue.id ? { ...issue, status: newStatus } : issue,
    )
    setLocalIssues(updatedIssues)

    // Record the pending move BEFORE the API call so the useEffect can
    // preserve the optimistic position even if the parent refetches stale data.
    pendingMove.current = { id: activeIssue.id, status: newStatus }

    // Show success toast immediately with the optimistic update — dismiss and
    // replace with an error toast only if the API call fails.
    const columnTitle = COLUMNS.find((c) => c.status === newStatus)?.title ?? newStatus
    const toastId = toast.success(`Moved to ${columnTitle}`)

    try {
      const response = await fetch(`/api/issues/${activeIssue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        const msg = errBody?.error ?? 'Failed to move issue'
        console.error('[Board] PATCH failed', response.status, msg)
        toast.dismiss(toastId)
        toast.error(`Move failed: ${msg}`)
        // Revert to pre-drag snapshot on error
        pendingMove.current = null
        setLocalIssues(snapshot)
      } else {
        const updatedIssue: IssueWithRelations = await response.json()
        console.log('[Board] PATCH ok →', updatedIssue.status)
        // Pass the server-confirmed issue to the parent so it can update
        // the React Query cache immediately — no refetch latency.
        onIssueUpdated?.(updatedIssue)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      toast.dismiss(toastId)
      toast.error(`Network error – ${msg}`)
      // Revert to pre-drag snapshot on error
      pendingMove.current = null
      setLocalIssues(snapshot)
      console.error('[Board] fetch error:', error)
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Board */}
      <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              title={column.title}
              issues={groupedIssues[column.status]}
              color="gray"
              showSprintBadge={showSprintBadge}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
