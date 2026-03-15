import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface Attachment {
  id: string
  filename: string
  storagePath: string
  contentType: string
  size: number
  uploaderId: string
  createdAt: string
  url: string
}

export function useAttachments() {
  const queryClient = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      entityType,
      entityId,
    }: {
      file: File
      entityType: 'issue' | 'designItem' | 'comment'
      entityId: string
    }): Promise<Attachment> => {
      const formData = new FormData()
      formData.append('file', file)

      const key = entityType === 'issue' ? 'issueId' : entityType === 'designItem' ? 'designItemId' : 'commentId'
      formData.append(key, entityId)

      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      return res.json()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
    onSuccess: () => {
      // Invalidate relevant queries so the UI refreshes
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: ['issue'] })
      queryClient.invalidateQueries({ queryKey: ['design-item'] })
      queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Delete failed')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: ['issue'] })
      queryClient.invalidateQueries({ queryKey: ['design-item'] })
      queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
  })

  return {
    upload: uploadMutation,
    remove: deleteMutation,
  }
}
