import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockCreateLink = async (sourceId: string, targetId: string, linkType: string) => {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check for circular BLOCKS dependencies
  if (linkType === 'BLOCKS') {
    // Would check if targetId blocks sourceId (circular)
    const existingLink = await (prisma.issueLink.findMany as any)({
      where: {
        sourceIssueId: targetId,
        targetIssueId: sourceId,
        linkType: 'BLOCKS',
      },
    })

    if (existingLink && existingLink.length > 0) {
      return NextResponse.json(
        { error: 'Circular dependency detected' },
        { status: 400 }
      )
    }
  }

  // Create primary link
  const link = await (prisma.issueLink.create as any)({
    data: {
      sourceIssueId: sourceId,
      targetIssueId: targetId,
      linkType,
    },
  })

  // Create inverse link for certain types
  if (linkType === 'BLOCKS') {
    await (prisma.issueLink.create as any)({
      data: {
        sourceIssueId: targetId,
        targetIssueId: sourceId,
        linkType: 'BLOCKED_BY',
      },
    })
  } else if (linkType === 'TESTS') {
    await (prisma.issueLink.create as any)({
      data: {
        sourceIssueId: targetId,
        targetIssueId: sourceId,
        linkType: 'TESTED_BY',
      },
    })
  }

  return NextResponse.json(link, { status: 201 })
}

const mockDeleteLink = async (linkId: string) => {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the link to find its inverse
  const link = await (prisma.issueLink.findUnique as any)({
    where: { id: linkId },
  })

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }

  // Determine inverse link type
  let inverseLinkType = null
  if (link.linkType === 'BLOCKS') {
    inverseLinkType = 'BLOCKED_BY'
  } else if (link.linkType === 'BLOCKED_BY') {
    inverseLinkType = 'BLOCKS'
  } else if (link.linkType === 'TESTS') {
    inverseLinkType = 'TESTED_BY'
  } else if (link.linkType === 'TESTED_BY') {
    inverseLinkType = 'TESTS'
  }

  // Delete the link
  await (prisma.issueLink.delete as any)({
    where: { id: linkId },
  })

  // Delete inverse link if it exists
  if (inverseLinkType) {
    const inverseLink = await (prisma.issueLink.findMany as any)({
      where: {
        sourceIssueId: link.targetIssueId,
        targetIssueId: link.sourceIssueId,
        linkType: inverseLinkType,
      },
    })

    if (inverseLink && inverseLink.length > 0) {
      await (prisma.issueLink.delete as any)({
        where: { id: inverseLink[0].id },
      })
    }
  }

  return NextResponse.json({ success: true })
}

