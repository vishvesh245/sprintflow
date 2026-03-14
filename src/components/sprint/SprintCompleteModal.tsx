'use client'

import { useState } from 'react'
import { Sprint, IssueWithRelations } from '@/types'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/issues/StatusBadge'

interface SprintCompleteModalProps {
  isOpen: boolean
  sprint: Sprint
  issues: IssueWithRelations[]
  nextSprints: Sprint[]
  onClose: () => void
  onSubmit: (data: { issueUpdates: Array<{ issueId: string; sprintId: string | null }> }) => Promise<void>
}

export default function SprintCompleteModal({
  isOpen,
  sprint,
  issues,
  nextSprints,
  onClose,
  onSubmit,
}: SprintCompleteModalProps) {
  const [issueUpdates, setIssueUpdates] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const incompleteIssues = issues.filter(i => i.status !== 'DONE')
  const completeIssues = issues.filter(i => i.status === 'DONE')

  const handleUpdateIssue = (issueId: string, value: string) => {
    if (!value) {
      // User reset to "Select Action" — remove the entry so it's unresolved
      setIssueUpdates(prev => {
        const next = { ...prev }
        delete next[issueId]
        return next
      })
    } else {
      setIssueUpdates(prev => ({
        ...prev,
        [issueId]: value === 'null' ? null : value,
      }))
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const updates = incompleteIssues.map(issue => ({
        issueId: issue.id,
        sprintId: issueUpdates[issue.id] ?? null,
      }))
      await onSubmit({ issueUpdates: updates })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // Dynamic team grouping — derives teams from actual issue data
  const issuesByTeam: Record<string, IssueWithRelations[]> = {}
  incompleteIssues.forEach(issue => {
    const teamName = issue.team?.name || 'Unassigned'
    if (!issuesByTeam[teamName]) issuesByTeam[teamName] = []
    issuesByTeam[teamName].push(issue)
  })

  // Dynamic completed issues by team
  const completedByTeam: Record<string, number> = {}
  completeIssues.forEach(issue => {
    const teamName = issue.team?.name || 'Unassigned'
    completedByTeam[teamName] = (completedByTeam[teamName] || 0) + 1
  })

  // Validation: every incomplete issue must have an action selected
  const unresolvedCount = incompleteIssues.filter(i => !(i.id in issueUpdates) || issueUpdates[i.id] === undefined).length
  const allResolved = incompleteIssues.length === 0 || unresolvedCount === 0

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Complete Sprint: {sprint.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Review and handle incomplete issues before completing the sprint</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-2.5 border border-green-200">
              <div className="text-sm font-medium text-green-700">Completed</div>
              <div className="text-xl font-bold text-green-600">{completeIssues.length}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2.5 border border-yellow-200">
              <div className="text-sm font-medium text-yellow-700">Incomplete</div>
              <div className="text-xl font-bold text-yellow-600">{incompleteIssues.length}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-200">
              <div className="text-sm font-medium text-blue-700">Total</div>
              <div className="text-xl font-bold text-blue-600">{issues.length}</div>
            </div>
          </div>

          {/* Incomplete Issues by Team */}
          {incompleteIssues.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">Incomplete Issues by Team</h3>
              {Object.entries(issuesByTeam).map(([teamName, teamIssues]) => (
                <div key={teamName}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{teamName} ({teamIssues.length})</h4>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
                    {teamIssues.map(issue => (
                      <div key={issue.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm text-gray-500 shrink-0">{issue.displayId}</span>
                          <span className="text-sm text-gray-900 truncate">{issue.title}</span>
                        </div>
                        <StatusBadge status={issue.status} size="sm" />
                        <select
                          value={issue.id in issueUpdates ? (issueUpdates[issue.id] === null ? 'null' : issueUpdates[issue.id]!) : ''}
                          onChange={(e) => handleUpdateIssue(issue.id, e.target.value)}
                          className="w-44 shrink-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-600"
                        >
                          <option value="">Select Action</option>
                          <option value="null">Move to Backlog</option>
                          {nextSprints.map(s => (
                            <option key={s.id} value={s.id}>Move to {s.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Issues Summary */}
          {completeIssues.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <h3 className="font-semibold text-green-900 text-sm mb-2">Completed Issues ({completeIssues.length})</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(completedByTeam).map(([teamName, count]) => (
                  <div key={teamName} className="text-sm text-green-800">
                    <span className="font-medium">{teamName}:</span> {count}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-2">
          {!allResolved && incompleteIssues.length > 0 && (
            <p className="text-xs text-amber-600 text-right">
              {unresolvedCount} issue{unresolvedCount !== 1 ? 's' : ''} still need an action selected
            </p>
          )}
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleSubmit}
              disabled={loading || !allResolved}
            >
              {loading ? 'Completing...' : 'Complete Sprint'}
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
