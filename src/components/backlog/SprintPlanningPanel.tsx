'use client'

import { Sprint, IssueWithRelations } from '@/types'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface SprintPlanningPanelProps {
  sprint: Sprint
  allIssues: IssueWithRelations[]
}

export default function SprintPlanningPanel({ sprint, allIssues }: SprintPlanningPanelProps) {
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [starting, setStarting] = useState(false)

  // Get issues in this sprint
  const sprintIssues = allIssues.filter(i => i.sprintId === sprint.id)

  // Group by team
  const issuesByTeam = {
    Frontend: sprintIssues.filter(i => i.team?.name === 'Frontend'),
    Backend: sprintIssues.filter(i => i.team?.name === 'Backend'),
    QA: sprintIssues.filter(i => i.team?.name === 'QA'),
  }

  // Calculate total story points
  const totalStoryPoints = sprintIssues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0)

  const handleStartSprint = async () => {
    setStarting(true)
    try {
      // Check if any other sprint is active
      const sprintsRes = await fetch('/api/sprints?status=ACTIVE')
      const activeSprints = await sprintsRes.json()

      if (activeSprints.length > 0) {
        alert('Cannot start sprint: Another sprint is already active. Complete the active sprint first.')
        setStarting(false)
        return
      }

      // Update sprint status to ACTIVE
      const res = await fetch(`/api/sprints/${sprint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })

      if (res.ok) {
        setShowStartDialog(false)
        window.location.reload()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to start sprint')
      }
    } catch (err) {
      toast.error('Error starting sprint')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sprint Info */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">{sprint.name}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Start:</span>
            <span className="font-medium">{new Date(sprint.startDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">End:</span>
            <span className="font-medium">{new Date(sprint.endDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-gray-600">Total Issues:</span>
            <span className="font-semibold">{sprintIssues.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Story Points:</span>
            <span className="font-semibold">{totalStoryPoints}</span>
          </div>
        </div>
      </div>

      {/* Team Breakdown */}
      {sprintIssues.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3 text-sm">Issues by Team</h4>
          <div className="space-y-2">
            {Object.entries(issuesByTeam).map(([team, teamIssues]) => (
              teamIssues.length > 0 && (
                <div key={team} className="flex justify-between text-sm">
                  <span className="text-gray-600">{team}</span>
                  <span className="font-medium">{teamIssues.length}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Start Sprint Button */}
      {sprintIssues.length > 0 && (
        <>
          <Button
            onClick={() => setShowStartDialog(true)}
            className="w-full"
            disabled={starting}
          >
            {starting ? 'Starting...' : 'Start Sprint'}
          </Button>

          <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start Sprint?</AlertDialogTitle>
                <AlertDialogDescription>
                  Start the sprint <strong>{sprint.name}</strong> with {sprintIssues.length} issues and {totalStoryPoints} story points?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex justify-end gap-3">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleStartSprint}>Start Sprint</AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* Empty State */}
      {sprintIssues.length === 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-600">No issues in this sprint yet</p>
          <p className="text-xs text-gray-500 mt-1">Add issues from the backlog to plan your sprint</p>
        </div>
      )}
    </div>
  )
}
