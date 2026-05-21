import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

/**
 * Resolves the authenticated user from an incoming API route request.
 *
 * Priority:
 *   1. Authorization: Bearer <token> header — used by implicit-flow browser
 *      clients (JWT stored in localStorage, not cookies).
 *   2. Cookie-based session — used by SSR pages and PKCE-flow clients.
 *
 * All API routes that require authentication should use this instead of
 * calling `supabase.auth.getUser()` directly, so they work with both flows.
 */
export async function getAuthUser(
  req: NextRequest,
  supabase: SupabaseClient,
): Promise<User | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data, error } = await supabase.auth.getUser(token)
    if (!error && data.user) return data.user
  }
  // Fall back to cookie-based session (SSR / PKCE flow)
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}
