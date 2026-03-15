export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/utils/notifications'
import { parseMentionedUserIds } from '@/lib/utils/mentions'
import { z } from 'zod'

const createCommentSchema = z.object({
  body: z.string().min(1, 'Comment body cannot be empty'),
})

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

    const comments = await prisma.comment.findMany({
      where: { issueId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Failed to fetch comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
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

    const issueId = params.id
    const body = await request.json()

    // Validate request body
    const validatedData = createCommentSchema.parse(body)

    // Check if issue exists
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        title: true,
        reporterId: true,
        assigneeId: true,
      },
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        issueId,
        authorId: session.user.id,
        body: validatedData.body,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    // Create notifications for issue reporter and assignee (if different from comment author)
    const notificationUserIds = new Set<string>()

    if (
      issue.reporterId !== session.user.id &&
      !notificationUserIds.has(issue.reporterId)
    ) {
      notificationUserIds.add(issue.reporterId)
    }

    if (
      issue.assigneeId &&
      issue.assigneeId !== session.user.id &&
      !notificationUserIds.has(issue.assigneeId)
    ) {
      notificationUserIds.add(issue.assigneeId)
    }

    // Create notifications for each user
    for (const userId of notificationUserIds) {
      await createNotification(prisma, {
        userId,
        type: 'COMMENT_ADDED',
        message: `${session.user.name || session.user.email} added a comment`,
        issueId,
      })
    }

    // Parse @mentions and send notifications to mentioned users
    const mentionedUserIds = parseMentionedUserIds(validatedData.body)
    // Remove self-mentions and users already notified as reporter/assignee
    const newMentionIds = mentionedUserIds.filter(
      (id) => id !== session.user.id && !notificationUserIds.has(id)
    )

    if (newMentionIds.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: newMentionIds },
          notifyOnComment: true,
        },
        select: { id: true },
      })

      const authorName = session.user.name || session.user.email
      for (const user of mentionedUsers) {
        await createNotification(prisma, {
          userId: user.id,
          type: 'COMMENT_ADDED',
          message: `${authorName} mentioned you in a comment on "${issue.title}"`,
          issueId,
        })
      }
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Failed to create comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}
