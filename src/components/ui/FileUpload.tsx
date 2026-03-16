'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Paperclip, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAttachments } from '@/hooks/useAttachments'
import { AttachmentList, type AttachmentItem } from './AttachmentList'
import {
  DROPZONE_ACCEPT,
  MAX_FILE_SIZE,
  formatFileSize,
  isImageType,
} from '@/lib/validations/attachment'

interface FileUploadProps {
  entityType: 'issue' | 'designItem' | 'comment'
  entityId: string
  existingAttachments?: AttachmentItem[]
  onUploadComplete?: () => void
  compact?: boolean
}

interface UploadingFile {
  id: string
  file: File
  preview?: string
}

export function FileUpload({
  entityType,
  entityId,
  existingAttachments = [],
  onUploadComplete,
  compact = false,
}: FileUploadProps) {
  const { upload, remove } = useAttachments()
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newUploading = acceptedFiles.map((file) => ({
        id: `${Date.now()}-${file.name}`,
        file,
        preview: isImageType(file.type) ? URL.createObjectURL(file) : undefined,
      }))

      setUploadingFiles((prev) => [...prev, ...newUploading])

      let successCount = 0
      for (const item of newUploading) {
        try {
          await upload.mutateAsync({
            file: item.file,
            entityType,
            entityId,
          })
          successCount++
        } catch {
          // Error toast handled by the hook
        } finally {
          setUploadingFiles((prev) => prev.filter((f) => f.id !== item.id))
          if (item.preview) URL.revokeObjectURL(item.preview)
        }
      }

      if (successCount > 0) onUploadComplete?.()
    },
    [entityType, entityId, upload, onUploadComplete]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: DROPZONE_ACCEPT,
    maxSize: MAX_FILE_SIZE,
    onDropRejected: (rejections) => {
      for (const rejection of rejections) {
        const error = rejection.errors[0]
        if (error.code === 'file-too-large') {
          toast.error(`${rejection.file.name} exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit`)
        } else if (error.code === 'file-invalid-type') {
          toast.error(`${rejection.file.name} — Only images and documents are allowed`)
        } else {
          toast.error(`${rejection.file.name} — ${error.message}`)
        }
      }
    },
  })

  const handleDelete = async (attachmentId: string) => {
    try {
      await remove.mutateAsync(attachmentId)
    } catch {
      // Error toast handled by the hook
    }
  }

  // Compact mode: just a paperclip button (for comments)
  if (compact) {
    return (
      <div>
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            title="Attach files"
          >
            <Paperclip className="h-4 w-4" />
            <span className="text-xs">Attach</span>
          </button>
        </div>

        {/* Uploading indicators */}
        {uploadingFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {uploadingFiles.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="max-w-[120px] truncate">{item.file.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Full mode: dropzone + existing attachments
  return (
    <div className="space-y-2">
      {/* Existing attachments with delete */}
      <AttachmentList
        attachments={existingAttachments}
        onDelete={handleDelete}
      />

      {/* Uploading files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-1">
          {uploadingFiles.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              <span className="min-w-0 flex-1 truncate text-xs text-gray-600">{item.file.name}</span>
              <span className="text-[10px] text-gray-400">{formatFileSize(item.file.size)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Dropzone — compact */}
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-md border-2 border-dashed px-4 py-3 text-center transition-colors ${
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-1 h-5 w-5 text-gray-400" />
        <p className="text-xs text-gray-600">
          <span className="font-medium text-blue-600">Drop files</span> or click to browse
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          Images &amp; Documents &middot; Max {formatFileSize(MAX_FILE_SIZE)}
        </p>
      </div>
    </div>
  )
}
