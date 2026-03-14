'use client'

import { cn } from '@/lib/utils'
import { getStatusBadge } from '@/lib/colors'

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs font-medium',
    md: 'px-3 py-1.5 text-sm font-medium',
    lg: 'px-4 py-2 text-base font-medium',
  }

  const statusLabel = (status || 'UNKNOWN')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return (
    <span
      className={cn(
        'inline-block rounded-full font-medium',
        getStatusBadge(status),
        sizeClasses[size]
      )}
    >
      {statusLabel}
    </span>
  )
}
