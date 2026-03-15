'use client'

import dynamic from 'next/dynamic'

const Toaster = dynamic(
  () => import('sonner').then((m) => ({ default: m.Toaster })),
  { ssr: false },
)

/** Lazy-loaded Sonner toaster — only used in the dashboard layout so it doesn't bloat the login page. */
export function LazyToaster() {
  return <Toaster position="bottom-right" richColors />
}
