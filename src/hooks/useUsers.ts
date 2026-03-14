import { useQuery } from '@tanstack/react-query'

export interface UserOption {
  id: string
  name: string | null
  displayName: string | null
  email: string
  image: string | null
  role: 'ADMIN' | 'MEMBER'
  teamId: string | null
  team: { id: string; name: string; prefix: string } | null
}

export function useUsers(opts?: { enabled?: boolean }) {
  const { data, isLoading, error } = useQuery<UserOption[]>({
    queryKey: ['users'],
    enabled: opts?.enabled !== false,
    queryFn: async () => {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      return res.json()
    },
    // User list changes infrequently — keep in cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  })

  return {
    users: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}
