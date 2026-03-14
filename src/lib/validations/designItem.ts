import { z } from 'zod'

export const createDesignItemSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  figmaLink: z.string().url().optional().or(z.literal('')),
  assigneeId: z.string().optional(),
  visualDesignerId: z.string().optional(),
  teamId: z.string(),
  startDate: z.string().datetime().optional().or(z.literal('')),
  endDate: z.string().datetime().optional().or(z.literal('')),
})

export const updateDesignItemSchema = createDesignItemSchema.partial().extend({
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional(),
  // Allow null to clear nullable fields
  description: z.string().nullable().optional(),
  figmaLink: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  visualDesignerId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).nullable().optional(),
})

export type CreateDesignItemInput = z.infer<typeof createDesignItemSchema>
export type UpdateDesignItemInput = z.infer<typeof updateDesignItemSchema>
