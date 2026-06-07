import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { RecoverSchema, recoverSession } from '@/lib/sessions/recoverSession'

// ── POST /api/sessions/recover ────────────────────────────────────────────────
//
// Retroactively saves a session that was completed while unauthenticated.
//
// Flow:
//   1. Anonymous user completes a session (runs mirror, reaches next-step).
//   2. next-step page snapshots all sessionStorage data into localStorage
//      under the key `ss_pending_session` before navigating to /auth/register.
//   3. Magic-link email opens in a new tab — sessionStorage is gone but
//      localStorage persists across tabs IN THE SAME BROWSER PROFILE.
//   4. auth/callback detects `ss_pending_session` after SIGNED_IN and calls
//      this endpoint to create the DB row retroactively.
//   5. Endpoint returns { ok, sessionId } and the client clears localStorage.
//
// NOTE: this is the SAME-BROWSER bridge. When the magic link is opened in a
// different browser/profile/device/private window, localStorage from the
// originating tab is invisible here — see POST /api/auth/pending-session and
// /api/auth/pending-session/consume (migration 016_pending_sessions.sql) for
// the server-side, email-keyed bridge that covers that case. Both paths
// funnel through the same recoverSession() helper so they enforce identical
// rules and write identical rows.
//
// Security:
//   - Requires a valid Bearer token (user must be authenticated).
//   - Enforces free-tier session limit — recovery counts against the quota.
//   - Rejects payloads older than 1 hour (TTL check on savedAt).
//   - Mirror output is stored encrypted, identical to the live path.

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = RecoverSchema.parse(body)

    const db = createServiceClient()
    const result = await recoverSession(db, user.id, parsed)

    if (!result.ok) {
      if (result.paywall) return NextResponse.json({ paywall: true }, { status: 200 })
      return NextResponse.json({ error: result.error ?? 'Recovery failed' }, { status: result.status })
    }

    return NextResponse.json({ ok: true, sessionId: result.sessionId })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('Session recovery error:', err)
    return NextResponse.json({ error: 'Recovery failed' }, { status: 500 })
  }
}
