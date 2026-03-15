/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Usage in an API route:
 *   import { rateLimit } from '@/lib/rate-limit'
 *   const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 })
 *
 *   // Inside handler:
 *   const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
 *   const { success } = await limiter.check(10, ip)   // 10 requests per interval
 *   if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 */

interface RateLimitOptions {
  /** Time window in milliseconds (default: 60 000 = 1 minute) */
  interval?: number
  /** Max number of unique tokens (IPs) to track before evicting oldest (default: 500) */
  uniqueTokenPerInterval?: number
}

interface TokenBucket {
  count: number
  expiresAt: number
}

export function rateLimit(opts: RateLimitOptions = {}) {
  const interval = opts.interval ?? 60_000
  const maxTokens = opts.uniqueTokenPerInterval ?? 500
  const tokenCache = new Map<string, TokenBucket>()

  // Periodic cleanup to prevent unbounded growth
  const cleanup = () => {
    const now = Date.now()
    for (const [key, bucket] of tokenCache) {
      if (bucket.expiresAt < now) tokenCache.delete(key)
    }
    // Evict oldest if we exceed the max unique tokens
    if (tokenCache.size > maxTokens) {
      const keysToDelete = tokenCache.size - maxTokens
      const iter = tokenCache.keys()
      for (let i = 0; i < keysToDelete; i++) {
        const { value } = iter.next()
        if (value) tokenCache.delete(value)
      }
    }
  }

  return {
    check(limit: number, token: string): Promise<{ success: boolean; remaining: number }> {
      return new Promise((resolve) => {
        const now = Date.now()
        const bucket = tokenCache.get(token)

        if (!bucket || bucket.expiresAt < now) {
          // New window
          tokenCache.set(token, { count: 1, expiresAt: now + interval })
          cleanup()
          resolve({ success: true, remaining: limit - 1 })
        } else {
          bucket.count += 1
          if (bucket.count > limit) {
            resolve({ success: false, remaining: 0 })
          } else {
            resolve({ success: true, remaining: limit - bucket.count })
          }
        }
      })
    },
  }
}
