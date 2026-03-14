'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface Team {
  id: string
  name: string
  color: string
}

export function TeamSelectionModal({ userId }: { userId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const router = useRouter()
  const { update: updateSession } = useSession()

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams')
        if (response.ok) {
          const data = await response.json()
          setTeams(data)
          if (data.length === 1) {
            setSelectedTeam(data[0].id)
          }
        }
      } catch (error) {
        toast.error('Failed to load teams')
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  const handleAssignTeam = async () => {
    if (!selectedTeam) return

    try {
      setAssigning(true)
      const response = await fetch(`/api/users/${userId}/team`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeam }),
      })

      if (response.ok) {
        // Update the JWT session so teamId is immediately available
        await updateSession({ teamId: selectedTeam })
        router.refresh()
      }
    } catch (error) {
      toast.error('Failed to assign team')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Select Your Team</h2>
          <p className="text-slate-600 mt-2">
            Choose a team to get started with Sprinto
          </p>
        </div>

        {teams.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              No teams available. Please contact an administrator.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {teams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center p-4 rounded-lg border-2 cursor-pointer transition-colors duration-200"
                  style={{
                    borderColor:
                      selectedTeam === team.id ? '#3B82F6' : '#e2e8f0',
                    backgroundColor:
                      selectedTeam === team.id ? '#eff6ff' : '#ffffff',
                  }}
                >
                  <input
                    type="radio"
                    name="team"
                    value={team.id}
                    checked={selectedTeam === team.id}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="ml-4 flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: team.color }}
                    ></div>
                    <span className="font-medium text-slate-900">
                      {team.name}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleAssignTeam}
              disabled={!selectedTeam || assigning}
              className="w-full px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {assigning ? 'Assigning...' : 'Continue'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
