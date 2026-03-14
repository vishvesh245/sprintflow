'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { EpicDetail } from '@/components/epics/EpicDetail'

export default function EpicDetailPage() {
  const params = useParams()
  const epicId = params.id as string
  const [isEditing, setIsEditing] = useState(false)

  const { data: epic, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['epic', epicId],
    queryFn: async () => {
      const res = await fetch(`/api/epics/${epicId}`)
      if (!res.ok) throw new Error('Failed to fetch epic')
      return res.json()
    },
    enabled: !!epicId,
    staleTime: 30_000,
  })
  const error = queryError ? (queryError as Error).message : null

  const calculateTeamProgress = (teamKey: string) => {
    if (!epic) return { total: 0, completed: 0, progress: 0 }

    const teamIssues = epic.issues.filter((i: any) => i.team?.prefix === teamKey)
    const completedIssues = teamIssues.filter((i: any) => i.status === 'DONE')

    return {
      total: teamIssues.length,
      completed: completedIssues.length,
      progress:
        teamIssues.length > 0
          ? Math.round((completedIssues.length / teamIssues.length) * 100)
          : 0,
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-gray-500">Loading epic...</p>
      </div>
    )
  }

  if (error || !epic) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-red-600">{error || 'Epic not found'}</p>
      </div>
    )
  }

  const teamProgresses = {
    FE: calculateTeamProgress('FE'),
    BE: calculateTeamProgress('BE'),
    QA: calculateTeamProgress('QA'),
  }

  return (
    <EpicDetail
      epic={epic}
      teamProgresses={teamProgresses}
      onEdit={() => setIsEditing(!isEditing)}
    />
  )
}
