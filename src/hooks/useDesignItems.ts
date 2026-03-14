import { useQuery } from '@tanstack/react-query'

export interface DesignItemAssignee {
  id: string
  name: string | null
  email: string
  image: string | null
}

export interface DesignItemTeam {
  id: string
  name: string
  prefix: string
  color: string
}

export interface DesignItem {
  id: string
  title: string
  description: string | null
  status: 'DRAFT' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null
  figmaLink: string | null
  assigneeId: string | null
  visualDesignerId: string | null
  teamId: string
  startDate: string | null
  endDate: string | null
  promotedToIssueId: string | null
  createdAt: string
  updatedAt: string
  assignee: DesignItemAssignee | null
  visualDesigner: DesignItemAssignee | null
  team: DesignItemTeam
  promotedTo: { id: string; displayId: string; title: string } | null
}

interface UseDesignItemsParams {
  teamId?: string
  status?: string
  assigneeId?: string
}

export function useDesignItems(params?: UseDesignItemsParams) {
  const queryParams = new URLSearchParams()

  if (params?.teamId) queryParams.append('teamId', params.teamId)
  if (params?.status) queryParams.append('status', params.status)
  if (params?.assigneeId) queryParams.append('assigneeId', params.assigneeId)

  const queryString = queryParams.toString()

  const { data, isLoading, error, refetch } = useQuery<DesignItem[]>({
    queryKey: ['design-items', params ?? {}],
    queryFn: async () => {
      const url = `/api/design-items${queryString ? `?${queryString}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch design items')
      return res.json()
    },
  })

  return {
    items: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch: () => refetch(),
  }
}
