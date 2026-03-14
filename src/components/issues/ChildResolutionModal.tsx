'use client'

import { useState } from 'react'
import { X, GitBranch, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStatusBadge } from '@/lib/colors'

export type ChildAction = 'close' | 'backlog'

interface ChildItem {
  id: string
  displayId: string
  title: string
  status: string
}

interface ChildResolutionModalProps {
  isOpen: boolean
  issueTitle: string
  openSubtasks: ChildItem[]
  onConfirm: (actions: Array<{ issueId: string; action: ChildAction }>) => Promise<void>
  onCancel: () => void
}

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Backlog', TODO: 'To Do', IN_PROGRESS: 'In Progress',
  READY_FOR_QA: 'Ready for QA', IN_REVIEW: 'In Review', BLOCKED: 'Blocked', DONE: 'Done',
}

export function ChildResolutionModal({
  isOpen,
  issueTitle,
  openSubtasks,
  onConfirm,
  onCancel,
}: ChildResolutionModalProps) {
  const allItems = [
    ...openSubtasks.map((s) => ({ ...s, kind: 'subtask' as const })),
  ]

  const [actions, setActions] = useState<Record<string, ChildAction>>(
    () => Object.fromEntries(allItems.map((i) => [i.id, 'close']))
  )
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm(
        allItems.map((item) => ({ issueId: item.id, action: actions[item.id] }))
      )
    } finally {
      setSaving(false)
    }
  }

  const setAll = (action: ChildAction) => {
    setActions(Object.fromEntries(allItems.map((i) => [i.id, action])))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Resolve open items</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Before closing{' '}
              <span className="font-medium text-gray-700">"{issueTitle}"</span>, resolve
              the items below.
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Quick actions */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Set all to:</span>
            <button
              onClick={() => setAll('close')}
              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-100"
            >
              ✓ Close all
            </button>
            <button
              onClick={() => setAll('backlog')}
              className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-gray-600 hover:bg-gray-100"
            >
              📥 Move all to Backlog
            </button>
          </div>

          {/* Subtasks group */}
          {openSubtasks.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <GitBranch className="h-3.5 w-3.5" />
                Open Subtasks ({openSubtasks.length})
              </div>
              <div className="space-y-2">
                {openSubtasks.map((sub) => (
                  <ItemRow
                    key={sub.id}
                    item={{ ...sub, kind: 'subtask' }}
                    action={actions[sub.id]}
                    onChange={(a) => setActions((prev) => ({ ...prev, [sub.id]: a }))}
                  />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
          <p className="text-xs text-gray-400">
            {allItems.filter((i) => actions[i.id] === 'close').length} will be closed ·{' '}
            {allItems.filter((i) => actions[i.id] === 'backlog').length} will move to backlog
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? 'Closing…' : 'Confirm & Close Issue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Item row inside the modal ────────────────────────────────────────────────

function ItemRow({
  item,
  action,
  onChange,
}: {
  item: ChildItem & { kind: 'subtask' | 'bug' }
  action: ChildAction
  onChange: (a: ChildAction) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <span className={cn('shrink-0 text-xs font-medium px-2 py-0.5 rounded-full', getStatusBadge(item.status))}>
        {STATUS_LABEL[item.status] || item.status}
      </span>
      <span className="text-xs font-semibold text-gray-400 shrink-0">{item.displayId}</span>
      <span className="text-sm text-gray-800 truncate flex-1">{item.title}</span>
      <select
        value={action}
        onChange={(e) => onChange(e.target.value as ChildAction)}
        className={cn(
          'shrink-0 rounded border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500',
          action === 'close'
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-gray-200 bg-white text-gray-600',
        )}
      >
        <option value="close">✓ Close</option>
        <option value="backlog">📥 Backlog</option>
      </select>
    </div>
  )
}
