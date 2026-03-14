import { z } from 'zod'

export const createDesignTodoSchema = z.object({
  text: z.string().min(1).max(500),
})

export const updateDesignTodoSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

export type CreateDesignTodoInput = z.infer<typeof createDesignTodoSchema>
export type UpdateDesignTodoInput = z.infer<typeof updateDesignTodoSchema>
