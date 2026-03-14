import { useQuery } from '@tanstack/react-query'

/**
 * Fetches a single issue by ID with all its relations
 * (comments, subtasks, team, assignee, sprint, reporter).
 *
 * Query key: ['issue', id]
 * Invalidating this key refreshes the issue detail view.
 * Invalidating ['issues'] (plural) does NOT invalidate this — they are separate.
 */
export function useIssue(id: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['issue', id],
    queryFn: async () => {
      const res = await fetch(`/api/issues/${id}`)
      if (!res.ok) throw new Error('Failed to fetch issue')
      return res.json()
    },
    enabled: !!id,
    staleTime: 30_000, // 30s — matches server cache TTL, keeps prefetched data warm
  })

  return {
    issue: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}
