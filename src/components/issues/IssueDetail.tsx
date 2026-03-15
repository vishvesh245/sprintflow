'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Edit2, X, Check, Plus, ChevronDown, ChevronRight, GitBranch, Trash2, Share2, CheckCircle2 } from 'lucide-react'
import { formatDate, getTimeAgo, getTeamColor, cn } from '@/lib/utils'
import { getPriorityBadge, getStatusBadge } from '@/lib/colors'
import { StatusBadge } from './StatusBadge'
import { FileUpload } from '@/components/ui/FileUpload'
import { AttachmentList } from '@/components/ui/AttachmentList'

interface Assignee {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface Team {
  id: string
  name: string
  prefix: string
  color?: string
}

interface Sprint {
  id: string
  name: string
  status: string
}

interface IssueDetailProps {
  issue: any
  teams: Team[]
  sprints: Sprint[]
  users: Assignee[]
  onUpdate: (updates: Record<string, any>) => Promise<void>
  onAddSubtask?: (title: string) => Promise<void>
  onDelete?: () => Promise<void>
}

const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'READY_FOR_QA', 'IN_REVIEW', 'BLOCKED', 'DONE']
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const TYPES = ['STORY', 'TASK', 'BUG', 'SUBTASK']

const statusLabels: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  READY_FOR_QA: 'Ready for QA',
  IN_REVIEW: 'In Review',
  BLOCKED: 'Blocked',
  DONE: 'Done',
}

const typeLabels: Record<string, string> = {
  STORY: 'Story',
  TASK: 'Task',
  BUG: 'Bug',
  SUBTASK: 'Subtask',
}

