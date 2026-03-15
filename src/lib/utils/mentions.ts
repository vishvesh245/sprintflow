/**
 * Shared utilities for @mention parsing and formatting.
 *
 * Mention format: @[DisplayName](userId)
 * This is unambiguous (userId is a cuid) and won't collide with markdown.
 */

const MENTION_REGEX = /@\[(.+?)\]\((\w+)\)/g

/**
 * Extract unique user IDs from mention patterns in text.
 */
export function parseMentionedUserIds(text: string): string[] {
  const ids = new Set<string>()
  let match
  // Reset lastIndex for safety since the regex is global
  MENTION_REGEX.lastIndex = 0
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    ids.add(match[2])
  }
  return Array.from(ids)
}

/**
 * Format a mention string for insertion into comment body.
 */
export function formatMention(displayName: string, userId: string): string {
  return `@[${displayName}](${userId})`
}
