'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

interface IssueSlideOverContextValue {
  issueId: string | null
  openIssue: (id: string) => void
  closeIssue: () => void
  isOpen: boolean
}

const IssueSlideOverContext = createContext<IssueSlideOverContextValue>({
  issueId: null,
  openIssue: () => {},
  closeIssue: () => {},
  isOpen: false,
})

export function useIssueSlideOver() {
  return useContext(IssueSlideOverContext)
}

export function IssueSlideOverProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Hydrate initial state from URL — if ?issue=abc is present on mount, open the panel
  const [issueId, setIssueId] = useState<string | null>(
    () => searchParams.get('issue'),
  )

  // Use window.history.replaceState for URL updates instead of router.replace.
  // router.replace triggers Next.js soft navigation which re-renders all components
  // using useSearchParams() — including the board page. This caused the board's
  // sprint data to momentarily flash null ("No Active Sprint").
  // window.history.replaceState updates the URL for bookmarkability without
  // triggering any React re-render cycle.

  const openIssue = useCallback(
    (id: string) => {
      setIssueId(id)
      const params = new URLSearchParams(window.location.search)
      params.set('issue', id)
      window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
    },
    [pathname],
  )

  const closeIssue = useCallback(() => {
    setIssueId(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('issue')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname)
  }, [pathname])

  return (
    <IssueSlideOverContext.Provider
      value={{ issueId, openIssue, closeIssue, isOpen: !!issueId }}
    >
      {children}
    </IssueSlideOverContext.Provider>
  )
}
