'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Returns an onMouseEnter handler that prefetches issue detail data.
 * Attach to any element that navigates to /issues/[id] on click.
 * If the data is already cached and fresh, this is a no-op.
 */
export function usePrefetchIssue() {
  const queryClient = useQueryClient()

  return useCallback(
    (issueId: string) => {
      queryClient.prefetchQuery({
        queryKey: ['issue', issueId],
        queryFn: () => fetch(`/api/issues/${issueId}`).then((r) => r.json()),
        staleTime: 10_000,
      })
    },
    [queryClient],
  )
}
