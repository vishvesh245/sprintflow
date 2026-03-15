export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, ATTACHMENT_BUCKET } from '@/lib/supabase'

/**
 * DELETE /api/attachments/[id] — Delete an attachment
 * Only the uploader or an ADMIN can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: params.id },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Authorization: only uploader or admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (attachment.uploaderId !== session.user.id && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await getSupabaseAdmin().storage
      .from(ATTACHMENT_BUCKET)
      .remove([attachment.storagePath])

    if (deleteError) {
      console.error('Supabase delete error:', deleteError)
      // Continue with DB deletion even if storage delete fails
    }

    // Delete DB record
    await prisma.attachment.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete attachment:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}
