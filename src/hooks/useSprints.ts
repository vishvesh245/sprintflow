import { useQuery } from '@tanstack/react-query'
import { Sprint } from '@/types'

type SprintStatus = 'ACTIVE' | 'PLANNING' | 'COMPLETED'

/**
 * Fetches sprints, optionally filtered by status.
 *
 * Query key hierarchy:
 *   ['sprints']                  — all sprints
 *   ['sprints', { status }]      — sprints filtered by status
 *
 * Invalidating ['sprints'] blows away ALL sprint queries (prefix match),
 * including the Board's ['sprints', 'active'] from useCurrentSprint.
 */
export function useSprints(status?: SprintStatus, opts?: { summary?: boolean; enabled?: boolean }) {
  const summary = opts?.summary ?? false
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (summary) params.set('summary', 'true')
  const qs = params.toString()
  const url = qs ? `/api/sprints?${qs}` : '/api/sprints'
  const queryKey = status ? ['sprints', { status, ...(summary && { summary }) }] : ['sprints']

  const { data, isLoading, error, refetch } = useQuery<Sprint[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch sprints')
      return res.json()
    },
    // Sprints update when admins create/start/complete them — 30s is enough
    staleTime: 30 * 1000,
    enabled: opts?.enabled !== false,
  })

  return {
    sprints: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  }
}
