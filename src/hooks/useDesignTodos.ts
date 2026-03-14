import { useQuery } from '@tanstack/react-query'

export interface DesignTodo {
  id: string
  text: string
  completed: boolean
  order: number
  designItemId: string
  createdAt: string
  updatedAt: string
}

export function useDesignTodos(designItemId: string) {
  const { data, isLoading, error, refetch } = useQuery<DesignTodo[]>({
    queryKey: ['design-todos', designItemId],
    queryFn: async () => {
      const res = await fetch(`/api/design-items/${designItemId}/todos`)
      if (!res.ok) throw new Error('Failed to fetch todos')
      return res.json()
    },
    enabled: !!designItemId,
  })

  return {
    todos: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch: () => refetch(),
  }
}
