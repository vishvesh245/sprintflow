import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Mirror the actual validation schema
const createIssueSchema = z.object({
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

describe('Issue Validation Schema', () => {
  describe('Valid data', () => {
    it('should validate complete issue data', () => {
      const validData = {
        title: 'Create user registration form',
        description: 'User-friendly form for sign-ups',
        type: 'STORY',
        priority: 'HIGH',
        teamId: 'team-1',
        sprintId: 'sprint-1',
        epicId: 'epic-1',
        assigneeId: 'user-1',
        labels: ['frontend', 'priority'],
        storyPoints: 8,
      }

      const result = createIssueSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should validate minimal issue data', () => {
      const minimalData = {
        title: 'Fix button',
        type: 'BUG',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(minimalData)
      expect(result.success).toBe(true)
    })

    it('should allow optional fields to be undefined', () => {
      const dataWithoutOptionals = {
        title: 'My Task',
        type: 'TASK',
        priority: 'LOW',
        teamId: 'team-1',
        description: undefined,
        sprintId: undefined,
        epicId: undefined,
        assigneeId: undefined,
        labels: undefined,
        storyPoints: undefined,
      }

      const result = createIssueSchema.safeParse(dataWithoutOptionals)
      expect(result.success).toBe(true)
    })
  })

  describe('Title validation', () => {
    it('should reject title shorter than 3 characters', () => {
      const data = {
        title: 'AB',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('String must contain at least 3')
    })

    it('should reject empty title', () => {
      const data = {
        title: '',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should accept 3-character title', () => {
      const data = {
        title: 'Fix',
        type: 'BUG',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should reject title longer than 255 characters', () => {
      const longTitle = 'A'.repeat(256)
      const data = {
        title: longTitle,
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('255')
    })

    it('should accept 255-character title', () => {
      const maxTitle = 'A'.repeat(255)
      const data = {
        title: maxTitle,
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should accept title with special characters', () => {
      const data = {
        title: 'Fix @#$% bug in user-login (123)',
        type: 'BUG',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('Type validation', () => {
    it('should accept all valid issue types', () => {
      const types = ['STORY', 'TASK', 'BUG', 'SUBTASK']

      types.forEach((type) => {
        const data = {
          title: 'Sample issue',
          type: type as any,
          priority: 'MEDIUM',
          teamId: 'team-1',
        }

        const result = createIssueSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid issue type', () => {
      const data = {
        title: 'Sample issue',
        type: 'EPIC',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('Priority validation', () => {
    it('should accept all valid priorities', () => {
      const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

      priorities.forEach((priority) => {
        const data = {
          title: 'Sample issue',
          type: 'TASK',
          priority: priority as any,
          teamId: 'team-1',
        }

        const result = createIssueSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid priority', () => {
      const data = {
        title: 'Sample issue',
        type: 'TASK',
        priority: 'URGENT',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('Story Points validation', () => {
    it('should accept positive integers', () => {
      const data = {
        title: 'Sample issue',
        type: 'STORY',
        priority: 'MEDIUM',
        teamId: 'team-1',
        storyPoints: 8,
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should reject zero', () => {
      const data = {
        title: 'Sample issue',
        type: 'STORY',
        priority: 'MEDIUM',
        teamId: 'team-1',
        storyPoints: 0,
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject negative numbers', () => {
      const data = {
        title: 'Sample issue',
        type: 'STORY',
        priority: 'MEDIUM',
        teamId: 'team-1',
        storyPoints: -5,
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject floats', () => {
      const data = {
        title: 'Sample issue',
        type: 'STORY',
        priority: 'MEDIUM',
        teamId: 'team-1',
        storyPoints: 5.5,
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('Labels validation', () => {
    it('should accept array of labels', () => {
      const data = {
        title: 'Sample issue',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
        labels: ['frontend', 'urgent', 'bug-fix'],
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should accept empty array', () => {
      const data = {
        title: 'Sample issue',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
        labels: [],
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should reject non-string labels', () => {
      const data = {
        title: 'Sample issue',
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
        labels: ['valid', 123, true],
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('Required fields', () => {
    it('should reject missing title', () => {
      const data = {
        type: 'TASK',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject missing type', () => {
      const data = {
        title: 'Sample',
        priority: 'MEDIUM',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject missing priority', () => {
      const data = {
        title: 'Sample',
        type: 'TASK',
        teamId: 'team-1',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject missing teamId', () => {
      const data = {
        title: 'Sample',
        type: 'TASK',
        priority: 'MEDIUM',
      }

      const result = createIssueSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })
})
