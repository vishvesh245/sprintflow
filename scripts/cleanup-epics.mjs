/**
 * Run this from the project root to delete all epics from the database:
 *   node scripts/cleanup-epics.mjs
 *
 * This will:
 *   1. Show all current epics
 *   2. Unlink any issues that reference those epics (set epicId = null)
 *   3. Delete all epics
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. List current epics
  const epics = await prisma.epic.findMany({
    select: { id: true, title: true, status: true, _count: { select: { issues: true } } },
    orderBy: { createdAt: 'asc' },
  })

  if (epics.length === 0) {
    console.log('No epics found — nothing to clean up.')
    return
  }

  console.log(`Found ${epics.length} epic(s):`)
  epics.forEach((e) =>
    console.log(`  • [${e.status}] ${e.title}  (${e._count.issues} issues linked)`)
  )

  // 2. Unlink all issues from epics
  const unlinked = await prisma.issue.updateMany({
    where: { epicId: { not: null } },
    data: { epicId: null },
  })
  console.log(`\nUnlinked ${unlinked.count} issue(s) from epics.`)

  // 3. Delete all epics
  const deleted = await prisma.epic.deleteMany({})
  console.log(`Deleted ${deleted.count} epic(s). Database is clean.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
