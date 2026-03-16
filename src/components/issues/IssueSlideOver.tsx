'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { X, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIssueSlideOver } from '@/contexts/IssueSlideOverContext'
import { useIssue } from '@/hooks/useIssue'
import { useTeams } from '@/hooks/useTeams'
import { useUsers } from '@/hooks/useUsers'
import { useSprints } from '@/hooks/useSprints'
import { IssueDetail } from './IssueDetail'
import { CommentThread } from './CommentThread'
import { StatusBadge } from './StatusBadge'
import { ChildResolutionModal, ChildAction } from './ChildResolutionModal'
import { invalidateIssueCaches } from '@/lib/invalidateRelatedCaches'

// ─────────────────────────────────────────────────────────────────────────────
// Team color → gradient mapping for accent bar
// ─────────────────────────────────────────────────────────────────────────────
const TEAM_GRADIENT: Record<string, string> = {
  'bg-blue-500': 'from-blue-500 to-blue-400',
  'bg-purple-500': 'from-purple-500 to-purple-400',
  'bg-pink-500': 'from-pink-500 to-pink-400',
  'bg-green-500': 'from-green-500 to-green-400',
  'bg-yellow-500': 'from-yellow-500 to-yellow-400',
  'bg-red-500': 'from-red-500 to-red-400',
  'bg-indigo-500': 'from-indigo-500 to-indigo-400',
  'bg-cyan-500': 'from-cyan-500 to-cyan-400',
}

