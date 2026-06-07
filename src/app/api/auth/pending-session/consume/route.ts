import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { RecoverSchema, recoverSession } from '@/lib/sessions/recoverSession'

const MAX_AGE_DAYS = 7 // outer staleness bound; the embedded savedAt 1-hour TTL is the real gate

// ── POST /api/auth/pending-session/consume ───────────────────────────────────
//
// Companion to /api/auth/pending-profile/consume — see migration
// 016_pending_sessions.sql for the full rationale. Called from
// /auth/callback right after the user authenticates via magic link. Looks up
// a session snapshot staged at /auth/register time (POST
// /api/auth/pending-session) by the user's now-VERIFIED email, re-validates
// it against the exact same RecoverSchema and recoverSession() path that
// /api/sessions/recover uses (same TTL, same free-tier quota gate, same
// `recovered: true` analytics flag, same encrypted storage), and deletes the
// row so it can never be replayed.
//
// This is the cross-browser/cross-device fallback for the localStorage
// (`ss_pending_session`) bridge: that bridge only survives when the magic
// link is opened in the same browser/profile/device the session was
// completed in. This endpoint works regardless, because it keys off the
// verified email rather than anything stored client-side — without it, a
// user's first completed session can simply vanish (dashboard shows "No
// sessions yet", quota reads as untouched) the moment the link is opened
// somewhere else, which is the common case, not the edge case.
//
// Returns { recovered: boolean, sessionId?: string, paywall?: boolean }.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email) return NextResponse.json({ recovered: false })

  const service = createServiceClient()
  const email = user.email.trim().toLowerCase()

  const { data: pending } = await service
    .from('pending_sessions')
    .select('session_data, created_at')
    .eq('email', email)
    .maybeSingle()

  if (!pending) return NextResponse.json({ recovered: false })

  // Always consume on read — a stale or invalid row should never be retried.
  await service.from('pending_sessions').delete().eq('email', email)

  const ageMs = Date.now() - new Date(pending.created_at).getTime()
  if (ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ recovered: false, reason: 'expired' })
  }

  const parsed = RecoverSchema.safeParse(pending.session_data)
  if (!parsed.success) {
    return NextResponse.json({ recovered: false, reason: 'invalid' })
  }

  const result = await recoverSession(service, user.id, parsed.data)
  if (!result.ok) {
    if (result.paywall) return NextResponse.json({ recovered: false, paywall: true })
    return NextResponse.json({ recovered: false, reason: result.error })
  }

  return NextResponse.json({ recovered: true, sessionId: result.sessionId })
}
