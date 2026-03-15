export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, ATTACHMENT_BUCKET, getAttachmentUrl } from '@/lib/supabase'
import { isAllowedMimeType, MAX_FILE_SIZE } from '@/lib/validations/attachment'

/**
 * POST /api/attachments — Upload a file attachment
 * Accepts multipart/form-data with a `file` field and one of: issueId, designItemId, commentId
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const issueId = formData.get('issueId') as string | null
    const designItemId = formData.get('designItemId') as string | null
    const commentId = formData.get('commentId') as string | null

    // Validate file exists
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate exactly one parent entity
    const parentCount = [issueId, designItemId, commentId].filter(Boolean).length
    if (parentCount !== 1) {
      return NextResponse.json(
        { error: 'Exactly one of issueId, designItemId, or commentId must be provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not supported. Only images and documents are allowed.` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
        { status: 400 }
      )
    }

    // Verify parent entity exists
    if (issueId) {
      const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true } })
      if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    } else if (designItemId) {
      const item = await prisma.designItem.findUnique({ where: { id: designItemId }, select: { id: true } })
      if (!item) return NextResponse.json({ error: 'Design item not found' }, { status: 404 })
    } else if (commentId) {
      const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } })
      if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Build storage path
    const entityType = issueId ? 'issues' : designItemId ? 'design-items' : 'comments'
    const entityId = (issueId || designItemId || commentId)!
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${entityType}/${entityId}/${Date.now()}-${sanitizedName}`

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await getSupabaseAdmin().storage
      .from(ATTACHMENT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Create DB record — if this fails, clean up the uploaded file
    let attachment
    try {
      attachment = await prisma.attachment.create({
        data: {
          filename: file.name,
          storagePath,
          contentType: file.type,
          size: file.size,
          uploaderId: session.user.id,
          ...(issueId && { issueId }),
          ...(designItemId && { designItemId }),
          ...(commentId && { commentId }),
        },
      })
    } catch (dbError) {
      // Clean up orphaned file from storage
      await getSupabaseAdmin().storage
        .from(ATTACHMENT_BUCKET)
        .remove([storagePath])
        .catch(() => {}) // best-effort cleanup
      throw dbError
    }

    return NextResponse.json(
      {
        ...attachment,
        url: getAttachmentUrl(storagePath),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to upload attachment:', error)
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 })
  }
}
