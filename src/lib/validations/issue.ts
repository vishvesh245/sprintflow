import { z } from 'zod'

export const createIssueSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  type: z.enum(['STORY', 'TASK', 'BUG', 'SUBTASK']),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  teamId: z.string(),
  sprintId: z.string().optional(),
  epicId: z.string().optional(),
  assigneeId: z.string().optional(),
  labels: z.array(z.string()).optional(),
  storyPoints: z.number().int().positive().optional(),
  parentIssueId: z.string().optional(),
})

// Update schema includes all create fields plus status (which is settable via PATCH).
// Nullable overrides allow clearing optional foreign keys and optional text fields.
export const updateIssueSchema = createIssueSchema.partial().extend({
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'READY_FOR_QA', 'IN_REVIEW', 'BLOCKED', 'DONE']).optional(),
  position: z.number().int().optional(),
  // Allow null to clear these nullable DB columns
  description: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  epicId: z.string().nullable().optional(),
  storyPoints: z.number().int().positive().nullable().optional(),
})

export type CreateIssueInput = z.infer<typeof createIssueSchema>
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>
