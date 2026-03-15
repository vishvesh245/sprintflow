export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Issue Links API — stubbed out.
 *
 * The IssueLink model has not been added to the Prisma schema yet.
 * Once the migration is run, replace these stubs with the full
 * implementation (see git history for the original code).
 *
 * TODO: Add IssueLink model + IssueLinkType enum to schema.prisma,
 *       run prisma migrate, then restore the full route handlers.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // IssueLink model not yet in schema — return empty array
  return NextResponse.json([])
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(
    { error: 'Issue linking is not available yet. The IssueLink model needs to be added to the database schema.' },
    { status: 501 }
  )
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(
    { error: 'Issue linking is not available yet. The IssueLink model needs to be added to the database schema.' },
    { status: 501 }
  )
}
