/**
 * Run this from the project root to delete backlog issues from the database:
 *   node scripts/cleanup-issues.mjs
 *
 * This will delete ALL issues (backlog + any sprint issues).
 * Issues have cascading deletes for comments, notifications, and links.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Count what exists
  const total = await prisma.issue.count()
  const backlog = await prisma.issue.count({ where: { sprintId: null } })
  const inSprint = await prisma.issue.count({ where: { sprintId: { not: null } } })

  console.log(`Found ${total} issue(s): ${backlog} in backlog, ${inSprint} in sprints.`)

  if (total === 0) {
    console.log('Nothing to clean up.')
    return
  }

  // 2. Delete all issues (cascades to comments, notifications, links)
  const deleted = await prisma.issue.deleteMany({})
  console.log(`Deleted ${deleted.count} issue(s). Backlog is now empty.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
