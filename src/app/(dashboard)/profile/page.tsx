'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Check, Loader2 } from 'lucide-react'
import { SkeletonLoader } from '@/components/ui/loaders'

interface Team {
  id: string
  name: string
  prefix: string
}

interface UserProfile {
  id: string
  name: string
  email: string
  image: string | null
  role: 'ADMIN' | 'MEMBER'
  displayName: string | null
  timezone: string
  notifyOnAssign: boolean
  notifyOnComment: boolean
  teamId: string | null
  team: Team | null
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

export default function ProfilePage() {
  const { update: updateSession } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [teamId, setTeamId] = useState<string>('')
  const [timezone, setTimezone] = useState('UTC')
  const [notifyOnAssign, setNotifyOnAssign] = useState(true)
  const [notifyOnComment, setNotifyOnComment] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, teamsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/teams'),
        ])
        if (!profileRes.ok) throw new Error('Failed to load profile')
        const profileData: UserProfile = await profileRes.json()
        const teamsData: Team[] = teamsRes.ok ? await teamsRes.json() : []

        setProfile(profileData)
        setTeams(teamsData)

        // Populate form with current values
        setDisplayName(profileData.displayName ?? '')
        setTeamId(profileData.teamId ?? '')
        setTimezone(profileData.timezone ?? 'UTC')
        setNotifyOnAssign(profileData.notifyOnAssign ?? true)
        setNotifyOnComment(profileData.notifyOnComment ?? true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          teamId: teamId || null,
          timezone,
          notifyOnAssign,
          notifyOnComment,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      const updated: UserProfile = await res.json()
      setProfile(updated)

      // Refresh session so teamId is updated in JWT
      await updateSession({ teamId: updated.teamId })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SkeletonLoader message="Loading your profile..." />
  }

  if (!profile) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-gray-500">Failed to load profile.</p>
      </div>
    )
  }

  const displayedName = profile.displayName || profile.name

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Identity card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          {profile.image ? (
            <img
              src={profile.image}
              alt={displayedName}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
              {displayedName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-gray-900">{displayedName}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <span
              className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                profile.role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {profile.role === 'ADMIN' ? '⚡ Admin' : 'Member'}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Name and photo are managed by your Google account
        </p>
      </div>

      {/* Editable fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="text-base font-semibold text-gray-900">Preferences</h2>

        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={profile.name}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Override your Google name across the app. Leave blank to use your Google name.
          </p>
        </div>

        {/* Team */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Team
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.prefix})
              </option>
            ))}
          </select>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {/* Notifications */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Email Notifications</p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnAssign}
                onChange={(e) => setNotifyOnAssign(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Ticket assignments</p>
                <p className="text-xs text-gray-500">Get notified when a ticket is assigned to you</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnComment}
                onChange={(e) => setNotifyOnComment(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Comments</p>
                <p className="text-xs text-gray-500">Get notified when someone comments on your tickets</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
        {saved && (
          <p className="text-sm text-green-600 font-medium">Changes saved successfully</p>
        )}
      </div>
    </div>
  )
}
