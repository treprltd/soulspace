import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { RecoverSchema } from '@/lib/sessions/recoverSession'

// ── POST /api/auth/pending-session ────────────────────────────────────────────
//
// Server-side bridge for "complete a session anonymously, then create an
// account to save it" — companion to /api/auth/pending-profile
// (migration 016_pending_sessions.sql explains the full rationale).
//
// Called from /auth/register's submit handler, the moment the user's email
// becomes known — BEFORE the magic link is sent. It re-stages whatever
// /session/next-step already snapshotted into localStorage (`ss_pending_session`)
// keyed by the email the link will be sent to, so /auth/callback can recover
// it by the now-VERIFIED email regardless of which browser/device/profile the
// link is opened in (the localStorage bridge alone only survives same-browser).
//
// Public by design (mirrors /api/auth/pending-profile and
// /api/user/profile/check-phone — no session exists yet at this point in the
// flow). Input is re-validated in FULL by the same RecoverSchema +
// recoverSession() path at consumption time — see
// /api/auth/pending-session/consume — so a malformed or malicious stash here
// can, at worst, fail validation later. It can never bypass any check, never
// write directly to `sessions`, and never be replayed (consumed-and-deleted
// on first read, with the existing 1-hour savedAt TTL still enforced).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { email?: string } & Record<string, unknown>

  const email = body.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  // Light validation now (full schema + TTL re-checked at consume time) —
  // just enough to avoid stashing obvious garbage.
  const { email: _omit, ...rest } = body
  void _omit
  const parsed = RecoverSchema.safeParse(rest)
  if (!parsed.success) {
    // Non-fatal from the client's perspective — the localStorage bridge may
    // still work, and this is a best-effort fallback. Don't block sign-in.
    return NextResponse.json({ ok: false, error: 'Could not stage session data.' }, { status: 200 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('pending_sessions')
    .upsert(
      {
        email,
        session_data: parsed.data,
        created_at:   new Date().toISOString(),
      },
      { onConflict: 'email' },
    )

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  return NextResponse.json({ ok: true })
}
