'use client'

import { useState } from 'react'
import { LINK_TYPE_DISPLAY } from '@/types'
import Image from 'next/image'
import { getStatusBadge } from '@/lib/colors'

interface LinkedIssue {
  id: string
  displayId: string
  title: string
  status: string
  team: {
    id: string
    name: string
    key: string
    color?: string
  }
  assignee?: {
    id: string
    name: string | null
    image: string | null
  }
}

interface IssueLink {
  id: string
  type: string
  targetIssue: LinkedIssue
}

interface IssueLinkProps {
  issueId: string
  links: IssueLink[]
  onAddLink: (targetId: string, type: string) => Promise<void>
  onRemoveLink: (linkId: string) => Promise<void>
}

export function IssueLinks({
  issueId,
  links,
  onAddLink,
  onRemoveLink,
}: IssueLinkProps) {
  const [showAddLink, setShowAddLink] = useState(false)
  const [targetId, setTargetId] = useState('')
  const [linkType, setLinkType] = useState('RELATES_TO')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddLink = async () => {
    if (!targetId.trim()) return

    setIsSubmitting(true)
    try {
      await onAddLink(targetId, linkType)
      setTargetId('')
      setShowAddLink(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const groupedLinks = links.reduce(
    (acc, link) => {
      const type = link.type
      if (!acc[type]) acc[type] = []
      acc[type].push(link)
      return acc
    },
    {} as Record<string, IssueLink[]>
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

  return (
    <div className="space-y-6 border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Linked Issues</h3>
        <button
          onClick={() => setShowAddLink(!showAddLink)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showAddLink ? 'Cancel' : '+ Add link'}
        </button>
      </div>

      {showAddLink && (
        <div className="space-y-3 rounded bg-gray-50 p-4">
          <input
            type="text"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="Issue ID or display ID..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {Object.entries(LINK_TYPE_DISPLAY).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddLink(false)}
              className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddLink}
              disabled={isSubmitting || !targetId.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add link'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groupedLinks).map(([type, typeLinks]) => {
          const isTestedBy = type === 'TESTED_BY'
          const openBugCount = isTestedBy
            ? typeLinks.filter((l) => l.targetIssue.status !== 'DONE').length
            : 0
          return (
            <div key={type}>
              <div className="mb-2 flex items-center gap-2">
                <h4 className={`text-sm font-medium ${isTestedBy && openBugCount > 0 ? 'text-orange-700' : 'text-gray-700'}`}>
                  {LINK_TYPE_DISPLAY[type]}
                </h4>
                {isTestedBy && openBugCount > 0 && (
                  <span className="text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                    {openBugCount} open ⚠
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {typeLinks.map((link) => {
                  const isBugOpen = isTestedBy && link.targetIssue.status !== 'DONE'
                  return (
                    <div
                      key={link.id}
                      className={`flex items-center justify-between rounded border p-3 ${
                        isBugOpen ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-3 w-3 rounded-full ${getTeamColor(link.targetIssue.team.color)}`}
                        />
                        <span className="text-sm font-mono text-gray-600">
                          {link.targetIssue.displayId}
                        </span>
                        <span className={`text-sm ${isBugOpen ? 'text-orange-900 font-medium' : 'text-gray-900'}`}>
                          {link.targetIssue.title}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                            getStatusBadge(link.targetIssue.status)
                          }`}
                        >
                          {link.targetIssue.status
                            .split('_')
                            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join(' ')}
                        </span>
                        {link.targetIssue.assignee && (
                          <div className="flex-shrink-0">
                            {link.targetIssue.assignee.image ? (
                              <Image
                                src={link.targetIssue.assignee.image}
                                alt={link.targetIssue.assignee.name || 'User'}
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded-full"
                              />
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">
                                <span className="text-xs font-medium text-gray-600">
                                  {(link.targetIssue.assignee.name?.[0] || 'U').toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onRemoveLink(link.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {Object.keys(groupedLinks).length === 0 && !showAddLink && (
        <p className="text-sm text-gray-500">No linked issues yet.</p>
      )}
    </div>
  )
}
