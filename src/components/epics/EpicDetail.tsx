'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { getStatusBadge } from '@/lib/colors'
import { StatusBadge } from '../issues/StatusBadge'

interface Issue {
  id: string
  displayId: string
  title: string
  status: string
  assignee?: {
    name: string | null
    image: string | null
  }
  team?: {
    prefix: string
    name?: string
    color?: string
  }
}

interface EpicDetailProps {
  epic: {
    id: string
    title: string
    description?: string
    status: string
    targetSprint?: {
      id: string
      name: string
    }
    createdAt: Date | string
    updatedAt: Date | string
    issues: Issue[]
  }
  teamProgresses: Record<
    string,
    { total: number; completed: number; progress: number }
  >
  onEdit: () => void
}

export function EpicDetail({
  epic,
  teamProgresses,
  onEdit,
}: EpicDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'fe' | 'be' | 'qa'>(
    'overview'
  )

  const getTeamColor = (color?: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      pink: 'bg-pink-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      indigo: 'bg-indigo-500',
      cyan: 'bg-cyan-500',
    }
    return colorMap[color?.toLowerCase() || 'blue'] || 'bg-blue-500'
  }

  const issuesByTeam = {
    FE: epic.issues.filter((i) => i.team?.prefix === 'FE'),
    BE: epic.issues.filter((i) => i.team?.prefix === 'BE'),
    QA: epic.issues.filter((i) => i.team?.prefix === 'QA'),
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    {
      id: 'fe' as const,
      label: `FE Issues (${issuesByTeam.FE.length})`,
    },
    {
      id: 'be' as const,
      label: `BE Issues (${issuesByTeam.BE.length})`,
    },
    {
      id: 'qa' as const,
      label: `QA Issues (${issuesByTeam.QA.length})`,
    },
  ]

  const renderIssuesList = (issues: Issue[]) => (
    <div className="space-y-2">
      {issues.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">No issues in this team</p>
      ) : (
        issues.map((issue) => (
          <div
            key={issue.id}
            className="flex items-center gap-3 rounded border border-gray-200 bg-white p-3 hover:bg-gray-50"
          >
            <span className="font-mono text-xs font-semibold text-gray-600">
              {issue.displayId}
            </span>
            <span className="flex-1 text-sm text-gray-900">{issue.title}</span>
            <span
              className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                getStatusBadge(issue.status)
              }`}
            >
              {issue.status
                .split('_')
                .map(
                  (word) =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                )
                .join(' ')}
            </span>
            {issue.assignee && (
              <div className="h-6 w-6 rounded-full bg-gray-200 text-center text-xs font-medium text-gray-600">
                {issue.assignee.name?.[0] || '?'}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )

  const teamProgressBars = (teamKey: string) => {
    const progress = teamProgresses[teamKey]
    if (!progress) return null

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            {progress.completed} of {progress.total} completed
          </p>
          <p className="text-sm font-semibold text-gray-900">{progress.progress}%</p>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{epic.title}</h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={epic.status} />
            {epic.targetSprint && (
              <span className="text-sm text-gray-600">
                Target: {epic.targetSprint.name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Edit Epic
        </button>
      </div>

      {/* Description */}
      {epic.description && (
        <div className="rounded bg-gray-50 p-4">
          <p className="text-sm text-gray-700">{epic.description}</p>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Total Issues</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {epic.issues.length}
          </p>
        </div>
        {['FE', 'BE', 'QA'].map((teamKey) => {
          const progress = teamProgresses[teamKey]
          return (
            <div key={teamKey} className="rounded border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">
                {teamKey} Issues
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {progress?.total || 0}
              </p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* FE Progress */}
            <div className="rounded border border-gray-200 bg-white p-4">
              <h3 className="mb-4 font-semibold text-gray-900">Frontend Team</h3>
              {teamProgressBars('FE')}
            </div>

            {/* BE Progress */}
            <div className="rounded border border-gray-200 bg-white p-4">
              <h3 className="mb-4 font-semibold text-gray-900">Backend Team</h3>
              {teamProgressBars('BE')}
            </div>

            {/* QA Progress */}
            <div className="rounded border border-gray-200 bg-white p-4">
              <h3 className="mb-4 font-semibold text-gray-900">QA Team</h3>
              {teamProgressBars('QA')}
            </div>
          </div>
        )}

        {activeTab === 'fe' && (
          <div className="rounded border border-gray-200 bg-white p-4">
            {teamProgressBars('FE')}
            <div className="mt-4">{renderIssuesList(issuesByTeam.FE)}</div>
          </div>
        )}

        {activeTab === 'be' && (
          <div className="rounded border border-gray-200 bg-white p-4">
            {teamProgressBars('BE')}
            <div className="mt-4">{renderIssuesList(issuesByTeam.BE)}</div>
          </div>
        )}

        {activeTab === 'qa' && (
          <div className="rounded border border-gray-200 bg-white p-4">
            {teamProgressBars('QA')}
            <div className="mt-4">{renderIssuesList(issuesByTeam.QA)}</div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="border-t border-gray-200 pt-6">
        <div className="text-xs text-gray-500">
          <p>Created: {formatDate(epic.createdAt)}</p>
          <p>Last updated: {formatDate(epic.updatedAt)}</p>
        </div>
      </div>
    </div>
  )
}
