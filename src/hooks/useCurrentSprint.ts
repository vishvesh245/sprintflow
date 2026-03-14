import { useQuery } from '@tanstack/react-query'
import { Sprint } from '@/types'

interface UseCurrentSprintReturn {
  sprint: Sprint | null
  isLoading: boolean
  error: Error | null
}

export function useCurrentSprint(): UseCurrentSprintReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sprints', 'active'],
    staleTime: 30_000,
    queryFn: async () => {
      const response = await fetch('/api/sprints?status=ACTIVE')
      if (!response.ok) {
        throw new Error('Failed to fetch active sprint')
      }
      const data = await response.json()
      // API returns a plain array
      const sprints = Array.isArray(data) ? data : (data.sprints || [])
      return sprints[0] || null
    },
  })

  return {
    sprint: data || null,
    isLoading,
    error: error as Error | null,
  }
}
