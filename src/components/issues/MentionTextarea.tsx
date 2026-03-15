'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUsers, type UserOption } from '@/hooks/useUsers'
import { formatMention } from '@/lib/utils/mentions'
import Image from 'next/image'

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

/**
 * Drop-in replacement for <textarea> that adds @mention autocomplete.
 * Detects `@` followed by typing to show a user dropdown.
 */
export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
}: MentionTextareaProps) {
  const { users } = useUsers()
  const [showDropdown, setShowDropdown] = useState(false)
  const [query, setQuery] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter users by query
  const filteredUsers = query
    ? users.filter((u) => {
        const q = query.toLowerCase()
        return (
          (u.displayName?.toLowerCase().includes(q)) ||
          (u.name?.toLowerCase().includes(q)) ||
          u.email.toLowerCase().includes(q)
        )
      }).slice(0, 5)
    : users.slice(0, 5)

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [filteredUsers.length])

  // Click outside to close
  useEffect(() => {
    if (!showDropdown) return

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [showDropdown])

  const detectMention = useCallback((text: string, cursorPos: number) => {
    // Look backwards from cursor to find @ trigger
    const textBeforeCursor = text.slice(0, cursorPos)
    const match = textBeforeCursor.match(/@(\w*)$/)

    if (match) {
      setShowDropdown(true)
      setQuery(match[1])
      setMentionStart(cursorPos - match[0].length)
    } else {
      setShowDropdown(false)
      setQuery('')
      setMentionStart(null)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    detectMention(newValue, e.target.selectionStart ?? newValue.length)
  }

  const selectUser = (user: UserOption) => {
    if (mentionStart === null || !textareaRef.current) return

    const cursorPos = textareaRef.current.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(cursorPos)
    const displayName = user.displayName || user.name || user.email
    const mention = formatMention(displayName, user.id)

    const newValue = before + mention + ' ' + after
    onChange(newValue)

    setShowDropdown(false)
    setQuery('')
    setMentionStart(null)

    // Restore cursor position after the inserted mention
    const newCursorPos = mentionStart + mention.length + 1
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.selectionStart = newCursorPos
        textareaRef.current.selectionEnd = newCursorPos
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredUsers.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filteredUsers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectUser(filteredUsers[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowDropdown(false)
    }
  }

  const getUserInitial = (user: UserOption) => {
    return (user.displayName?.[0] || user.name?.[0] || user.email[0]).toUpperCase()
  }

  const defaultClassName =
    'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className || defaultClassName}
      />

      {showDropdown && filteredUsers.length > 0 && (
        <div className="absolute left-0 z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          {filteredUsers.map((user, idx) => (
            <button
              key={user.id}
              type="button"
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                idx === activeIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault() // Prevent textarea blur
                selectUser(user)
              }}
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name || 'User'}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200">
                  <span className="text-xs font-medium text-gray-600">
                    {getUserInitial(user)}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {user.displayName || user.name || user.email}
                </p>
                {(user.displayName || user.name) && (
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                )}
              </div>
            </button>
          ))}
          <div className="border-t border-gray-100 px-3 py-1.5 text-xs text-gray-400">
            Type to filter &middot; &uarr;&darr; to navigate &middot; Enter to select
          </div>
        </div>
      )}
    </div>
  )
}
