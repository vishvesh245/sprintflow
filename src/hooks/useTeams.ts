import { useQuery } from '@tanstack/react-query'

export interface Team {
  id: string
  name: string
  prefix: string
  color?: string
}

export function useTeams(opts?: { enabled?: boolean }) {
  const { data, isLoading, error } = useQuery<Team[]>({
    queryKey: ['teams'],
    enabled: opts?.enabled !== false,
    queryFn: async () => {
      const res = await fetch('/api/teams')
      if (!res.ok) throw new Error('Failed to fetch teams')
      return res.json()
    },
    // Teams change very rarely — keep in cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  })

  return {
    teams: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}
