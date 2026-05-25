import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { encrypt } from '@/lib/encryption'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'
import type { MirrorOutput } from '@/types'

// ── POST /api/sessions/recover ────────────────────────────────────────────────
//
// Retroactively saves a session that was completed while unauthenticated.
//
// Flow:
//   1. Anonymous user completes a session (runs mirror, reaches next-step).
//   2. next-step page snapshots all sessionStorage data into localStorage
//      under the key `ss_pending_session` before navigating to /auth/signin.
//   3. Magic-link email opens in a new tab — sessionStorage is gone but
//      localStorage persists across tabs.
//   4. auth/callback detects `ss_pending_session` after SIGNED_IN and calls
//      this endpoint to create the DB row retroactively.
//   5. Endpoint returns { ok, sessionId } and the client clears localStorage.
//
// Security:
//   - Requires a valid Bearer token (user must be authenticated).
//   - Enforces free-tier session limit — recovery counts against the quota.
//   - Rejects payloads older than 1 hour (TTL check on savedAt).
//   - Mirror output is stored encrypted, identical to the live path.

const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour

const RecoverSchema = z.object({
  branch:       z.enum(['A', 'B', 'C', 'D']),
  situation:    z.string().max(80).optional(),  // life situation label, migration 008+
  contextText:  z.string().max(800).default(''),
  mirrorOutput: z.string(),       // JSON-encoded MirrorOutput
  emotions:     z.string(),       // JSON-encoded string[]
  intensity:    z.coerce.number().int().min(1).max(10),
  resonanceTap: z.enum(['accurate', 'not_quite']).nullable().default(null),
  savedAt:      z.number(),       // Date.now() timestamp from client
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = RecoverSchema.parse(body)

    // ── TTL check ──────────────────────────────────────────────────────────
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      return NextResponse.json(
        { error: 'Session data has expired — it can only be recovered within 1 hour of completion.' },
        { status: 410 }
      )
    }

    const db = createServiceClient()

    // ── Free-tier gate ─────────────────────────────────────────────────────
    // Recovery counts against the monthly quota — same as a live session.
    const { data: userData } = await db
      .from('users')
      .select('plan_tier')
      .eq('id', user.id)
      .single()

    if (!userData?.plan_tier || userData.plan_tier === 'free') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { count } = await db
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString())

      if ((count ?? 0) >= FREE_SESSIONS_PER_MONTH) {
        return NextResponse.json({ paywall: true }, { status: 200 })
      }
    }

    // ── Parse mirror output ────────────────────────────────────────────────
    let mirrorOutput: MirrorOutput
    try {
      mirrorOutput = JSON.parse(parsed.mirrorOutput) as MirrorOutput
    } catch {
      return NextResponse.json({ error: 'Invalid mirror output' }, { status: 400 })
    }

    // ── Create session row ─────────────────────────────────────────────────
    const { data: newSession, error: sessionError } = await db
      .from('sessions')
      .insert({
        user_id:         user.id,
        branch:          parsed.branch,
        ...(parsed.situation ? { situation: parsed.situation } : {}),
        intensity:       parsed.intensity,
        season_assigned: mirrorOutput.season ?? null,
        char_count:      parsed.contextText.length,
        safety_flagged:  mirrorOutput.safetyFlagged ?? false,
        completed_at:    new Date().toISOString(),
        resonance_tap:   parsed.resonanceTap,
      })
      .select('id')
      .single()

    if (sessionError) throw sessionError

    // ── Encrypt and save session content ───────────────────────────────────
    const { ciphertext: encryptedContext, keyRef } = encrypt(parsed.contextText)
    const { ciphertext: encryptedMirror }           = encrypt(parsed.mirrorOutput)

    await db.from('session_content').insert({
      session_id:              newSession.id,
      encrypted_context:       encryptedContext,
      encrypted_mirror_output: encryptedMirror,
      encryption_key_ref:      keyRef,
    })

    // ── Log event ──────────────────────────────────────────────────────────
    await db.from('events').insert({
      session_id:  newSession.id,
      user_hash:   user.id.slice(0, 8),
      event_name:  'mirror_rendered',
      properties:  {
        branch:    parsed.branch,
        recovered: true,       // flag so analytics can distinguish
      },
    })

    return NextResponse.json({ ok: true, sessionId: newSession.id })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('Session recovery error:', err)
    return NextResponse.json({ error: 'Recovery failed' }, { status: 500 })
  }
}
