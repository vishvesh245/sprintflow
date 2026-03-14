'use client'

import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,           // data stays fresh for 60s — serves cached data instantly on revisit, revalidates in background
            gcTime: 10 * 60_000,        // keep unused query data in memory for 10 min (default 5 min)
            refetchOnWindowFocus: false, // don't refetch when user switches tabs
            retry: 1,                   // 1 retry instead of the default 3
          },
        },
      }),
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  )
}
