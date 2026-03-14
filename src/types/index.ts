import { Prisma } from '@prisma/client'
import { Session } from 'next-auth'

// Re-export Prisma types
export type { User, Team, Sprint, Issue, Epic, Notification } from '@prisma/client'

// Issue includes with relations
export const issueWithRelationsInclude = {
  assignee: true,
  epic: true,
  sprint: true,
  team: true,
  parentIssue: true,
  subtasks: true,
  comments: true,
} as const

export type IssueWithRelations = Prisma.IssueGetPayload<{
  include: typeof issueWithRelationsInclude
}>

// Sprint with issues
export const sprintWithIssuesInclude = {
  issues: {
    include: issueWithRelationsInclude,
  },
  team: true,
} as const

export type SprintWithIssues = Prisma.SprintGetPayload<{
  include: typeof sprintWithIssuesInclude
}>

// Epic with issues
export const epicWithIssuesInclude = {
  issues: {
    include: issueWithRelationsInclude,
  },
  team: true,
} as const

export type EpicWithIssues = Prisma.EpicGetPayload<{
  include: typeof epicWithIssuesInclude
}>

// Issue status enum for UI
export const ISSUE_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'READY_FOR_QA', 'IN_REVIEW', 'BLOCKED', 'DONE'] as const
export type IssueStatus = (typeof ISSUE_STATUSES)[number]

// Issue priority enum for UI
export const ISSUE_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number]

// Issue type enum for UI
export const ISSUE_TYPES = ['STORY', 'TASK', 'BUG', 'SUBTASK'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

// Team colors
export const TEAM_COLORS: Record<string, string> = {
  blue: '#3B82F6',
  purple: '#A855F7',
  pink: '#EC4899',
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
  indigo: '#6366F1',
  cyan: '#06B6D4',
}

// Extend next-auth Session type
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      teamId: string | null
      role: 'ADMIN' | 'MEMBER'
      email: string
      name: string | null
      image: string | null
    }
  }

  interface User {
    id?: string
    teamId: string | null
    role?: 'ADMIN' | 'MEMBER'
  }

  interface JWT {
    id?: string
    teamId: string | null
    role?: 'ADMIN' | 'MEMBER'
  }
}
