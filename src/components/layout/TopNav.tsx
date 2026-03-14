'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, X } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { IssueForm } from '@/components/issues/IssueForm'
import { useTeams } from '@/hooks/useTeams'
import { useUsers } from '@/hooks/useUsers'
import { useEpics } from '@/hooks/useEpics'
import { useSprints } from '@/hooks/useSprints'

const pageNames: Record<string, string> = {
  '/sprint': 'Sprint Overview',
  '/board': 'Board',
  '/backlog': 'Backlog',
  '/epics': 'Epics',
  '/design-board': 'Design Board',
  '/settings': 'Settings',
  '/profile': 'Profile',
}

const pageSubtitles: Record<string, string> = {
  '/backlog': 'Manage and plan issues for upcoming sprints',
  '/settings': 'Admin panel — manage user roles and permissions',
  '/profile': 'Manage your personal settings and preferences',
  '/design-board': 'Manage and track design work across your team',
}

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close user dropdown when clicking outside
  useEffect(() => {
    if (!showUserDropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUserDropdown])

  const [showCreateIssue, setShowCreateIssue] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [successIssue, setSuccessIssue] = useState<{ id: string; displayId: string; sprintId?: string } | null>(null)

  // Dynamic pages like /issues/[id] won't match the static map — derive a label
  const pageName = pageNames[pathname]
    ?? (pathname.startsWith('/issues/') ? 'Issue Detail'
      : pathname.startsWith('/design-board/') ? 'Design Board'
      : 'Dashboard')
  const pageSubtitle = pageSubtitles[pathname]

  // Reference data for the "Create Issue" modal.
  // Deferred: load after 2s idle so page-critical data fetches get priority.
  const [refDataReady, setRefDataReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setRefDataReady(true), 2000)
    return () => clearTimeout(t)
  }, [])

  // Enable immediately if modal is open (user clicked before 2s)
  const shouldFetch = refDataReady || showCreateIssue
  const { teams } = useTeams({ enabled: shouldFetch })
  const { users } = useUsers({ enabled: shouldFetch })
  const { epics } = useEpics({ enabled: shouldFetch })
  const { sprints: allSprints } = useSprints(undefined, { summary: true, enabled: shouldFetch })
  // Only show active/planning sprints in the create-issue dropdown
  const sprints = allSprints.filter(s => s.status !== 'COMPLETED')

  const handleOpenCreate = () => {
    setCreateError(null)
    setShowCreateIssue(true)
  }

  const handleCloseCreate = () => {
    setShowCreateIssue(false)
    setCreateError(null)
  }

  const handleCreateIssue = async (formData: {
    title: string
    description: string
    type: string
    priority: string
    teamId: string
    sprintId: string
    epicId: string
    assigneeId: string
    storyPoints: number
    parentIssueId?: string
    linkedTaskId?: string
  }) => {
    setCreateError(null)
    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        priority: formData.priority,
        teamId: formData.teamId,
        sprintId: formData.sprintId || undefined,
        epicId: formData.epicId || undefined,
        assigneeId: formData.assigneeId || undefined,
        storyPoints: formData.storyPoints > 0 ? formData.storyPoints : undefined,
        // SUBTASK: link to parent via parentIssueId
        parentIssueId: formData.type === 'SUBTASK' && formData.parentIssueId
          ? formData.parentIssueId
          : undefined,
        // BUG: create TESTS/TESTED_BY links via testLinks
        testLinks: formData.type === 'BUG' && formData.linkedTaskId
          ? [formData.linkedTaskId]
          : undefined,
      }

      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create issue')
      }

      const created = await res.json()
      handleCloseCreate()
      setSuccessIssue({ id: created.id, displayId: created.displayId, sprintId: created.sprintId })

      // Invalidate all issue queries — Board, Backlog, Sprint Overview all update automatically.
      // No window event needed anymore; React Query cache invalidation handles cross-page sync.
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      // If assigned to a sprint, also refresh sprint data
      if (created.sprintId) {
        queryClient.invalidateQueries({ queryKey: ['sprints'] })
      }

      // Auto-hide the success banner after 6 seconds
      setTimeout(() => setSuccessIssue(null), 6000)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create issue')
      throw err // Re-throw so IssueForm keeps isSubmitting = false properly
    }
  }

  return (
    <>
      {/* Success banner after issue creation */}
      {successIssue && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-3 rounded-lg bg-green-600 px-4 py-3 text-white shadow-lg">
          <span className="text-sm font-medium">
            ✓ Issue <span className="font-bold">{successIssue.displayId}</span> created!
          </span>
          <a
            href={`/issues/${successIssue.id}`}
            className="text-sm underline hover:text-green-100"
          >
            View issue
          </a>
          <span className="text-xs text-green-200">
            {successIssue.sprintId ? '→ On the Board' : '→ In Backlog'}
          </span>
          <button onClick={() => setSuccessIssue(null)} className="ml-1 text-green-200 hover:text-white">×</button>
        </div>
      )}

      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        {/* Left Section - Page Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">{pageName}</h1>
          {pageSubtitle && (
            <p className="text-xs text-slate-500 truncate">{pageSubtitle}</p>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Create Issue Button — hidden on Design Board (has its own "Create Design Item" CTA) */}
          {!pathname.startsWith('/design-board') && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Issue</span>
            </button>
          )}

          {/* Notifications */}
          <NotificationBell />

          {/* User Avatar Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors duration-200"
            >
              {session?.user?.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <ChevronDown className="w-4 h-4 text-slate-600" />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white border border-slate-200 shadow-lg z-50">
                <div className="p-3 border-b border-slate-200">
                  <p className="text-sm font-medium text-slate-900">
                    {session?.user?.name}
                  </p>
                  <p className="text-xs text-slate-500">{session?.user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowUserDropdown(false); router.push('/profile') }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200"
                >
                  Profile
                </button>
                {(session?.user as any)?.role === 'ADMIN' && (
                  <button
                    onClick={() => { setShowUserDropdown(false); router.push('/settings') }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200"
                  >
                    Settings
                  </button>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200 border-t border-slate-200"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Issue Modal */}
      {showCreateIssue && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseCreate()
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Issue</h2>
              <button
                onClick={handleCloseCreate}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              {createError && (
                <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
                  {createError}
                </div>
              )}
              <IssueForm
                teams={teams}
                sprints={sprints}
                epics={epics}
                users={users}
                onSubmit={handleCreateIssue}
                onCancel={handleCloseCreate}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
