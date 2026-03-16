'use client'

import { useState, useCallback, useRef } from 'react'
import { getTimeAgo } from '@/lib/utils'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Paperclip, X, Loader2 } from 'lucide-react'
import { MentionTextarea } from './MentionTextarea'
import { AttachmentList, type AttachmentItem } from '@/components/ui/AttachmentList'
import { FileUpload } from '@/components/ui/FileUpload'
import { useAttachments } from '@/hooks/useAttachments'
import { isAllowedMimeType, MAX_FILE_SIZE, formatFileSize, isImageType } from '@/lib/validations/attachment'

interface Comment {
  id: string
  body: string
  createdAt: Date | string
  updatedAt: Date | string
  author: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  attachments?: AttachmentItem[]
}

interface CommentThreadProps {
  issueId: string
  comments: Comment[]
  onAddComment: (body: string) => Promise<{ id: string } | void>
  onEditComment?: (commentId: string, body: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
  /** Called after attachments are uploaded/deleted so parent can refetch */
  onAttachmentChange?: () => void
}

/**
 * Render markdown-like formatting safely without dangerouslySetInnerHTML.
 * Splits text into segments and returns React elements.
 */
function SafeMarkdown({ text }: { text: string }) {
  // Split by newlines first, then render inline formatting
  const lines = text.split('\n')

  return (
    <>
      {lines.map((line, lineIdx) => (
        <span key={lineIdx}>
          {lineIdx > 0 && <br />}
          {renderInlineFormatting(line)}
        </span>
      ))}
    </>
  )
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Match **bold**, *italic*, `code`, and @[Name](userId) mention patterns
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|@\[(.+?)\]\(([\w-]+)\))/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      // **bold**
      parts.push(<strong key={match.index}>{match[2]}</strong>)
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>)
    } else if (match[4]) {
      // `code`
      parts.push(
        <code key={match.index} className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">
          {match[4]}
        </code>
      )
    } else if (match[5] && match[6]) {
      // @[DisplayName](userId) mention
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center rounded bg-blue-100 px-1 py-0.5 text-xs font-medium text-blue-800"
        >
          @{match[5]}
        </span>
      )
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

export function CommentThread({
  issueId,
  comments,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onAttachmentChange,
}: CommentThreadProps) {
  const { data: session } = useSession()
  const { upload, remove } = useAttachments()
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Staged files for new comment (selected before posting)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const valid: File[] = []

    for (const file of files) {
      if (!isAllowedMimeType(file.type)) {
        toast.error(`${file.name} — Only images and documents are allowed`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit`)
        continue
      }
      valid.push(file)
    }

    setPendingFiles((prev) => [...prev, ...valid])
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddComment = async () => {
    if (!newComment.trim() && pendingFiles.length === 0) return

    setIsSubmitting(true)
    try {
      const result = await onAddComment(newComment.trim() || '(attachment)')
      setNewComment('')

      // Upload staged files to the newly created comment
      if (result?.id && pendingFiles.length > 0) {
        let uploadErrors = 0
        for (const file of pendingFiles) {
          try {
            await upload.mutateAsync({
              file,
              entityType: 'comment',
              entityId: result.id,
            })
          } catch {
            uploadErrors++
          }
        }
        if (uploadErrors > 0) {
          toast.error(`${uploadErrors} file(s) failed to upload`)
        }
        // Trigger parent refetch so comment attachments appear immediately
        onAttachmentChange?.()
      }
      setPendingFiles([])
    } catch {
      toast.error('Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim() || !onEditComment) return
    setEditSaving(true)
    try {
      await onEditComment(commentId, editText.trim())
      setEditingId(null)
      setEditText('')
    } catch {
      toast.error('Failed to update comment')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!onDeleteComment) return
    setDeletingId(commentId)
    try {
      await onDeleteComment(commentId)
    } catch {
      toast.error('Failed to delete comment')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await remove.mutateAsync(attachmentId)
      onAttachmentChange?.()
    } catch {
      // Error toast handled by the hook
    }
  }

  const isOwnComment = (comment: Comment) =>
    session?.user.id === comment.author.id

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-4">
            <div className="flex-shrink-0">
              {comment.author.image ? (
                <Image
                  src={comment.author.image}
                  alt={comment.author.name || 'User'}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                  <span className="text-sm font-medium text-gray-600">
                    {(comment.author.name?.[0] || comment.author.email[0]).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-grow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {comment.author.name || comment.author.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getTimeAgo(comment.createdAt)}
                  </p>
                </div>
                {isOwnComment(comment) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(comment.id)
                        setEditText(comment.body)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      disabled={deletingId === comment.id}
                      className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === comment.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>

              {editingId === comment.id ? (
                <div className="mt-2 space-y-2">
                  <MentionTextarea
                    value={editText}
                    onChange={setEditText}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    rows={3}
                  />
                  {/* Attachments in edit mode — can add/remove */}
                  <div className="space-y-2">
                    {comment.attachments && comment.attachments.length > 0 && (
                      <AttachmentList
                        attachments={comment.attachments}
                        onDelete={handleDeleteAttachment}
                        compact
                      />
                    )}
                    <FileUpload
                      entityType="comment"
                      entityId={comment.id}
                      compact
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(comment.id)}
                      disabled={editSaving || !editText.trim()}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      {editSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditText('') }}
                      disabled={editSaving}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <div className="text-sm text-gray-700">
                    <SafeMarkdown text={comment.body} />
                  </div>
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="mt-2">
                      <AttachmentList
                        attachments={comment.attachments}
                        compact
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add comment form */}
      <div className="border-t border-gray-200 pt-4">
        <div className="space-y-3">
          <MentionTextarea
            value={newComment}
            onChange={setNewComment}
            placeholder="Add a comment... (type @ to mention someone)"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={4}
          />

          {/* Staged pending files */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1"
                >
                  {isImageType(file.type) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-6 w-6 rounded object-cover"
                    />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  <span className="max-w-[120px] truncate text-xs text-gray-600">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removePendingFile(index)}
                    className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Attach files to this comment"
              >
                <Paperclip className="h-4 w-4" />
                <span className="text-xs">Attach</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setNewComment(''); setPendingFiles([]) }}
                className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComment}
                disabled={isSubmitting || (!newComment.trim() && pendingFiles.length === 0)}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Posting...
                  </span>
                ) : (
                  `Post comment${pendingFiles.length > 0 ? ` (${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''})` : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
