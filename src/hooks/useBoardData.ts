import { useQuery } from '@tanstack/react-query'
import { IssueWithRelations } from '@/types'

interface BoardData {
  sprint: {
    id: string
    name: string
    startDate: string
    endDate: string
    status: string
    goal: string | null
  } | null
  issues: IssueWithRelations[]
}

interface UseBoardDataReturn {
  sprint: BoardData['sprint']
  issues: IssueWithRelations[]
  isLoading: boolean
  error: Error | null
}

export function useBoardData(teamId?: string): UseBoardDataReturn {
  const params = new URLSearchParams()
  if (teamId && teamId !== 'ALL') params.set('teamId', teamId)
  const qs = params.toString()
  const url = qs ? `/api/board?${qs}` : '/api/board'

  const { data, isLoading, error } = useQuery<BoardData>({
    queryKey: ['board', { teamId: teamId || 'ALL' }],
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch board data')
      return res.json()
    },
    staleTime: 30_000,
    placeholderData: (previousData: BoardData | undefined) => previousData, // keep old data during refetch — prevents "No Active Sprint" flash
  })

  return {
    sprint: data?.sprint ?? null,
    issues: data?.issues ?? [],
    isLoading,
    error: error as Error | null,
  }
}
