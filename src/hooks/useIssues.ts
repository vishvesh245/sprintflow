import { useQuery } from '@tanstack/react-query'
import { IssueWithRelations } from '@/types'

interface UseIssuesParams {
  teamId?: string
  sprintId?: string
  status?: string
  backlog?: boolean
  /** When false the query is paused (will not fire). Defaults to true. */
  enabled?: boolean
}

interface UseIssuesReturn {
  issues: IssueWithRelations[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useIssues(params: UseIssuesParams): UseIssuesReturn {
  const queryParams = new URLSearchParams()

  if (params.teamId) queryParams.append('teamId', params.teamId)
  if (params.sprintId) queryParams.append('sprintId', params.sprintId)
  if (params.status) queryParams.append('status', params.status)
  if (params.backlog !== undefined) queryParams.append('backlog', String(params.backlog))

  const queryString = queryParams.toString()
  const queryKey = ['issues', params]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    enabled: params.enabled !== false,
    staleTime: 30_000,
    queryFn: async () => {
      const url = `/api/issues${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch issues')
      }
      const data = await response.json()
      // API returns a plain array
      return Array.isArray(data) ? data : (data.issues || [])
    },
  })

  return {
    issues: data || [],
    isLoading,
    error: error as Error | null,
    refetch: () => refetch(),
  }
}
