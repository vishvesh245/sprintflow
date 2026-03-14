import { useQuery } from '@tanstack/react-query'
import { Sprint, IssueWithRelations } from '@/types'

interface SprintOverviewData {
  activeSprint: Sprint | null
  planningSprints: Sprint[]
  issues: IssueWithRelations[]
}

interface UseSprintOverviewReturn {
  activeSprint: Sprint | null
  planningSprints: Sprint[]
  issues: IssueWithRelations[]
  isLoading: boolean
  error: Error | null
}

export function useSprintOverview(): UseSprintOverviewReturn {
  const { data, isLoading, error } = useQuery<SprintOverviewData>({
    queryKey: ['sprint-overview'],
    queryFn: async () => {
      const res = await fetch('/api/sprint-overview')
      if (!res.ok) throw new Error('Failed to fetch sprint overview')
      return res.json()
    },
    staleTime: 30_000,
  })

  return {
    activeSprint: data?.activeSprint ?? null,
    planningSprints: data?.planningSprints ?? [],
    issues: data?.issues ?? [],
    isLoading,
    error: error as Error | null,
  }
}
