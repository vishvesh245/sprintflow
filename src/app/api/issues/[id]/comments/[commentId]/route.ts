export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidatePrefix } from '@/lib/cache'
import { z } from 'zod'

const updateCommentSchema = z.object({
  body: z.string().min(1, 'Comment body cannot be empty'),
})

/**
 * PATCH /api/issues/[id]/comments/[commentId] — Edit a comment
 * Only the comment author can edit.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Only author can edit
    if (comment.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { body: newBody } = updateCommentSchema.parse(body)

    const updated = await prisma.comment.update({
      where: { id: params.commentId },
      data: { body: newBody },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
        attachments: {
          select: { id: true, filename: true, storagePath: true, contentType: true, size: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    // Invalidate issue cache so the comment change shows up
    invalidatePrefix(`issue:${params.id}`)

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Failed to update comment:', error)
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }
}

/**
 * DELETE /api/issues/[id]/comments/[commentId] — Delete a comment
 * Only the comment author or an ADMIN can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Only author or admin can delete
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (comment.authorId !== session.user.id && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete attachments from storage first (best-effort)
    const attachments = await prisma.attachment.findMany({
      where: { commentId: params.commentId },
      select: { id: true, storagePath: true },
    })

    if (attachments.length > 0) {
      try {
        const { getSupabaseAdmin, ATTACHMENT_BUCKET } = await import('@/lib/supabase')
        await getSupabaseAdmin()
          .storage.from(ATTACHMENT_BUCKET)
          .remove(attachments.map((a) => a.storagePath))
      } catch {
        // Best-effort cleanup
      }

      // Delete attachment DB records
      await prisma.attachment.deleteMany({
        where: { commentId: params.commentId },
      })
    }

    // Delete the comment
    await prisma.comment.delete({ where: { id: params.commentId } })

    // Invalidate issue cache
    invalidatePrefix(`issue:${params.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete comment:', error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
