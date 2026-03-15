import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase admin client using the service role key.
 * Used in API routes for upload/delete operations (bypasses RLS).
 * Do NOT import this in client components.
 *
 * Lazy-initialized to avoid crashing at build time when env vars aren't set.
 */
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
      )
    }
    _supabaseAdmin = createClient(url, key)
  }
  return _supabaseAdmin
}

/** The storage bucket name for file attachments */
export const ATTACHMENT_BUCKET = 'attachments'

/**
 * Construct a public URL for a file stored in Supabase Storage.
 */
export function getAttachmentUrl(storagePath: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return ''
  return `${url}/storage/v1/object/public/${ATTACHMENT_BUCKET}/${storagePath}`
}
