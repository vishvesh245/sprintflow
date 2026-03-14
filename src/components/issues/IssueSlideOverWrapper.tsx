'use client'

import { IssueSlideOverProvider } from '@/contexts/IssueSlideOverContext'
import { IssueSlideOver } from './IssueSlideOver'

/**
 * Client-side wrapper that provides the slide-over context and renders the panel.
 * Used in the server-rendered dashboard layout to avoid making the layout a client component.
 */
export function IssueSlideOverWrapper({ children }: { children: React.ReactNode }) {
  return (
    <IssueSlideOverProvider>
      {children}
      <IssueSlideOver />
    </IssueSlideOverProvider>
  )
}
