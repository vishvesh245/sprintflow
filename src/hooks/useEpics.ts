import { useQuery } from '@tanstack/react-query'

export interface EpicOption {
  id: string
  title: string
  status: string
}

export function useEpics(opts?: { enabled?: boolean }) {
  const { data, isLoading, error } = useQuery<EpicOption[]>({
    queryKey: ['epics'],
    enabled: opts?.enabled !== false,
    queryFn: async () => {
      const res = await fetch('/api/epics')
      if (!res.ok) throw new Error('Failed to fetch epics')
      return res.json()
    },
    // Epics change infrequently — keep in cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  })

  return {
    epics: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}
