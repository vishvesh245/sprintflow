import { PrismaClient, NotificationType } from '@prisma/client'

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  message: string
  issueId?: string
}

export async function createNotification(
  prisma: PrismaClient,
  { userId, type, message, issueId }: CreateNotificationInput
) {
  return await prisma.notification.create({
    data: {
      userId,
      type,
      message,
      issueId,
    },
  })
}
