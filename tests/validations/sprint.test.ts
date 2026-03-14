import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Mirror the actual validation schemas
const createSprintSchema = z
  .object({
    name: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  })

const completeSprintSchema = z.object({
  issueActions: z.array(
    z.object({
      issueId: z.string(),
      action: z.enum(['backlog', 'next_sprint']),
      targetSprintId: z.string().optional(),
    })
  ),
})

describe('Sprint Validation Schema', () => {
  describe('Valid data', () => {
    it('should validate complete sprint data', () => {
      const validData = {
        name: 'Sprint 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
      }

      const result = createSprintSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should accept date strings that coerce to Date', () => {
      const data = {
        name: 'Sprint 1',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should accept timestamps', () => {
      const startTime = Date.now()
      const endTime = startTime + 1209600000 // 14 days later

      const data = {
        name: 'Sprint',
        startDate: startTime,
        endDate: endTime,
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('Name validation', () => {
    it('should reject empty name', () => {
      const data = {
        name: '',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should accept any non-empty name', () => {
      const names = ['Sprint 1', 'Q1 2024', 'January-2024', 'Q1-21', 'S1']

      names.forEach((name) => {
        const data = {
          name,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-14'),
        }

        const result = createSprintSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('should accept special characters in name', () => {
      const data = {
        name: 'Sprint #1 (Q1 2024)',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('Date validation', () => {
    it('should reject endDate before startDate', () => {
      const data = {
        name: 'Invalid Sprint',
        startDate: new Date('2024-01-14'),
        endDate: new Date('2024-01-01'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('after start date')
    })

    it('should reject endDate equal to startDate', () => {
      const sameDate = new Date('2024-01-01')

      const data = {
        name: 'Invalid Sprint',
        startDate: sameDate,
        endDate: sameDate,
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should accept endDate one day after startDate', () => {
      const data = {
        name: 'Short Sprint',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should accept endDate many days after startDate', () => {
      const data = {
        name: 'Long Sprint',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should handle time components in dates', () => {
      const data = {
        name: 'Sprint with times',
        startDate: new Date('2024-01-01T09:00:00Z'),
        endDate: new Date('2024-01-14T17:00:00Z'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('Required fields', () => {
    it('should reject missing name', () => {
      const data = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject missing startDate', () => {
      const data = {
        name: 'Sprint',
        endDate: new Date('2024-01-14'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject missing endDate', () => {
      const data = {
        name: 'Sprint',
        startDate: new Date('2024-01-01'),
      }

      const result = createSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })
})

describe('Complete Sprint Schema', () => {
  describe('Valid data', () => {
    it('should validate complete sprint with backlog actions', () => {
      const data = {
        issueActions: [
          {
            issueId: 'issue-1',
            action: 'backlog',
          },
          {
            issueId: 'issue-2',
            action: 'backlog',
          },
        ],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should validate complete sprint with next_sprint actions', () => {
      const data = {
        issueActions: [
          {
            issueId: 'issue-1',
            action: 'next_sprint',
            targetSprintId: 'sprint-2',
          },
          {
            issueId: 'issue-2',
            action: 'next_sprint',
            targetSprintId: 'sprint-2',
          },
        ],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should validate mixed backlog and next_sprint actions', () => {
      const data = {
        issueActions: [
          {
            issueId: 'issue-1',
            action: 'backlog',
          },
          {
            issueId: 'issue-2',
            action: 'next_sprint',
            targetSprintId: 'sprint-2',
          },
          {
            issueId: 'issue-3',
            action: 'backlog',
          },
        ],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should accept empty issue actions array', () => {
      const data = {
        issueActions: [],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('Action validation', () => {
    it('should reject invalid action type', () => {
      const data = {
        issueActions: [
          {
            issueId: 'issue-1',
            action: 'ignore',
          },
        ],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should require issueId', () => {
      const data = {
        issueActions: [
          {
            action: 'backlog',
          },
        ],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should require action', () => {
      const data = {
        issueActions: [
          {
            issueId: 'issue-1',
          },
        ],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should make targetSprintId optional for backlog action', () => {
      const data = {
        issueActions: [
          {
            issueId: 'issue-1',
            action: 'backlog',
          },
        ],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should allow targetSprintId for next_sprint action', () => {
      const data = {
        issueActions: [
          {
            issueId: 'issue-1',
            action: 'next_sprint',
            targetSprintId: 'sprint-2',
          },
        ],
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('Complex scenarios', () => {
    it('should handle large number of actions', () => {
      const actions = Array.from({ length: 100 }, (_, i) => ({
        issueId: `issue-${i}`,
        action: i % 2 === 0 ? ('backlog' as const) : ('next_sprint' as const),
        targetSprintId: i % 2 === 0 ? undefined : 'sprint-2',
      }))

      const data = {
        issueActions: actions,
      }

      const result = completeSprintSchema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data?.issueActions.length).toBe(100)
    })
  })
})
