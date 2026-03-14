// ── Centralized Color System ─────────────────────────────────────────────────
// Single source of truth for status, priority, and issue-type colors.
// Import helpers from here instead of defining inline color maps.

export type StatusKey = 'TODO' | 'IN_PROGRESS' | 'READY_FOR_QA' | 'IN_REVIEW' | 'BLOCKED' | 'DONE' | 'BACKLOG'

export type PriorityKey = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export type IssueTypeKey = 'STORY' | 'TASK' | 'BUG' | 'SUBTASK'

interface StatusColor {
  dot: string       // small dot / progress bar segment
  bg: string        // badge background
  text: string      // badge text
  bar: string       // column header bar / progress ring
  badge: string     // combined "bg-x text-x" for simple badge usage
}

interface PriorityColor {
  dot: string
  bg: string
  text: string
  badge: string
}

// ── Status Colors (Blue Harmony) ─────────────────────────────────────────────

export const STATUS_COLORS: Record<StatusKey, StatusColor> = {
  DONE: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  IN_PROGRESS: {
    dot: 'bg-blue-500',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    bar: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
  READY_FOR_QA: {
    dot: 'bg-orange-400',
    bg: 'bg-orange-100',
    text: 'text-orange-600',
    bar: 'bg-orange-400',
    badge: 'bg-orange-100 text-orange-600',
  },
  IN_REVIEW: {
    dot: 'bg-violet-500',
    bg: 'bg-violet-200',
    text: 'text-violet-800',
    bar: 'bg-violet-500',
    badge: 'bg-violet-200 text-violet-800',
  },
  BLOCKED: {
    dot: 'bg-red-400',
    bg: 'bg-red-100',
    text: 'text-red-700',
    bar: 'bg-red-400',
    badge: 'bg-red-100 text-red-700',
  },
  TODO: {
    dot: 'bg-gray-400',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    bar: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-600',
  },
  BACKLOG: {
    dot: 'bg-gray-300',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    bar: 'bg-gray-300',
    badge: 'bg-gray-100 text-gray-600',
  },
}

// ── Priority Colors ──────────────────────────────────────────────────────────

export const PRIORITY_COLORS: Record<PriorityKey, PriorityColor> = {
  CRITICAL: {
    dot: 'bg-red-500',
    bg: 'bg-red-100',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
  HIGH: {
    dot: 'bg-orange-500',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
  },
  MEDIUM: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  LOW: {
    dot: 'bg-slate-400',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    badge: 'bg-slate-100 text-slate-600',
  },
}

// ── Issue Type Colors ────────────────────────────────────────────────────────

export const TYPE_COLORS: Record<IssueTypeKey, string> = {
  STORY: 'text-violet-400',
  TASK: 'text-blue-400',
  BUG: 'text-rose-400',
  SUBTASK: 'text-gray-400',
}

// ── Hex values (for SVG strokes, chart fills, etc.) ──────────────────────────

export const STATUS_HEX: Record<StatusKey, string> = {
  DONE: '#10b981',       // emerald-500
  IN_PROGRESS: '#3b82f6', // blue-500
  READY_FOR_QA: '#fb923c', // orange-400
  IN_REVIEW: '#8b5cf6',   // violet-500
  BLOCKED: '#f87171',     // red-400
  TODO: '#9ca3af',        // gray-400
  BACKLOG: '#d1d5db',     // gray-300
}

// ── Helper functions ─────────────────────────────────────────────────────────

export function getStatusColor(status: string): StatusColor {
  return STATUS_COLORS[status as StatusKey] ?? STATUS_COLORS.TODO
}

export function getStatusBadge(status: string): string {
  return getStatusColor(status).badge
}

export function getPriorityColor(priority: string): PriorityColor {
  return PRIORITY_COLORS[priority as PriorityKey] ?? PRIORITY_COLORS.MEDIUM
}

export function getPriorityBadge(priority: string): string {
  return getPriorityColor(priority).badge
}

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type as IssueTypeKey] ?? TYPE_COLORS.TASK
}

export function getStatusHex(status: string): string {
  return STATUS_HEX[status as StatusKey] ?? STATUS_HEX.TODO
}
