'use client'

import { FileText, FileSpreadsheet, File, X } from 'lucide-react'
import { formatFileSize, isImageType } from '@/lib/validations/attachment'
import { getAttachmentUrl } from '@/lib/supabase'

export interface AttachmentItem {
  id: string
  filename: string
  storagePath: string
  contentType: string
  size: number
  uploaderId?: string
  createdAt?: string
}

interface AttachmentListProps {
  attachments: AttachmentItem[]
  onDelete?: (id: string) => void
  compact?: boolean
}

function getFileIcon(contentType: string) {
  if (contentType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />
  if (contentType.includes('spreadsheet') || contentType.includes('excel'))
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />
  if (contentType.includes('word') || contentType === 'application/msword')
    return <FileText className="h-5 w-5 text-blue-600" />
  return <File className="h-5 w-5 text-gray-500" />
}

export function AttachmentList({ attachments, onDelete, compact }: AttachmentListProps) {
  if (!attachments || attachments.length === 0) return null

  const images = attachments.filter((a) => isImageType(a.contentType))
  const documents = attachments.filter((a) => !isImageType(a.contentType))

  return (
    <div className="space-y-3">
      {/* Image thumbnails grid */}
      {images.length > 0 && (
        <div className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4'}`}>
          {images.map((img) => {
            const url = getAttachmentUrl(img.storagePath)
            return (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={img.filename}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </a>
                {onDelete && (
                  <button
                    onClick={() => onDelete(img.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => {
            const url = getAttachmentUrl(doc.storagePath)
            return (
              <div
                key={doc.id}
                className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors hover:bg-gray-50"
              >
                {getFileIcon(doc.contentType)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{doc.filename}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Download
                </a>
                {onDelete && (
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
