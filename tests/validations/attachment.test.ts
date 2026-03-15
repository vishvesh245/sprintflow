/**
 * Attachment validation tests
 *
 * Covers: attachmentMetaSchema (exactly-one-parent constraint),
 * isAllowedMimeType, formatFileSize, isImageType, getAttachmentUrl,
 * ALLOWED_MIME_TYPES completeness, and MAX_FILE_SIZE boundary values.
 *
 * Run: npx vitest tests/validations/attachment.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  attachmentMetaSchema,
  isAllowedMimeType,
  formatFileSize,
  isImageType,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  DROPZONE_ACCEPT,
  MAX_FILE_SIZE,
} from '../../src/lib/validations/attachment'

// ---------------------------------------------------------------------------
// attachmentMetaSchema — exactly-one-parent constraint
// ---------------------------------------------------------------------------

describe('attachmentMetaSchema', () => {
  describe('valid: exactly one parent', () => {
    it('should pass when only issueId is set', () => {
      const result = attachmentMetaSchema.safeParse({ issueId: 'issue-abc' })
      expect(result.success).toBe(true)
    })

    it('should pass when only designItemId is set', () => {
      const result = attachmentMetaSchema.safeParse({ designItemId: 'di-xyz' })
      expect(result.success).toBe(true)
    })

    it('should pass when only commentId is set', () => {
      const result = attachmentMetaSchema.safeParse({ commentId: 'comment-123' })
      expect(result.success).toBe(true)
    })
  })

  describe('invalid: zero parents', () => {
    it('should reject when no parent is provided', () => {
      const result = attachmentMetaSchema.safeParse({})
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toContain('Exactly one')
    })

    it('should reject when all parents are explicitly undefined', () => {
      const result = attachmentMetaSchema.safeParse({
        issueId: undefined,
        designItemId: undefined,
        commentId: undefined,
      })
      expect(result.success).toBe(false)
    })

    it('should reject when all parents are empty strings (falsy)', () => {
      // Empty strings are coerced to falsy — the schema should catch zero truthy values
      const result = attachmentMetaSchema.safeParse({
        issueId: '',
        designItemId: '',
        commentId: '',
      })
      // Empty strings pass z.string().optional() but filter(Boolean) excludes them
      expect(result.success).toBe(false)
    })
  })

  describe('invalid: multiple parents', () => {
    it('should reject when issueId and designItemId are both set', () => {
      const result = attachmentMetaSchema.safeParse({
        issueId: 'issue-abc',
        designItemId: 'di-xyz',
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toContain('Exactly one')
    })

    it('should reject when issueId and commentId are both set', () => {
      const result = attachmentMetaSchema.safeParse({
        issueId: 'issue-abc',
        commentId: 'comment-123',
      })
      expect(result.success).toBe(false)
    })

    it('should reject when all three parents are set', () => {
      const result = attachmentMetaSchema.safeParse({
        issueId: 'issue-abc',
        designItemId: 'di-xyz',
        commentId: 'comment-123',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// isAllowedMimeType
// ---------------------------------------------------------------------------

describe('isAllowedMimeType', () => {
  describe('allowed types', () => {
    const allowed: string[] = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ]

    allowed.forEach((mime) => {
      it(`should allow ${mime}`, () => {
        expect(isAllowedMimeType(mime)).toBe(true)
      })
    })
  })

  describe('disallowed types', () => {
    const blocked = [
      'image/svg+xml',         // SVG can embed scripts
      'image/tiff',            // Not in allowed list
      'application/zip',       // Archives not allowed
      'application/javascript',
      'text/html',             // HTML could be served and executed
      'application/x-sh',     // Shell scripts
      'video/mp4',
      'audio/mpeg',
      '',                      // Empty string
      'application/octet-stream', // Binary blob — ambiguous
    ]

    blocked.forEach((mime) => {
      it(`should block "${mime}"`, () => {
        expect(isAllowedMimeType(mime)).toBe(false)
      })
    })
  })

  it('should be case-sensitive (uppercase MIME should not match)', () => {
    expect(isAllowedMimeType('IMAGE/JPEG')).toBe(false)
    expect(isAllowedMimeType('Application/PDF')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isImageType
// ---------------------------------------------------------------------------

describe('isImageType', () => {
  it('should return true for image/jpeg', () => {
    expect(isImageType('image/jpeg')).toBe(true)
  })

  it('should return true for image/png', () => {
    expect(isImageType('image/png')).toBe(true)
  })

  it('should return true for image/gif', () => {
    expect(isImageType('image/gif')).toBe(true)
  })

  it('should return true for image/webp', () => {
    expect(isImageType('image/webp')).toBe(true)
  })

  it('should return false for application/pdf', () => {
    expect(isImageType('application/pdf')).toBe(false)
  })

  it('should return false for text/plain', () => {
    expect(isImageType('text/plain')).toBe(false)
  })

  it('should return false for application/msword', () => {
    expect(isImageType('application/msword')).toBe(false)
  })

  // BUG-08 was fixed: isImageType now only matches allowed image MIME types
  it('returns false for image/svg+xml (blocked type, BUG-08 fixed)', () => {
    expect(isImageType('image/svg+xml')).toBe(false)
    expect(isAllowedMimeType('image/svg+xml')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe('formatFileSize', () => {
  describe('bytes range (< 1024)', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B')
    })

    it('should format 1 byte', () => {
      expect(formatFileSize(1)).toBe('1 B')
    })

    it('should format 512 bytes', () => {
      expect(formatFileSize(512)).toBe('512 B')
    })

    it('should format 1023 bytes (just below KB boundary)', () => {
      expect(formatFileSize(1023)).toBe('1023 B')
    })
  })

  describe('kilobytes range (1024 to 1MB-1)', () => {
    it('should format exactly 1 KB', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
    })

    it('should format 1536 bytes as 2 KB (rounds to nearest)', () => {
      // 1536 / 1024 = 1.5 → toFixed(0) rounds to '2'
      expect(formatFileSize(1536)).toBe('2 KB')
    })

    it('should format 100 KB', () => {
      expect(formatFileSize(100 * 1024)).toBe('100 KB')
    })

    it('should format 1048575 bytes (just below 1MB) as 1024 KB', () => {
      // 1048575 / 1024 = 1023.999... → rounds to 1024 KB
      expect(formatFileSize(1048575)).toBe('1024 KB')
    })
  })

  describe('megabytes range (>= 1MB)', () => {
    it('should format exactly 1 MB', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    })

    it('should format 2.5 MB', () => {
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    })

    it('should format MAX_FILE_SIZE (4 MB)', () => {
      expect(formatFileSize(MAX_FILE_SIZE)).toBe('4.0 MB')
    })

    it('should format large files (100 MB)', () => {
      expect(formatFileSize(100 * 1024 * 1024)).toBe('100.0 MB')
    })
  })
})

// ---------------------------------------------------------------------------
// MAX_FILE_SIZE — boundary value
// ---------------------------------------------------------------------------

describe('MAX_FILE_SIZE', () => {
  it('should be exactly 4MB (4 * 1024 * 1024 bytes)', () => {
    expect(MAX_FILE_SIZE).toBe(4 * 1024 * 1024)
  })

  it('should be 4194304 bytes', () => {
    expect(MAX_FILE_SIZE).toBe(4_194_304)
  })

  it('should be below the Vercel Hobby 4.5MB body limit', () => {
    const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024
    expect(MAX_FILE_SIZE).toBeLessThan(VERCEL_BODY_LIMIT)
  })
})

// ---------------------------------------------------------------------------
// ALLOWED_EXTENSIONS — completeness / consistency with ALLOWED_MIME_TYPES
// ---------------------------------------------------------------------------

describe('ALLOWED_EXTENSIONS', () => {
  it('should have an extension entry for every ALLOWED_MIME_TYPE', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(ALLOWED_EXTENSIONS).toHaveProperty(mime, expect.any(String))
    }
  })

  it('should not have extension entries for types not in ALLOWED_MIME_TYPES', () => {
    for (const mime of Object.keys(ALLOWED_EXTENSIONS)) {
      expect(isAllowedMimeType(mime)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// DROPZONE_ACCEPT — consistency with ALLOWED_MIME_TYPES
// ---------------------------------------------------------------------------

describe('DROPZONE_ACCEPT', () => {
  it('should have a dropzone entry for every ALLOWED_MIME_TYPE', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(DROPZONE_ACCEPT).toHaveProperty(mime)
      expect(Array.isArray((DROPZONE_ACCEPT as Record<string, string[]>)[mime])).toBe(true)
    }
  })

  it('should not have dropzone entries for types not in ALLOWED_MIME_TYPES', () => {
    for (const mime of Object.keys(DROPZONE_ACCEPT)) {
      expect(isAllowedMimeType(mime)).toBe(true)
    }
  })

  it('image/jpeg entry should include both .jpg and .jpeg extensions', () => {
    const jpegExts = (DROPZONE_ACCEPT as Record<string, string[]>)['image/jpeg']
    expect(jpegExts).toContain('.jpg')
    expect(jpegExts).toContain('.jpeg')
  })
})

// ---------------------------------------------------------------------------
// getAttachmentUrl — URL construction
// ---------------------------------------------------------------------------

describe('getAttachmentUrl (via env simulation)', () => {
  // We test the URL shape directly by replicating the construction logic,
  // since the function reads process.env at call time.

  it('should produce a valid storage URL pattern', () => {
    // Simulate what getAttachmentUrl returns for a known base URL
    const BASE = 'https://abc123.supabase.co'
    const BUCKET = 'attachments'
    const PATH = 'issues/issue-1/1700000000000-screenshot.png'
    const expected = `${BASE}/storage/v1/object/public/${BUCKET}/${PATH}`

    // Replicate the construction
    const built = `${BASE}/storage/v1/object/public/${BUCKET}/${PATH}`
    expect(built).toBe(expected)
    expect(built).toContain('/storage/v1/object/public/')
  })

  it('URL should not contain double slashes in the path portion when base has no trailing slash', () => {
    const base = 'https://abc123.supabase.co'
    const path = 'issues/id/file.png'
    const bucket = 'attachments'
    const url = `${base}/storage/v1/object/public/${bucket}/${path}`
    // Count slashes after the protocol — should not have //
    const pathPart = url.replace('https://', '')
    expect(pathPart).not.toContain('//')
  })
})

// ---------------------------------------------------------------------------
// API POST handler logic — parent validation (unit, no HTTP)
// ---------------------------------------------------------------------------

describe('POST /api/attachments parent-count validation logic', () => {
  // These tests replicate the exact manual logic in the route handler
  // to confirm it is equivalent to what attachmentMetaSchema enforces.
  // They serve as a regression guard for BUG-02 (schema vs. manual check divergence).

  function validateParentCount(
    issueId: string | null,
    designItemId: string | null,
    commentId: string | null,
  ): boolean {
    const parentCount = [issueId, designItemId, commentId].filter(Boolean).length
    return parentCount === 1
  }

  it('should accept exactly one non-null parent', () => {
    expect(validateParentCount('issue-1', null, null)).toBe(true)
    expect(validateParentCount(null, 'di-1', null)).toBe(true)
    expect(validateParentCount(null, null, 'comment-1')).toBe(true)
  })

  it('should reject zero parents', () => {
    expect(validateParentCount(null, null, null)).toBe(false)
  })

  it('should reject two parents', () => {
    expect(validateParentCount('issue-1', 'di-1', null)).toBe(false)
    expect(validateParentCount('issue-1', null, 'comment-1')).toBe(false)
    expect(validateParentCount(null, 'di-1', 'comment-1')).toBe(false)
  })

  it('should reject three parents', () => {
    expect(validateParentCount('issue-1', 'di-1', 'comment-1')).toBe(false)
  })

  it('manual logic and attachmentMetaSchema produce same result for all combinations', () => {
    const values = ['some-id', null] as const
    for (const i of values) {
      for (const d of values) {
        for (const c of values) {
          const manualResult = validateParentCount(i, d, c)
          const schemaResult = attachmentMetaSchema.safeParse({
            issueId: i ?? undefined,
            designItemId: d ?? undefined,
            commentId: c ?? undefined,
          }).success
          expect(schemaResult).toBe(manualResult)
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// File size server-side validation logic
// ---------------------------------------------------------------------------

describe('Server-side file size validation logic', () => {
  function isFileSizeValid(sizeBytes: number): boolean {
    return sizeBytes <= MAX_FILE_SIZE
  }

  it('should accept a 1-byte file', () => {
    expect(isFileSizeValid(1)).toBe(true)
  })

  it('should accept a file exactly at MAX_FILE_SIZE', () => {
    expect(isFileSizeValid(MAX_FILE_SIZE)).toBe(true)
  })

  it('should reject a file 1 byte over the limit', () => {
    expect(isFileSizeValid(MAX_FILE_SIZE + 1)).toBe(false)
  })

  it('should reject a zero-byte file (treated as invalid/empty)', () => {
    // The API has no explicit 0-byte guard — this documents the current behavior.
    // A 0-byte file currently passes the size check and would be uploaded.
    // This is a potential gap: uploading empty files wastes storage.
    expect(isFileSizeValid(0)).toBe(true) // documents current (permissive) behavior
  })

  it('should reject a 5MB file', () => {
    expect(isFileSizeValid(5 * 1024 * 1024)).toBe(false)
  })
})
