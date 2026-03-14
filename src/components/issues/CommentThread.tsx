'use client'

import { useState } from 'react'
import { getTimeAgo } from '@/lib/utils'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

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
}

interface CommentThreadProps {
  issueId: string
  comments: Comment[]
  onAddComment: (body: string) => Promise<void>
  onEditComment?: (commentId: string, body: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
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
  // Match **bold**, *italic*, and `code` patterns
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
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
}: CommentThreadProps) {
  const { data: session } = useSession()
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setIsSubmitting(true)
    try {
      await onAddComment(newComment)
      setNewComment('')
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

  const handleDelete = async (commentId: string) => {
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
                {session?.user.id === comment.author.id && (
                  <div className="flex gap-2">
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
                      onClick={() => handleDelete(comment.id)}
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
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    rows={3}
                  />
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
                <div className="mt-2 text-sm text-gray-700">
                  <SafeMarkdown text={comment.body} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add comment form */}
      <div className="border-t border-gray-200 pt-4">
        <div className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setNewComment('')}
              className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddComment}
              disabled={isSubmitting || !newComment.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
