/**
 * Simple in-memory cache for API responses.
 *
 * Works because Vercel reuses warm function instances — the same Node.js
 * process serves multiple requests, so cached data persists between them.
 *
 * Each cache entry has a TTL (time-to-live). After the TTL expires, the
 * next request will hit the database and refresh the cache.
 *
 * Mutations call `invalidate(key)` or `invalidatePrefix(prefix)` to
 * clear stale entries immediately.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

// Max entries to prevent unbounded memory growth
const MAX_ENTRIES = 200

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return
  // Evict oldest entries first (Map preserves insertion order)
  const keysToDelete = Array.from(store.keys()).slice(0, store.size - MAX_ENTRIES)
  for (const key of keysToDelete) {
    store.delete(key)
  }
}

/**
 * Get a cached value, or compute and cache it.
 *
 * @param key - Unique cache key (e.g. "board:ALL", "teams")
 * @param ttlMs - Time-to-live in milliseconds
 * @param fn - Async function to compute the value if cache misses
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data
  }

  const data = await fn()
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
  evictIfNeeded()
  return data
}

/** Invalidate a single cache key */
export function invalidate(key: string) {
  store.delete(key)
}

/** Invalidate all keys that start with a given prefix */
export function invalidatePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key)
    }
  }
}

/** Invalidate the entire cache */
export function invalidateAll() {
  store.clear()
}
