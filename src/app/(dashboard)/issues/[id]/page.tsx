'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { SpinArcLoader } from '@/components/ui/loaders'
import { invalidateIssueCaches } from '@/lib/invalidateRelatedCaches'
import { useIssue } from '@/hooks/useIssue'
import { useTeams } from '@/hooks/useTeams'
import { useUsers } from '@/hooks/useUsers'
import { useSprints } from '@/hooks/useSprints'
import { IssueDetail } from '@/components/issues/IssueDetail'
import { CommentThread } from '@/components/issues/CommentThread'
import { ChildResolutionModal, ChildAction } from '@/components/issues/ChildResolutionModal'

export default function IssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const issueId = params.id as string

  // Child resolution modal state (kept as local state — not query state)
  const [pendingUpdate, setPendingUpdate] = useState<Record<string, any> | null>(null)
  const [openSubtasks, setOpenSubtasks] = useState<any[]>([])
  const [showResolutionModal, setShowResolutionModal] = useState(false)

  // ── Data queries ──────────────────────────────────────────────
  // Issue detail — short staleTime (10s global default), refetch after mutations
  const { issue, isLoading: issueLoading, error: issueError } = useIssue(issueId)

  // Reference data — long staleTime (5 min), likely already cached from other pages
  const { teams } = useTeams()
  const { users } = useUsers()
  const { sprints: allSprints } = useSprints()

  // Filter completed sprints from dropdown — but keep the issue's current sprint
  // so the dropdown doesn't show a blank selection if issue is on a completed sprint
  const sprints = allSprints.filter(
    s => s.status !== 'COMPLETED' || s.id === issue?.sprintId
  )

  // Only show full-page spinner on initial load (no cached data yet).
  // Once we have data, keep showing it during background refetches so
  // IssueDetail doesn't unmount and lose local state (e.g. editMode).
  const initialLoading = issueLoading && !issue
  const error = issueError?.message ?? null

  // ── Helper: invalidate this issue ─────────────────────────────
  const invalidateIssue = () =>
    queryClient.invalidateQueries({ queryKey: ['issue', issueId] })

  // Delete issue — soft-deletes via API, clears cache, navigates back
  const handleDelete = async () => {
    const res = await fetch(`/api/issues/${issueId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to delete issue')
    }
    // Remove from all caches so it disappears from board/backlog immediately
    queryClient.removeQueries({ queryKey: ['issue', issueId] })
    invalidateIssueCaches(queryClient)
    router.back()
  }

  // ── Mutations ─────────────────────────────────────────────────

  // Update issue — handles 409 conflict for open children
  const handleUpdate = async (
    updates: Record<string, any>,
    childActions?: Array<{ issueId: string; action: ChildAction }>
  ) => {
    const payload = childActions ? { ...updates, childActions } : updates
    const res = await fetch(`/api/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    // 409 = open children require resolution before closing
    if (res.status === 409) {
      const data = await res.json()
      if (data.requiresResolution) {
        setPendingUpdate(updates)
        setOpenSubtasks(data.openSubtasks || [])
        setShowResolutionModal(true)
        return // modal handles it
      }
    }

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to update issue')
    }

    const updatedIssue = await res.json()

    // Update this issue's cache directly (no round-trip needed for field updates)
    queryClient.setQueryData(['issue', issueId], updatedIssue)

    // If sprint assignment or status changed, all views need refreshing
    if ('sprintId' in updates || 'status' in updates) {
      invalidateIssueCaches(queryClient)
    }
  }

  // Resolution modal confirm
  const handleResolutionConfirm = async (
    actions: Array<{ issueId: string; action: ChildAction }>
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
      // Refresh parent issue to show new subtask in list
      invalidateIssue()
      // New issue also appears in board/backlog
      queryClient.invalidateQueries({ queryKey: ['issues'] })
    },
  })

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

  // Add comment — optimistic: append immediately, no refetch needed
  const handleAddComment = async (body: string) => {
    const res = await fetch(`/api/issues/${issueId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) throw new Error('Failed to add comment')
    const comment = await res.json()
    // Append comment to cached issue directly (avoids a full refetch)
    queryClient.setQueryData(['issue', issueId], (prev: any) =>
      prev ? { ...prev, comments: [...(prev.comments || []), comment] } : prev
    )
    return comment as { id: string }
  }

  // ── Render ────────────────────────────────────────────────────
  if (initialLoading) {
    return <SpinArcLoader message="Loading ticket..." />
  }

  if (error || !issue) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex h-64 items-center justify-center">
          <p className="text-red-600">{error || 'Ticket not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Child resolution modal — rendered outside the page scroll flow */}
      <ChildResolutionModal
        isOpen={showResolutionModal}
        issueTitle={issue?.title || ''}
        openSubtasks={openSubtasks}
        onConfirm={handleResolutionConfirm}
        onCancel={() => {
          setShowResolutionModal(false)
          setPendingUpdate(null)
        }}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <IssueDetail
          issue={issue}
          teams={teams}
          sprints={sprints}
          users={users}
          onUpdate={handleUpdate}
          onAddSubtask={(title) => addSubtask(title)}
          onDelete={handleDelete}
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
  )
}
