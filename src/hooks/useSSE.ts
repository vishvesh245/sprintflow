import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateIssueCaches, invalidateSprintCaches } from '@/lib/invalidateRelatedCaches'

const MAX_RECONNECT_DELAY = 60_000 // 60 seconds
const BASE_DELAY = 3_000 // 3 seconds
const MAX_RETRIES = 20

export function useSSE() {
  const queryClient = useQueryClient()
  const retriesRef = useRef(0)

  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connect = () => {
      try {
        eventSource = new EventSource('/api/events')

        eventSource.addEventListener('connected', () => {
          // Reset backoff on successful connection
          retriesRef.current = 0
        })

        eventSource.addEventListener('refresh', () => {
          // Invalidate all live-data caches so every view stays in sync
          invalidateIssueCaches(queryClient)
          invalidateSprintCaches(queryClient)
        })

        eventSource.addEventListener('error', () => {
          if (eventSource) {
            eventSource.close()
            eventSource = null
          }

          // Exponential backoff with cap and retry limit
          if (retriesRef.current >= MAX_RETRIES) {
            console.warn('[SSE] Max retries reached, giving up')
            return
          }

          const delay = Math.min(
            BASE_DELAY * Math.pow(2, retriesRef.current),
            MAX_RECONNECT_DELAY,
          )
          retriesRef.current++
          reconnectTimeout = setTimeout(connect, delay)
        })
      } catch (error) {
        console.error('Failed to connect to SSE:', error)
        if (retriesRef.current < MAX_RETRIES) {
          const delay = Math.min(
            BASE_DELAY * Math.pow(2, retriesRef.current),
            MAX_RECONNECT_DELAY,
          )
          retriesRef.current++
          reconnectTimeout = setTimeout(connect, delay)
        }
      }
    }

    connect()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [queryClient])
}
