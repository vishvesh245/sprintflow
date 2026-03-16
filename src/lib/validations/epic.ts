import { z } from 'zod'

export const createEpicSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetSprintId: z.string().optional(),
})

export const updateEpicSchema = createEpicSchema.partial().extend({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
})

export type CreateEpicInput = z.infer<typeof createEpicSchema>
export type UpdateEpicInput = z.infer<typeof updateEpicSchema>