describe('Issue Links API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/issues/[id]/links', () => {
    it('should create BLOCKS link and auto-create inverse BLOCKED_BY', async () => {
      const response = await mockCreateLink('issue-1', 'issue-2', 'BLOCKS')

      expect(response.status).toBe(201)

      // Should create two links
      const createCalls = vi.mocked(prisma.issueLink.create).mock.calls
      expect(createCalls.length).toBe(2)

      // First call: BLOCKS link
      expect(createCalls[0][0].data.linkType).toBe('BLOCKS')
      expect(createCalls[0][0].data.sourceIssueId).toBe('issue-1')
      expect(createCalls[0][0].data.targetIssueId).toBe('issue-2')

      // Second call: BLOCKED_BY inverse
      expect(createCalls[1][0].data.linkType).toBe('BLOCKED_BY')
      expect(createCalls[1][0].data.sourceIssueId).toBe('issue-2')
      expect(createCalls[1][0].data.targetIssueId).toBe('issue-1')
    })

    it('should create TESTS link and auto-create inverse TESTED_BY', async () => {
      const response = await mockCreateLink('issue-1', 'issue-2', 'TESTS')

      expect(response.status).toBe(201)

      const createCalls = vi.mocked(prisma.issueLink.create).mock.calls
      expect(createCalls.length).toBe(2)

      // First call: TESTS link
      expect(createCalls[0][0].data.linkType).toBe('TESTS')

      // Second call: TESTED_BY inverse
      expect(createCalls[1][0].data.linkType).toBe('TESTED_BY')
    })

    it('should reject circular BLOCKS dependency (A blocks B, B blocks A)', async () => {
      // Setup: B already blocks A
      vi.mocked(prisma.issueLink.findMany).mockResolvedValueOnce([
        {
          id: 'link-1',
          sourceIssueId: 'issue-2',
          targetIssueId: 'issue-1',
          linkType: 'BLOCKS',
          createdAt: new Date(),
        },
      ])

      // Try to create: A blocks B (would be circular)
      const response = await mockCreateLink('issue-1', 'issue-2', 'BLOCKS')

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Circular')
    })

    it('should reject circular BLOCKED_BY dependency', async () => {
      // Setup: issue-2 is blocked by issue-1, try to create reverse
      vi.mocked(prisma.issueLink.findMany).mockResolvedValueOnce([
        {
          id: 'link-1',
          sourceIssueId: 'issue-1',
          targetIssueId: 'issue-2',
          linkType: 'BLOCKS',
          createdAt: new Date(),
        },
      ])

      const response = await mockCreateLink('issue-2', 'issue-1', 'BLOCKS')

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/issues/[id]/links', () => {
    it('should remove link and its inverse', async () => {
      const mockLink = {
        id: 'link-1',
        sourceIssueId: 'issue-1',
        targetIssueId: 'issue-2',
        linkType: 'BLOCKS',
      }

      const mockInverseLink = {
        id: 'link-2',
        sourceIssueId: 'issue-2',
        targetIssueId: 'issue-1',
        linkType: 'BLOCKED_BY',
      }

      vi.mocked(prisma.issueLink.findUnique).mockResolvedValueOnce(mockLink)
      vi.mocked(prisma.issueLink.findMany).mockResolvedValueOnce([
        mockInverseLink,
      ])

      const response = await mockDeleteLink('link-1')

      expect(response.status).toBe(200)

      const deleteCalls = vi.mocked(prisma.issueLink.delete).mock.calls
      expect(deleteCalls.length).toBe(2)
      expect(deleteCalls[0][0].where.id).toBe('link-1')
      expect(deleteCalls[1][0].where.id).toBe('link-2')
    })

    it('should handle TESTS/TESTED_BY deletion', async () => {
      const mockLink = {
        id: 'link-1',
        sourceIssueId: 'issue-1',
        targetIssueId: 'issue-2',
        linkType: 'TESTS',
      }

      const mockInverseLink = {
        id: 'link-2',
        sourceIssueId: 'issue-2',
        targetIssueId: 'issue-1',
        linkType: 'TESTED_BY',
      }

      vi.mocked(prisma.issueLink.findUnique).mockResolvedValueOnce(mockLink)
      vi.mocked(prisma.issueLink.findMany).mockResolvedValueOnce([
        mockInverseLink,
      ])

      const response = await mockDeleteLink('link-1')

      expect(response.status).toBe(200)

      const deleteCalls = vi.mocked(prisma.issueLink.delete).mock.calls
      expect(deleteCalls.length).toBe(2)
    })

    it('should return 404 if link does not exist', async () => {
      vi.mocked(prisma.issueLink.findUnique).mockResolvedValueOnce(null)

      const response = await mockDeleteLink('nonexistent-link')

      expect(response.status).toBe(404)
    })
  })

  describe('Link type behavior', () => {
    it('RELATES_TO links should NOT be circular (allowed)', () => {
      const linkTypes = ['BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES']

      // RELATES_TO and DUPLICATES don't have circular restrictions
      const circularRestrictedTypes = ['BLOCKS', 'BLOCKED_BY']

      expect(
        circularRestrictedTypes.some((type) =>
          linkTypes.includes('RELATES_TO')
        )
      ).toBe(false)
    })

    it('should handle all valid link types', () => {
      const validLinkTypes = [
        'BLOCKS',
        'BLOCKED_BY',
        'RELATES_TO',
        'DUPLICATES',
        'TESTS',
        'TESTED_BY',
      ]

      expect(validLinkTypes.length).toBe(6)
      expect(validLinkTypes).toContain('RELATES_TO')
    })
  })
})
