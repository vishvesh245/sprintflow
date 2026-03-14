'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUsers } from '@/hooks/useUsers'
import { toast } from 'sonner'
import { Loader2, Shield, ShieldOff } from 'lucide-react'
import { SkeletonLoader } from '@/components/ui/loaders'

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // useUsers pulls from the shared ['users'] cache (5 min staleTime).
  // No extra fetch if another page already warmed the cache.
  const { users, isLoading, error } = useUsers()

  // Redirect non-admins to profile
  useEffect(() => {
    if (session && (session.user as any).role !== 'ADMIN') {
      router.replace('/profile')
    }
  }, [session, router])

  const { mutate: updateRole } = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'ADMIN' | 'MEMBER' }) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }
      return res.json()
    },
    onMutate: ({ userId }) => setUpdatingId(userId),
    onSuccess: (updated) => {
      // Update the users cache directly so the row flips instantly
      queryClient.setQueryData<typeof users>(['users'], (prev) =>
        prev?.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u)) ?? []
      )
      setUpdatingId(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
      setUpdatingId(null)
    },
  })

  const handleRoleChange = (userId: string, newRole: 'ADMIN' | 'MEMBER') => {
    updateRole({ userId, newRole })
  }

  const isSelf = (userId: string) => session?.user?.id === userId

  if (!session) return null

  if ((session.user as any).role !== 'ADMIN') {
    return <SkeletonLoader />
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error.message}</p>
        </div>
      )}

      {/* User Management */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">User Management</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {users.length} user{users.length !== 1 ? 's' : ''} · Promote or demote admins
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
            <Shield className="h-3.5 w-3.5" />
            Admin Panel
          </span>
        </div>

        {isLoading ? (
          <SkeletonLoader message="Loading team members..." />
        ) : users.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500 text-sm">No users found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((user) => {
              const displayedName = user.displayName || user.name
              const isAdmin = user.role === 'ADMIN'
              const self = isSelf(user.id)
              const isUpdating = updatingId === user.id

              return (
                <div key={user.id} className="px-6 py-4 flex items-center gap-4">
                  {/* Avatar */}
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={displayedName ?? ''}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                      {(displayedName ?? 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Name + Email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {displayedName}
                      </p>
                      {self && (
                        <span className="text-xs text-gray-400">(you)</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>

                  {/* Team */}
                  <div className="hidden sm:flex w-36 shrink-0 justify-center">
                    {user.team ? (
                      <span className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-0.5">
                        {user.team.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No team</span>
                    )}
                  </div>

                  {/* Role badge */}
                  <div className="w-24 shrink-0 flex justify-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isAdmin
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {isAdmin && <Shield className="h-3 w-3" />}
                      {isAdmin ? 'Admin' : 'Member'}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="w-28 shrink-0 flex justify-end">
                    {self ? (
                      <span className="text-xs text-gray-400">Your account</span>
                    ) : isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : isAdmin ? (
                      <button
                        onClick={() => handleRoleChange(user.id, 'MEMBER')}
                        className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded px-2 py-1 transition-colors"
                        title="Revoke admin"
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        Revoke Admin
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRoleChange(user.id, 'ADMIN')}
                        className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded px-2 py-1 transition-colors"
                        title="Grant admin"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Make Admin
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
