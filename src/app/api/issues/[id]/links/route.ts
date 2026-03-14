export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { IssueLinkType } from '@prisma/client'
import { z } from 'zod'

const VALID_LINK_TYPES: IssueLinkType[] = [
  'BLOCKS',
  'BLOCKED_BY',
  'RELATES_TO',
  'DUPLICATES',
  'TESTS',
  'TESTED_BY',
]

const LINK_TYPE_INVERSE: Record<IssueLinkType, IssueLinkType> = {
  BLOCKS: 'BLOCKED_BY',
  BLOCKED_BY: 'BLOCKS',
  RELATES_TO: 'RELATES_TO',
  DUPLICATES: 'DUPLICATES',
  TESTS: 'TESTED_BY',
  TESTED_BY: 'TESTS',
}

const createLinkSchema = z.object({
  targetIssueId: z.string().min(1, 'Target issue ID is required'),
  linkType: z.enum([
    'BLOCKS',
    'BLOCKED_BY',
    'RELATES_TO',
    'DUPLICATES',
    'TESTS',
    'TESTED_BY',
  ] as const),
})

async function detectCircularDependency(
  sourceIssueId: string,
  targetIssueId: string
): Promise<boolean> {
  // BFS to detect circular dependency for BLOCKS links
  const visited = new Set<string>()
  const queue: string[] = [targetIssueId]

  while (queue.length > 0) {
    const currentId = queue.shift()!

    if (currentId === sourceIssueId) {
      return true // Circular dependency detected
    }

    if (visited.has(currentId)) {
      continue
    }

    visited.add(currentId)

    // Find all issues that the current issue blocks
    const blockedIssueLinks = await prisma.issueLink.findMany({
      where: {
        sourceIssueId: currentId,
        linkType: 'BLOCKS',
      },
      select: {
        targetIssueId: true,
      },
    })

    for (const link of blockedIssueLinks) {
      queue.push(link.targetIssueId)
    }
  }

  return false
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const issueId = params.id

    // Fetch both source and target links
    const [sourceLinks, targetLinks] = await Promise.all([
      prisma.issueLink.findMany({
        where: { sourceIssueId: issueId },
        include: {
          targetIssue: {
            select: {
              id: true,
              displayId: true,
              title: true,
              status: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  prefix: true,
                },
              },
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
      prisma.issueLink.findMany({
        where: { targetIssueId: issueId },
        include: {
          sourceIssue: {
            select: {
              id: true,
              displayId: true,
              title: true,
              status: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  prefix: true,
                },
              },
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
    ])

    // Format response to include all links with linked issue details
    const allLinks = [
      ...sourceLinks.map((link) => ({
        id: link.id,
        sourceIssueId: link.sourceIssueId,
        targetIssueId: link.targetIssueId,
        linkType: link.linkType,
        createdAt: link.createdAt,
        linkedIssue: link.targetIssue,
      })),
      ...targetLinks.map((link) => ({
        id: link.id,
        sourceIssueId: link.sourceIssueId,
        targetIssueId: link.targetIssueId,
        linkType: link.linkType,
        createdAt: link.createdAt,
        linkedIssue: link.sourceIssue,
      })),
    ]

    return NextResponse.json(allLinks)
  } catch (error) {
    console.error('Failed to fetch links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sourceIssueId = params.id
    const body = await request.json()

    // Validate request body
    const validatedData = createLinkSchema.parse(body)
    const { targetIssueId, linkType } = validatedData

    // Check if source issue exists
    const sourceIssue = await prisma.issue.findUnique({ where: { id: sourceIssueId } })
    if (!sourceIssue) {
      return NextResponse.json(
        { error: 'Source issue not found' },
        { status: 404 }
      )
    }

    // Resolve target issue by UUID first, then fall back to displayId (e.g. "FE-5")
    let targetIssue = await prisma.issue.findUnique({ where: { id: targetIssueId } })
    if (!targetIssue) {
      targetIssue = await prisma.issue.findFirst({
        where: { displayId: targetIssueId, deletedAt: null },
      })
    }

    if (!targetIssue) {
      return NextResponse.json(
        { error: `Issue "${targetIssueId}" not found. Use the issue UUID or display ID (e.g. FE-5).` },
        { status: 404 }
      )
    }

    // Use the resolved UUID from here on
    const resolvedTargetId = targetIssue.id

    // Prevent self-linking
    if (sourceIssueId === resolvedTargetId) {
      return NextResponse.json(
        { error: 'An issue cannot be linked to itself' },
        { status: 400 }
      )
    }

    // Check for duplicate link
    const existingLink = await prisma.issueLink.findFirst({
      where: {
        sourceIssueId,
        targetIssueId: resolvedTargetId,
        linkType: linkType as IssueLinkType,
      },
    })
    if (existingLink) {
      return NextResponse.json(
        { error: 'This link already exists' },
        { status: 409 }
      )
    }

    // Check for circular dependency for BLOCKS links
    if (linkType === 'BLOCKS') {
      const hasCircular = await detectCircularDependency(
        sourceIssueId,
        resolvedTargetId
      )
      if (hasCircular) {
        return NextResponse.json(
          { error: 'Creating this link would cause a circular dependency' },
          { status: 422 }
        )
      }
    }

    // Determine inverse link type
    const inverseLinkType = LINK_TYPE_INVERSE[linkType as IssueLinkType]

    // Create the primary link
    const createdLink = await prisma.issueLink.create({
      data: {
        sourceIssueId,
        targetIssueId: resolvedTargetId,
        linkType: linkType as IssueLinkType,
      },
    })

    // Create the inverse link based on link type
    if (linkType === 'BLOCKS') {
      await prisma.issueLink.create({
        data: {
          sourceIssueId: resolvedTargetId,
          targetIssueId: sourceIssueId,
          linkType: 'BLOCKED_BY',
        },
      })
    } else if (linkType === 'BLOCKED_BY') {
      await prisma.issueLink.create({
        data: {
          sourceIssueId: resolvedTargetId,
          targetIssueId: sourceIssueId,
          linkType: 'BLOCKS',
        },
      })
    } else if (linkType === 'TESTS') {
      await prisma.issueLink.create({
        data: {
          sourceIssueId: resolvedTargetId,
          targetIssueId: sourceIssueId,
          linkType: 'TESTED_BY',
        },
      })
    } else if (linkType === 'TESTED_BY') {
      await prisma.issueLink.create({
        data: {
          sourceIssueId: resolvedTargetId,
          targetIssueId: sourceIssueId,
          linkType: 'TESTS',
        },
      })
    } else if (linkType === 'RELATES_TO' || linkType === 'DUPLICATES') {
      await prisma.issueLink.create({
        data: {
          sourceIssueId: resolvedTargetId,
          targetIssueId: sourceIssueId,
          linkType: linkType as IssueLinkType,
        },
      })
    }

    // Fetch created links with full details
    const [sourceLink, inverseLink] = await Promise.all([
      prisma.issueLink.findUnique({
        where: { id: createdLink.id },
        include: {
          targetIssue: {
            select: {
              id: true,
              displayId: true,
              title: true,
              status: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  prefix: true,
                },
              },
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
      prisma.issueLink.findFirst({
        where: {
          sourceIssueId: resolvedTargetId,
          targetIssueId: sourceIssueId,
          linkType: inverseLinkType,
        },
        include: {
          targetIssue: {
            select: {
              id: true,
              displayId: true,
              title: true,
              status: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  prefix: true,
                },
              },
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
    ])

    return NextResponse.json(
      [sourceLink, inverseLink].filter(Boolean),
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    // Handle unique constraint error
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint failed')
    ) {
      return NextResponse.json(
        { error: 'This link already exists' },
        { status: 409 }
      )
    }

    console.error('Failed to create link:', error)
    return NextResponse.json(
      { error: 'Failed to create link' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get('linkId')

    if (!linkId) {
      return NextResponse.json(
        { error: 'linkId query parameter is required' },
        { status: 400 }
      )
    }

    // Fetch the link to find its inverse
    const link = await prisma.issueLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    const inverseLinkType =
      LINK_TYPE_INVERSE[link.linkType as IssueLinkType]

    // Delete the inverse link
    await prisma.issueLink.deleteMany({
      where: {
        sourceIssueId: link.targetIssueId,
        targetIssueId: link.sourceIssueId,
        linkType: inverseLinkType,
      },
    })

    // Delete the primary link
    await prisma.issueLink.delete({
      where: { id: linkId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete link:', error)
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    )
  }
}