function getAccentGradient(teamColor?: string): string {
  if (!teamColor) return 'from-blue-500 to-blue-400'
  return TEAM_GRADIENT[teamColor] || 'from-blue-500 to-blue-400'
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader — mimics the real IssueDetail 3-column grid layout
// ─────────────────────────────────────────────────────────────────────────────
function IssueDetailSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="grid grid-cols-3 gap-8">
        {/* Main content skeleton */}
        <div className="col-span-2 space-y-6">
          {/* Title */}
          <div>
            <div className="h-7 bg-slate-200 rounded-md w-3/4 mb-2" />
            <div className="h-3.5 bg-slate-100 rounded w-1/3" />
          </div>
          {/* Description */}
          <div>
            <div className="h-3.5 bg-slate-100 rounded w-20 mb-3" />
            <div className="rounded-lg bg-slate-50 p-4 space-y-2.5">
              <div className="h-3 bg-slate-200 rounded w-full" />
              <div className="h-3 bg-slate-200 rounded w-5/6" />
              <div className="h-3 bg-slate-200 rounded w-3/6" />
            </div>
          </div>
          {/* Subtasks skeleton */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between">
              <div className="h-3.5 bg-slate-200 rounded w-16" />
              <div className="h-3 bg-slate-100 rounded w-12" />
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-slate-200" />
                  <div className="h-3 bg-slate-100 rounded w-10" />
                  <div className="h-3 bg-slate-100 rounded w-40" />
                </div>
              ))}
            </div>
          </div>
          {/* Comments skeleton */}
          <div>
            <div className="h-3.5 bg-slate-100 rounded w-20 mb-4" />
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="h-3 bg-slate-200 rounded w-24" />
                  <div className="h-3 bg-slate-100 rounded w-16" />
                </div>
                <div className="h-10 bg-slate-50 rounded-lg w-full" />
              </div>
            </div>
          </div>
        </div>
        {/* Sidebar skeleton */}
        <div className="col-span-1">
          <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {[12, 14, 16, 10, 12, 20, 8].map((w, i) => (
              <div key={i} className="px-5 py-4">
                <div className={`h-2.5 bg-slate-100 rounded mb-3`} style={{ width: `${w * 4}px` }} />
                <div className="h-5 bg-slate-200 rounded-full w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main slide-over component — Option B: Floating card with rounded corners
// ─────────────────────────────────────────────────────────────────────────────
export function IssueSlideOver() {
  const { issueId, closeIssue, isOpen } = useIssueSlideOver()
  const router = useRouter()

  // Animate open/close with a slight delay so the transition plays
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeIssue()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, closeIssue])

  // Lock body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Don't render anything if not open (after animation completes)
  if (!isOpen && !visible) return null

  return (
    <>
      {/* Backdrop — dark overlay with subtle blur */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ease-out',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={closeIssue}
        aria-hidden="true"
      />

      {/* Panel — floating card, inset from edges */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ticket detail"
        className={cn(
          // Floating card: inset 12px from top/bottom/right, rounded corners
          'fixed top-3 bottom-3 right-3 z-50 w-full max-w-4xl',
          'bg-white rounded-xl shadow-2xl ring-1 ring-black/5',
          'flex flex-col overflow-hidden',
          'transform transition-transform duration-200 ease-out',
          // Responsive: on small screens go full-width/full-height
          'max-lg:top-0 max-lg:bottom-0 max-lg:right-0 max-lg:rounded-none',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {issueId && <SlideOverContent issueId={issueId} onClose={closeIssue} />}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner content — separated so hooks only run when issueId exists
// ─────────────────────────────────────────────────────────────────────────────

function SlideOverContent({
  issueId,
  onClose,
}: {
  issueId: string
  onClose: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Resolution modal state
  const [pendingUpdate, setPendingUpdate] = useState<Record<string, any> | null>(null)
  const [openSubtasks, setOpenSubtasks] = useState<any[]>([])
  const [showResolutionModal, setShowResolutionModal] = useState(false)

  // Data queries
  const { issue, isLoading: issueLoading, error: issueError } = useIssue(issueId)
  const { teams } = useTeams()
  const { users } = useUsers()
  const { sprints: allSprints } = useSprints()

  const sprints = allSprints.filter(
    (s) => s.status !== 'COMPLETED' || s.id === issue?.sprintId,
  )

  const initialLoading = issueLoading && !issue
  const error = issueError?.message ?? null

  // Derive team accent color
  const teamColor = issue?.team?.color || 'bg-blue-500'
  const accentGradient = getAccentGradient(teamColor)

  // Invalidate helpers
  const invalidateIssue = () =>
    queryClient.invalidateQueries({ queryKey: ['issue', issueId] })

  // Delete issue
  const handleDelete = async () => {
    const res = await fetch(`/api/issues/${issueId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to delete ticket')
    }
    queryClient.removeQueries({ queryKey: ['issue', issueId] })
    invalidateIssueCaches(queryClient)
    onClose()
  }

  // Update issue
  const handleUpdate = async (
    updates: Record<string, any>,
    childActions?: Array<{ issueId: string; action: ChildAction }>,
  ) => {
    const payload = childActions ? { ...updates, childActions } : updates
    const res = await fetch(`/api/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.status === 409) {
      const data = await res.json()
      if (data.requiresResolution) {
        setPendingUpdate(updates)
        setOpenSubtasks(data.openSubtasks || [])
        setShowResolutionModal(true)
        return
      }
    }

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to update ticket')
    }

    const updatedIssue = await res.json()
    queryClient.setQueryData(['issue', issueId], updatedIssue)

    // Invalidate list caches so board/backlog reflect the change
    if ('sprintId' in updates || 'status' in updates) {
      invalidateIssueCaches(queryClient)
    }
  }

  const handleResolutionConfirm = async (
    actions: Array<{ issueId: string; action: ChildAction }>,
  ) => {
    if (!pendingUpdate) return
    await handleUpdate(pendingUpdate, actions)
    setShowResolutionModal(false)
    setPendingUpdate(null)
    setOpenSubtasks([])
  }

  // Add subtask
  const { mutateAsync: addSubtask } = useMutation({
    mutationFn: async (title: string) => {
      if (!issue) throw new Error('No issue loaded')
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type: 'SUBTASK',
          priority: 'MEDIUM',
          teamId: issue.teamId,
          sprintId: issue.sprintId || undefined,
          parentIssueId: issue.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create subtask')
      }
      return res.json()
    },
    onSuccess: () => {
      invalidateIssue()
      queryClient.invalidateQueries({ queryKey: ['issues'] })
    },
  })

  // Add comment (optimistic)
  const handleAddComment = async (body: string) => {
    const res = await fetch(`/api/issues/${issueId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) throw new Error('Failed to add comment')
    const comment = await res.json()
    queryClient.setQueryData(['issue', issueId], (prev: any) =>
      prev ? { ...prev, comments: [...(prev.comments || []), comment] } : prev,
    )
    return comment as { id: string }
  }

  // Edit comment
  const handleEditComment = async (commentId: string, body: string) => {
    const res = await fetch(`/api/issues/${issueId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) throw new Error('Failed to update comment')
    const updated = await res.json()
    queryClient.setQueryData(['issue', issueId], (prev: any) =>
      prev
        ? {
            ...prev,
            comments: (prev.comments || []).map((c: any) =>
              c.id === commentId ? updated : c
            ),
          }
        : prev
    )
  }

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    const res = await fetch(`/api/issues/${issueId}/comments/${commentId}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete comment')
    queryClient.setQueryData(['issue', issueId], (prev: any) =>
      prev
        ? {
            ...prev,
            comments: (prev.comments || []).filter(
              (c: any) => c.id !== commentId
            ),
          }
        : prev
    )
  }

  // ── Render ──
  return (
    <>
      {/* Team color accent bar at top */}
      <div className={`h-1 shrink-0 bg-gradient-to-r ${accentGradient}`} />

      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-slate-200" />
          {issue ? (
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-bold text-slate-800">
                {issue.displayId}
              </span>
              <StatusBadge status={issue.status} size="sm" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="h-4 w-14 bg-slate-200 rounded animate-pulse" />
              <div className="h-5 w-20 bg-slate-100 rounded-full animate-pulse" />
            </div>
          )}
        </div>
        <button
          onClick={() => {
            onClose()
            router.push(`/issues/${issueId}`)
          }}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          title="Open in full page"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Full page
        </button>
      </div>

      {/* Panel content — scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {initialLoading ? (
          <IssueDetailSkeleton />
        ) : error || !issue ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-red-600 text-sm font-medium">
                {error || 'Ticket not found'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Close panel
            </button>
          </div>
        ) : (
          <>
            <ChildResolutionModal
              isOpen={showResolutionModal}
              issueTitle={issue.title || ''}
              openSubtasks={openSubtasks}
              onConfirm={handleResolutionConfirm}
              onCancel={() => {
                setShowResolutionModal(false)
                setPendingUpdate(null)
              }}
            />

            <div className="p-6 space-y-8">
              <IssueDetail
                issue={issue}
                teams={teams}
                sprints={sprints}
                users={users}
                onUpdate={handleUpdate}
                onAddSubtask={(title) => addSubtask(title)}
                onDelete={handleDelete}
                onAttachmentChange={invalidateIssue}
              />

              <CommentThread
                issueId={issueId}
                comments={issue.comments || []}
                onAddComment={handleAddComment}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                onAttachmentChange={invalidateIssue}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
