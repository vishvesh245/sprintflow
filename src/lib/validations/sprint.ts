import { z } from 'zod'

// Base schema (ZodObject) — supports .partial() for update schemas
const sprintBaseSchema = z.object({
  name: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED']).optional(),
})

// Create schema adds the endDate > startDate refinement
export const createSprintSchema = sprintBaseSchema.refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
)

// Update schema is partial on the base object (not on ZodEffects — ZodEffects has no .partial())
export const updateSprintSchema = sprintBaseSchema.partial()

export const completeSprintSchema = z.object({
  issueActions: z.array(
    z.object({
      issueId: z.string(),
      action: z.enum(['backlog', 'next_sprint']),
      targetSprintId: z.string().optional(),
    })
  ).optional().default([]),
})

export type CreateSprintInput = z.infer<typeof createSprintSchema>
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>
export type CompleteSprintInput = z.infer<typeof completeSprintSchema>
