import { QueryClient } from '@tanstack/react-query'

/**
 * Invalidate all query caches that could be affected by an issue mutation.
 *
 * Call this from ANY code path that changes issue data (status, sprint,
 * assignee, creation, deletion, etc.) so that every view — board, backlog,
 * sprint overview — stays in sync.
 */
export function invalidateIssueCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['issues'] })
  queryClient.invalidateQueries({ queryKey: ['board'] })
  queryClient.invalidateQueries({ queryKey: ['sprint-overview'] })
}

/**
 * Invalidate all sprint-related caches.
 * Call after sprint create / start / complete / delete.
 */
export function invalidateSprintCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['sprints'] })
  queryClient.invalidateQueries({ queryKey: ['board'] })
  queryClient.invalidateQueries({ queryKey: ['sprint-overview'] })
}
