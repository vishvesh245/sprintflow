export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDataVersion } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let heartbeatInterval: ReturnType<typeof setInterval> | null = null
        let refreshInterval: ReturnType<typeof setInterval> | null = null

        const cleanup = () => {
          if (heartbeatInterval) clearInterval(heartbeatInterval)
          if (refreshInterval) clearInterval(refreshInterval)
          heartbeatInterval = null
          refreshInterval = null
        }

        const safeSend = (msg: string): boolean => {
          try {
            controller.enqueue(encoder.encode(msg))
            return true
          } catch {
            cleanup()
            try { controller.close() } catch {}
            return false
          }
        }

        // Send initial connection message (named event so client can listen)
        safeSend('event: connected\ndata: {}\n\n')

        // Heartbeat every 30s to keep the connection alive
        heartbeatInterval = setInterval(() => {
          safeSend('event: heartbeat\ndata: {}\n\n')
        }, 30000)

        // Check for data changes every 10s — only push refresh when
        // something actually mutated (version bump) instead of blindly
        // every 60s. Eliminates ~90% of unnecessary client-side refetches.
        let lastSentVersion = getDataVersion()
        refreshInterval = setInterval(() => {
          const current = getDataVersion()
          if (current > lastSentVersion) {
            lastSentVersion = current
            safeSend(`event: refresh\ndata: {"v":${current}}\n\n`)
          }
        }, 10000)

        // Handle request abort — clean up BOTH intervals
        request.signal.addEventListener('abort', () => {
          cleanup()
          try { controller.close() } catch {}
        })
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('SSE connection error:', error)
    return NextResponse.json(
      { error: 'Failed to establish SSE connection' },
      { status: 500 }
    )
  }
}
