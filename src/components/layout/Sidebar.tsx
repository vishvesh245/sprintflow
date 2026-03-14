'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Columns,
  List,
  Layers,
  Palette,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { usePrefetchPages } from '@/hooks/usePrefetchPages'

const COLLAPSED_KEY = 'sprintsync-sidebar-collapsed'

const baseNavigationItems = [
  {
    name: 'Sprint Overview',
    href: '/sprint',
    icon: LayoutDashboard,
  },
  {
    name: 'Board',
    href: '/board',
    icon: Columns,
  },
  {
    name: 'Backlog',
    href: '/backlog',
    icon: List,
  },
  {
    name: 'Epics',
    href: '/epics',
    icon: Layers,
  },
  {
    name: 'Design Board',
    href: '/design-board',
    icon: Palette,
  },
]

const adminNavigationItems = [
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)

  // Restore persisted collapsed preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY)
      if (saved === 'true') setCollapsed(true)
    } catch {}
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSED_KEY, String(next)) } catch {}
      return next
    })
  }

  // Prefetch data for other pages after current page settles
  usePrefetchPages()

  const isAdmin = (session?.user as any)?.role === 'ADMIN'
  const navigationItems = isAdmin
    ? [...baseNavigationItems, ...adminNavigationItems]
    : baseNavigationItems

  return (
    <div
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } shrink-0 transition-all duration-300 ease-in-out bg-white border-r border-slate-200 flex flex-col h-screen overflow-visible`}
    >
      {/* Logo */}
      <div className={`border-b border-slate-200 flex items-center h-16 px-3 ${collapsed ? 'justify-center' : 'gap-3 px-5'}`}>
        <Link href="/sprint" className="flex items-center gap-3 min-w-0">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 truncate">Sprinto</span>
              <span className="text-xs text-slate-500 truncate">Sprint Management</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <div key={item.href} className="relative group/item">
              <Link
                href={item.href}
                className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="text-sm">{item.name}</span>}
              </Link>

              {/* Tooltip when collapsed */}
              {collapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150">
                  <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap">
                    {item.name}
                  </div>
                  {/* Arrow */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-slate-100">
        <button
          onClick={toggleCollapsed}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2 px-3'} py-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors duration-150 text-xs`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
