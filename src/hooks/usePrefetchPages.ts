'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient, QueryClient } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'

type PrefetchItem = {
  queryKey: unknown[]
  queryFn: () => Promise<unknown>
  staleTime: number
}

/**
 * After the current page settles, prefetch data for other main pages so
 * navigation feels instant. Calls are staggered (400ms apart) so they don't
 * compete with the current page's requests for DB connections.
 *
 * Uses requestIdleCallback where available so prefetching only starts when
 * the browser's main thread is free.
 */
export function usePrefetchPages() {
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    // Clean up any pending timers from a previous render
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const startPrefetch = () => {
      const items: PrefetchItem[] = []

      // Shared data first (lightweight, used by multiple pages)
      items.push({
        queryKey: ['teams'],
        queryFn: () => fetch('/api/teams').then((r) => r.json()),
        staleTime: 300_000,
      })

      items.push({
        queryKey: ['sprints', { summary: true }],
        queryFn: () => fetch('/api/sprints?summary=true').then((r) => r.json()),
        staleTime: 30_000,
      })

      // Page-specific data (skip the page we're already on)
      if (pathname !== '/board') {
        items.push({
          queryKey: ['board', { teamId: 'ALL' }],
          queryFn: () => fetch('/api/board').then((r) => r.json()),
          staleTime: 30_000,
        })
      }

      if (pathname !== '/sprint') {
        items.push({
          queryKey: ['sprint-overview'],
          queryFn: () => fetch('/api/sprint-overview').then((r) => r.json()),
          staleTime: 30_000,
        })
      }

      if (pathname !== '/backlog') {
        items.push({
          queryKey: ['issues', { backlog: true }],
          queryFn: () => fetch('/api/issues?backlog=true').then((r) => r.json()),
          staleTime: 30_000,
        })
      }

      // Stagger each prefetch 400ms apart so they don't all hit the DB at once
      items.forEach((item, i) => {
        const t = setTimeout(() => {
          queryClient.prefetchQuery(item)
        }, i * 400)
        timersRef.current.push(t)
      })
    }

    // Wait for the browser to be idle before starting prefetch.
    // requestIdleCallback isn't available in all browsers — fall back to 3s timeout.
    if (typeof requestIdleCallback === 'function') {
      const idleId = requestIdleCallback(startPrefetch, { timeout: 4000 })
      return () => {
        cancelIdleCallback(idleId)
        timersRef.current.forEach(clearTimeout)
      }
    } else {
      const fallback = setTimeout(startPrefetch, 3000)
      return () => {
        clearTimeout(fallback)
        timersRef.current.forEach(clearTimeout)
      }
    }
  }, [queryClient, pathname])
}
