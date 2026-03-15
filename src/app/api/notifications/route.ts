export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const markNotificationsSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAllRead: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Build where clause
    const whereClause: any = {
      userId: session.user.id,
    }

    if (unreadOnly) {
      whereClause.read = false
    }

    // Fetch notifications (capped at 50 to prevent unbounded payloads)
    const notifications = await prisma.notification.findMany({
      where: whereClause,
      include: {
        issue: {
          select: {
            id: true,
            displayId: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(notifications)
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate request body
    const validatedData = markNotificationsSchema.parse(body)

    if (validatedData.markAllRead) {
      // Mark all notifications as read for the user
      await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          read: false,
        },
        data: {
          read: true,
        },
      })

      return NextResponse.json({ success: true })
    }

    if (validatedData.notificationIds && validatedData.notificationIds.length > 0) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: {
            in: validatedData.notificationIds,
          },
          userId: session.user.id,
        },
        data: {
          read: true,
        },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Either notificationIds or markAllRead must be provided' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Failed to update notifications:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