export function IssueDetail({
  issue,
  teams,
  sprints,
  users,
  onUpdate,
  onAddSubtask,
  onDelete,
}: IssueDetailProps) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Share / copy link
  const [copied, setCopied] = useState(false)
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/issues/${issue.id}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Subtasks panel
  const [subtasksExpanded, setSubtasksExpanded] = useState(true)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [subtaskSaving, setSubtaskSaving] = useState(false)

  // Edit state — all fields
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editType, setEditType] = useState('')
  const [editAssigneeId, setEditAssigneeId] = useState('')
  const [editSprintId, setEditSprintId] = useState('')
  const [editStoryPoints, setEditStoryPoints] = useState<number>(0)

  const handleEnterEdit = () => {
    setEditTitle(issue.title || '')
    setEditDescription(issue.description || '')
    setEditStatus(issue.status || 'BACKLOG')
    setEditPriority(issue.priority || 'MEDIUM')
    setEditType(issue.type || 'TASK')
    setEditAssigneeId(issue.assigneeId || '')
    setEditSprintId(issue.sprintId || '')
    setEditStoryPoints(issue.storyPoints || 0)
    setSaveError(null)
    setEditMode(true)
  }

  const handleCancel = () => {
    setEditMode(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!editTitle.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await onUpdate({
        title: editTitle.trim(),
        description: editDescription || null,
        status: editStatus,
        priority: editPriority,
        type: editType,
        assigneeId: editAssigneeId || null,
        sprintId: editSprintId || null,
        storyPoints: editStoryPoints >= 0 ? editStoryPoints : null,
      })
      setEditMode(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const assignee = users.find((u) => u.id === issue.assigneeId)

  return (
    <div className="grid grid-cols-3 gap-8">
      {/* ── Main content ── */}
      <div className="col-span-2 space-y-6">
        {/* Title row + Edit / Save / Cancel */}
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
              <h1 className="text-2xl font-bold text-gray-900 break-words">{issue.title}</h1>
            )}
            <p className="mt-1 text-sm text-gray-500">
              {issue.displayId} · Created {getTimeAgo(issue.createdAt)}
            </p>
          </div>

          {/* Action buttons */}
          <div className="shrink-0">
            {!editMode ? (
              deleteConfirm ? (
                /* Inline delete confirmation */
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <span className="text-sm text-red-700 font-medium">Delete this issue?</span>
                  <button
                    onClick={async () => {
                      setDeleting(true)
                      try { await onDelete?.() }
                      finally { setDeleting(false) }
                    }}
                    disabled={deleting}
                    className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    disabled={deleting}
                    className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
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
                  {/* Delete — only shown if caller provides onDelete */}
                  {onDelete && (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      title="Delete issue"
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={handleEnterEdit}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editTitle.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save Changes'}
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
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Description</h2>
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
              {issue.description ? (
                issue.description
              ) : (
                <span className="italic text-gray-400">No description</span>
              )}
            </div>
          )}
        </div>

        {/* ── Attachments Section ── */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Attachments{issue.attachments?.length > 0 && ` (${issue.attachments.length})`}
          </h2>
          {editMode ? (
            <FileUpload
              entityType="issue"
              entityId={issue.id}
              existingAttachments={issue.attachments || []}
            />
          ) : issue.attachments?.length > 0 ? (
            <AttachmentList attachments={issue.attachments} />
          ) : (
            <p className="text-sm text-gray-400 italic">No attachments</p>
          )}
        </div>

        {/* ── Subtasks Section ── */}
        {!editMode && (
          <SubtasksPanel
            subtasks={issue.subtasks || []}
            expanded={subtasksExpanded}
            onToggle={() => setSubtasksExpanded((v) => !v)}
            addingSubtask={addingSubtask}
            newSubtaskTitle={newSubtaskTitle}
            subtaskSaving={subtaskSaving}
            onStartAdd={() => setAddingSubtask(true)}
            onCancelAdd={() => { setAddingSubtask(false); setNewSubtaskTitle('') }}
            onTitleChange={setNewSubtaskTitle}
            onSaveSubtask={async () => {
              if (!newSubtaskTitle.trim() || !onAddSubtask) return
              setSubtaskSaving(true)
              try {
                await onAddSubtask(newSubtaskTitle.trim())
                setNewSubtaskTitle('')
                setAddingSubtask(false)
              } finally {
                setSubtaskSaving(false)
              }
            }}
            onNavigate={(id) => router.push(`/issues/${id}`)}
          />
        )}

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
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge status={issue.status} />
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
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={`inline-block rounded px-2.5 py-1 text-xs font-semibold ${
                  getPriorityBadge(issue.priority)
                }`}
              >
                {issue.priority}
              </span>
            )}
          </div>

          {/* Type */}
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Type
            </p>
            {editMode ? (
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {typeLabels[t]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-800">
                {typeLabels[issue.type] || issue.type}
              </span>
            )}
          </div>

          {/* Team (read-only) */}
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Team
            </p>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: issue.team?.color || '#6366f1' }}
              />
              <span className="text-sm text-gray-800">{issue.team?.name || '—'}</span>
            </div>
          </div>

          {/* Assignee */}
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Assignee
            </p>
            {editMode ? (
              <select
                value={editAssigneeId}
                onChange={(e) => setEditAssigneeId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                {assignee?.image ? (
                  <Image
                    src={assignee.image}
                    alt={assignee.name || 'User'}
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200">
                    <span className="text-xs font-medium text-gray-600">
                      {(
                        assignee?.name?.[0] ||
                        assignee?.email?.[0] ||
                        '?'
                      ).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm text-gray-800">
                  {assignee ? (
                    assignee.name || assignee.email
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Sprint */}
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Sprint
            </p>
            {editMode ? (
              <select
                value={editSprintId}
                onChange={(e) => setEditSprintId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No sprint (Backlog)</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-800">
                {issue.sprint?.name ? (
                  issue.sprint.name
                ) : (
                  <span className="text-gray-400">No sprint</span>
                )}
              </span>
            )}
          </div>

          {/* Story Points */}
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Story Points
            </p>
            {editMode ? (
              <input
                type="number"
                value={editStoryPoints}
                onChange={(e) =>
                  setEditStoryPoints(Math.max(0, parseInt(e.target.value) || 0))
                }
                min={0}
                max={100}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <span className="text-sm text-gray-800">
                {issue.storyPoints != null ? issue.storyPoints : '—'}
              </span>
            )}
          </div>

          {/* Dates (always read-only) */}
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Dates
            </p>
            <div className="space-y-1 text-xs text-gray-500">
              <p>Created: {formatDate(issue.createdAt)}</p>
              <p>Updated: {formatDate(issue.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SubtasksPanel
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Backlog', TODO: 'To Do', IN_PROGRESS: 'In Progress',
  READY_FOR_QA: 'Ready for QA', IN_REVIEW: 'In Review', BLOCKED: 'Blocked', DONE: 'Done',
}

interface SubtasksPanelProps {
  subtasks: any[]
  expanded: boolean
  onToggle: () => void
  addingSubtask: boolean
  newSubtaskTitle: string
  subtaskSaving: boolean
  onStartAdd: () => void
  onCancelAdd: () => void
  onTitleChange: (v: string) => void
  onSaveSubtask: () => Promise<void>
  onNavigate: (id: string) => void
}

function SubtasksPanel({
  subtasks, expanded, onToggle,
  addingSubtask, newSubtaskTitle, subtaskSaving,
  onStartAdd, onCancelAdd, onTitleChange, onSaveSubtask, onNavigate,
}: SubtasksPanelProps) {
  const doneCount = subtasks.filter((s) => s.status === 'DONE').length

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <GitBranch className="h-4 w-4 text-gray-500" />
          Subtasks
          <span className="text-xs font-medium text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
            {doneCount}/{subtasks.length}
          </span>
        </button>
        <button
          onClick={onStartAdd}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add subtask
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-gray-100">
          {/* Progress bar */}
          {subtasks.length > 0 && (
            <div className="px-4 py-2 bg-white">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${subtasks.length ? (doneCount / subtasks.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Subtask rows */}
          {subtasks.map((sub) => (
            <div
              key={sub.id}
              onClick={() => onNavigate(sub.id)}
              className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <span className={cn('shrink-0 text-xs font-medium px-2 py-0.5 rounded-full', getStatusBadge(sub.status))}>
                {STATUS_LABEL[sub.status] || sub.status}
              </span>
              <span className="text-xs font-semibold text-gray-400 shrink-0">{sub.displayId}</span>
              <span className="text-sm text-gray-800 truncate">{sub.title}</span>
            </div>
          ))}

          {subtasks.length === 0 && !addingSubtask && (
            <p className="px-4 py-3 text-xs text-gray-400 italic bg-white">No subtasks yet.</p>
          )}

          {/* Add subtask inline form */}
          {addingSubtask && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-t border-gray-200">
              <input
                autoFocus
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveSubtask()
                  if (e.key === 'Escape') onCancelAdd()
                }}
                placeholder="Subtask title…"
                className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <button
                onClick={onSaveSubtask}
                disabled={subtaskSaving || !newSubtaskTitle.trim()}
                className="rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {subtaskSaving ? '…' : 'Add'}
              </button>
              <button
                onClick={onCancelAdd}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

