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

function getFileIcon(contentType: string, small?: boolean) {
  const cls = small ? 'h-4 w-4' : 'h-4 w-4'
  if (contentType === 'application/pdf') return <FileText className={`${cls} text-red-500`} />
  if (contentType.includes('spreadsheet') || contentType.includes('excel'))
    return <FileSpreadsheet className={`${cls} text-green-600`} />
  if (contentType.includes('word') || contentType === 'application/msword')
    return <FileText className={`${cls} text-blue-600`} />
  return <File className={`${cls} text-gray-500`} />
}

export function AttachmentList({ attachments, onDelete, compact }: AttachmentListProps) {
  if (!attachments || attachments.length === 0) return null

  const images = attachments.filter((a) => isImageType(a.contentType))
  const documents = attachments.filter((a) => !isImageType(a.contentType))

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {/* Image thumbnails — compact grid with smaller aspect ratio */}
      {images.length > 0 && (
        <div className={`grid gap-1.5 ${compact ? 'grid-cols-5' : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6'}`}>
          {images.map((img) => {
            const url = getAttachmentUrl(img.storagePath)
            return (
              <div
                key={img.id}
                className="group relative aspect-[4/3] overflow-hidden rounded-md border border-gray-200"
              >
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
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Document list — slimmer rows */}
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc) => {
            const url = getAttachmentUrl(doc.storagePath)
            return (
              <div
                key={doc.id}
                className="group flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 transition-colors hover:bg-gray-50"
              >
                {getFileIcon(doc.contentType)}
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800">
                  {doc.filename}
                </span>
                <span className="shrink-0 text-[10px] text-gray-400">
                  {formatFileSize(doc.size)}
                </span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-medium text-blue-600 hover:text-blue-700"
                >
                  Open
                </a>
                {onDelete && (
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
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
