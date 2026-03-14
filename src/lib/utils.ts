import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge classNames using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format date using Intl.DateTimeFormat with Asia/Dubai timezone
 */
export function formatDate(date: Date | string | undefined | null, format?: 'short' | 'long'): string {
  if (!date) return '—'
  const dateObj = typeof date === 'string' ? new Date(date) : date

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: format === 'long' ? 'long' : '2-digit',
    day: '2-digit',
  }

  return new Intl.DateTimeFormat('en-US', options).format(dateObj)
}

/**
 * Get relative time string (e.g., "2 days ago")
 */
export function getTimeAgo(date: Date | string | undefined | null): string {
  if (!date) return ''
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const secondsAgo = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

  if (secondsAgo < 60) return 'just now'
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} minutes ago`
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hours ago`
  if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)} days ago`
  if (secondsAgo < 2592000) return `${Math.floor(secondsAgo / 604800)} weeks ago`

  return formatDate(dateObj)
}

/**
 * Get color for team
 */
export function getTeamColor(teamKey: string): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-cyan-500',
  ]

  const hash = teamKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
