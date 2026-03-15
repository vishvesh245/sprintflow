'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Trash2,
  Pencil,
  ArrowUpRight,
  X,
  Check,
  Share2,
  CheckCircle2,
} from 'lucide-react'
import { cn, getTeamColor } from '@/lib/utils'
import { getStatusBadge, getPriorityBadge } from '@/lib/colors'
import { SpinArcLoader } from '@/components/ui/loaders'
import { DesignItem } from '@/hooks/useDesignItems'
import { useTeams } from '@/hooks/useTeams'
import { useUsers } from '@/hooks/useUsers'
import { PromoteToBacklogModal } from '@/components/design-board/PromoteToBacklogModal'
import { DesignItemChecklist } from '@/components/design-board/DesignItemChecklist'
import { toast } from 'sonner'
import { FileUpload } from '@/components/ui/FileUpload'
import { AttachmentList } from '@/components/ui/AttachmentList'

const STATUS_OPTIONS = ['DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
}

const PRIORITY_OPTIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

const DESIGN_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DesignItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const itemId = params.id as string

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Edit field state
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editAssignee, setEditAssignee] = useState('')
  const [editVisualDesigner, setEditVisualDesigner] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editFigmaLink, setEditFigmaLink] = useState('')

  // Share / copy link
  const [copied, setCopied] = useState(false)
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/design-board/${itemId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPromoteModal, setShowPromoteModal] = useState(false)

  const { teams } = useTeams()
  const { users } = useUsers()

  const {
    data: item,
    isLoading,
    error,
  } = useQuery<DesignItem & { todos?: any[] }>({
    queryKey: ['design-item', itemId],
    queryFn: async () => {
      const res = await fetch(`/api/design-items/${itemId}`)
      if (!res.ok) throw new Error('Failed to fetch design item')
      const data = await res.json()
      // Seed the checklist cache so it renders instantly
      if (data.todos) {
        queryClient.setQueryData(['design-todos', itemId], data.todos)
      }
      return data
    },
  })

  const designTeam = teams.find((t) => t.prefix === 'DS')
  const designUsers = users.filter(
    (u) => designTeam && u.teamId === designTeam.id
  )
  const nonDesignTeams = teams.filter((t) => t.prefix !== 'DS')

  const handleEnterEdit = () => {
    if (!item) return
    setEditTitle(item.title || '')
    setEditDescription(item.description || '')
    setEditStatus(item.status || 'DRAFT')
    setEditPriority(item.priority || '')
    setEditAssignee(item.assigneeId || '')
    setEditVisualDesigner(item.visualDesignerId || '')
    setEditStartDate(
      item.startDate
        ? new Date(item.startDate).toISOString().split('T')[0]
        : ''
    )
    setEditEndDate(
      item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : ''
    )
    setEditFigmaLink(item.figmaLink || '')
    setSaveError(null)
    setEditMode(true)
  }

  const handleCancel = () => {
    setEditMode(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!editTitle.trim()) return
    setIsSaving(true)
    setSaveError(null)

    try {
      const payload: Record<string, any> = {
        title: editTitle.trim(),
        description: editDescription || null,
        status: editStatus,
        priority: editPriority || null,
        assigneeId: editAssignee || null,
        visualDesignerId: editVisualDesigner || null,
        startDate: editStartDate || null,
        endDate: editEndDate || null,
        figmaLink: editFigmaLink || null,
      }

      const res = await fetch(`/api/design-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }
      const updated = await res.json()
      queryClient.setQueryData(['design-item', itemId], updated)
      queryClient.invalidateQueries({ queryKey: ['design-items'] })
      setEditMode(false)
      toast.success('Design ticket updated')
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save changes'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/design-items/${itemId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      queryClient.removeQueries({ queryKey: ['design-item', itemId] })
      queryClient.invalidateQueries({ queryKey: ['design-items'] })
      toast.success('Design ticket deleted')
      router.push('/design-board')
    } catch {
      toast.error('Failed to delete design ticket')
      setIsDeleting(false)
    }
  }

  const handlePromote = async (data: {
    designItemId: string
    targetTeamId: string
    title: string
    description: string
    type: 'STORY' | 'TASK'
    priority: string
  }) => {
    const res = await fetch(`/api/design-items/${data.designItemId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetTeamId: data.targetTeamId,
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to promote')
    }
    const result = await res.json()
    queryClient.setQueryData(['design-item', itemId], result.designItem)
    queryClient.invalidateQueries({ queryKey: ['design-items'] })
    queryClient.invalidateQueries({ queryKey: ['issues'] })
    setShowPromoteModal(false)
    toast.success(`Promoted to ${result.issue.displayId}`)
  }

  if (isLoading) {
    return <SpinArcLoader message="Loading design ticket..." />
  }

  if (error || !item) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex h-64 items-center justify-center">
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Design ticket not found'}
          </p>
        </div>
      </div>
    )
  }

  const assigneeUser = item.assignee
  const visualDesignerUser = item.visualDesigner

  return (
    <>
      {showPromoteModal && (
        <PromoteToBacklogModal
          item={item}
          teams={nonDesignTeams}
          onPromote={handlePromote}
          onClose={() => setShowPromoteModal(false)}
        />
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConfirm(false)
          }}
        >
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Design Ticket
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete &quot;{item.title}&quot;? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Design Board
        </button>

        {/* 2-column grid layout */}
        <div className="grid grid-cols-3 gap-8">
          {/* ── Main column ── */}
          <div className="col-span-2 space-y-6">
            {/* Title row + action buttons */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {editMode ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900 break-words">
                    {item.title}
                  </h1>
                )}
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'text-xs font-medium px-2.5 py-0.5 rounded-full',
                      DESIGN_STATUS_BADGE[item.status] ||
                        getStatusBadge(item.status)
                    )}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                  {item.priority && (
                    <span
                      className={cn(
                        'text-xs font-medium px-2.5 py-0.5 rounded-full',
                        getPriorityBadge(item.priority)
                      )}
                    >
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="shrink-0">
                {editMode ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !editTitle.trim()}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                      {isSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {!item.promotedToIssueId && item.status === 'DONE' && (
                      <button
                        onClick={() => setShowPromoteModal(true)}
                        className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Promote
                      </button>
                    )}
                    {/* Share — copy link to clipboard */}
                    <button
                      onClick={handleCopyLink}
                      title={copied ? 'Copied!' : 'Copy link'}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        copied
                          ? 'border-green-200 text-green-600 bg-green-50'
                          : 'border-gray-200 text-gray-400 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={handleEnterEdit}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      title="Delete design ticket"
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Save error */}
            {saveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {saveError}
              </div>
            )}

            {/* Description */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Description
              </h2>
              {editMode ? (
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={6}
                  placeholder="Add a description…"
                  className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              ) : (
                <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap min-h-[80px]">
                  {item.description ? (
                    item.description
                  ) : (
                    <span className="italic text-gray-400">
                      No description
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Attachments
              </h2>
              {editMode ? (
                <FileUpload
                  entityType="designItem"
                  entityId={itemId}
                  existingAttachments={item.attachments || []}
                  onUploadComplete={() =>
                    queryClient.invalidateQueries({ queryKey: ['design-item', itemId] })
                  }
                />
              ) : (item.attachments && item.attachments.length > 0) ? (
                <AttachmentList
                  attachments={item.attachments}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">No attachments</p>
              )}
            </div>

            {/* Checklist — always visible */}
            <DesignItemChecklist designItemId={itemId} />

          </div>

          {/* ── Sidebar ── */}
          <div className="col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
              {/* Status */}
              <div className="px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Status
                </p>
                {editMode ? (
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={cn(
                      'inline-block text-xs font-medium px-2.5 py-1 rounded-full',
                      DESIGN_STATUS_BADGE[item.status] ||
                        getStatusBadge(item.status)
                    )}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                )}
              </div>

              {/* Priority */}
              <div className="px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Priority
                </p>
                {editMode ? (
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No priority</option>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    {item.priority ? (
                      <span
                        className={cn(
                          'inline-block rounded px-2.5 py-1 text-xs font-semibold',
                          getPriorityBadge(item.priority)
                        )}
                      >
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">No priority</span>
                    )}
                  </>
                )}
              </div>

              {/* Assignee */}
              <div className="px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Assignee
                </p>
                {editMode ? (
                  <select
                    value={editAssignee}
                    onChange={(e) => setEditAssignee(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {designUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    {assigneeUser ? (
                      <>
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold',
                            getTeamColor(assigneeUser.name || 'A')
                          )}
                        >
                          {(assigneeUser.name || assigneeUser.email || 'A')
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-800">
                          {assigneeUser.name || assigneeUser.email}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </div>
                )}
              </div>

              {/* Visual Designer */}
              <div className="px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Visual Designer
                </p>
                {editMode ? (
                  <select
                    value={editVisualDesigner}
                    onChange={(e) => setEditVisualDesigner(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {designUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    {visualDesignerUser ? (
                      <>
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold',
                            getTeamColor(visualDesignerUser.name || 'V')
                          )}
                        >
                          {(
                            visualDesignerUser.name ||
                            visualDesignerUser.email ||
                            'V'
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-800">
                          {visualDesignerUser.name || visualDesignerUser.email}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </div>
                )}
              </div>

              {/* Figma Link */}
              <div className="px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Figma
                </p>
                {editMode ? (
                  <input
                    type="url"
                    value={editFigmaLink}
                    onChange={(e) => setEditFigmaLink(e.target.value)}
                    placeholder="https://figma.com/..."
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <>
                    {item.figmaLink ? (
                      <a
                        href={item.figmaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in Figma
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">No link</span>
                    )}
                  </>
                )}
              </div>

              {/* Timeline */}
              <div className="px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Timeline
                </p>
                {editMode ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">Start</label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">End</label>
                      <input
                        type="date"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {item.startDate || item.endDate ? (
                      <div className="flex items-center gap-1 text-sm text-gray-800">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>
                          {item.startDate ? formatDate(item.startDate) : '—'}
                          {' → '}
                          {item.endDate ? formatDate(item.endDate) : '—'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">
                        No dates set
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
