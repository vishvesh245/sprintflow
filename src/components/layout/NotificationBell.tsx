'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'

interface Notification {
  id: string
  message: string
  createdAt: Date
  read: boolean
  issueId?: string
  issueName?: string
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside
  useEffect(() => {
    if (!showPanel) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPanel])

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/notifications')
        if (response.ok) {
          const data = await response.json()
          setNotifications(data)
        }
      } catch (error) {
        toast.error('Failed to load notifications')
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
  }, [])

  const openPanel = () => {
    setShowPanel(true)
    // Mark all unread as read as soon as the panel opens
    const hasUnread = notifications.some((n) => !n.read)
    if (hasUnread) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      }).catch(console.error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (notification.issueId) {
      setShowPanel(false)
      router.push(`/issues/${notification.issueId}`)
    }
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(date).getTime()) / 1000
    )
    const intervals: { [key: string]: number } = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    }

    for (const [key, value] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / value)
      if (interval >= 1) {
        return `${interval}${key.charAt(0)} ago`
      }
    }
    return 'just now'
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => (showPanel ? setShowPanel(false) : openPanel())}
        className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors duration-200"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showPanel && (
        <div className="absolute right-0 mt-2 w-96 rounded-lg bg-white border border-slate-200 shadow-xl z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="p-4 text-center text-slate-500">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`group p-4 border-b border-slate-100 transition-colors duration-200 ${
                    notification.issueId ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    notification.read
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 font-medium">
                        {notification.message}
                      </p>
                      {notification.issueName && (
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {notification.issueName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      )}
                      {notification.issueId && (
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {formatTimeAgo(notification.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
