import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/encryption'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'
import type { MirrorOutput } from '@/types'

// ── Shared session-recovery validation + write path ───────────────────────────
//
// Used by both POST /api/sessions/recover (localStorage bridge — same browser/
// profile/device the session was completed in) and
// POST /api/auth/pending-session/consume (server-side bridge — works
// regardless of which browser/device opens the magic link, see migration
// 016_pending_sessions.sql for why that second bridge exists). Keeping this
// in one place guarantees both paths enforce identical rules — TTL, schema,
// free-tier quota — and write the exact same shape to `sessions` /
// `session_content`, with the same `recovered: true` analytics flag.

export const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour

export const RecoverSchema = z.object({
  branch:       z.enum(['A', 'B', 'C', 'D']),
  situation:    z.string().max(80).optional(),  // life situation label, migration 008+
  contextText:  z.string().max(800).default(''),
  mirrorOutput: z.string(),       // JSON-encoded MirrorOutput
  emotions:     z.string(),       // JSON-encoded string[]
  intensity:    z.coerce.number().int().min(1).max(10),
  resonanceTap: z.enum(['accurate', 'not_quite']).nullable().default(null),
  savedAt:      z.number(),       // Date.now() timestamp from the originating client
})

export type RecoverInput = z.infer<typeof RecoverSchema>

export type RecoverSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; status: number; error?: string; paywall?: true }

export async function recoverSession(
  db: SupabaseClient,
  userId: string,
  parsed: RecoverInput,
): Promise<RecoverSessionResult> {
  // ── TTL check ──────────────────────────────────────────────────────────────
  if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
    return {
      ok: false,
      status: 410,
      error: 'Session data has expired — it can only be recovered within 1 hour of completion.',
    }
  }

  // ── Free-tier gate — recovery counts against the quota, same as a live session ──
  const { data: userData } = await db
    .from('users')
    .select('plan_tier')
    .eq('id', userId)
    .single()

  if (!userData?.plan_tier || userData.plan_tier === 'free') {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await db
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())

    if ((count ?? 0) >= FREE_SESSIONS_PER_MONTH) {
      return { ok: false, status: 200, paywall: true }
    }
  }

  // ── Parse mirror output ────────────────────────────────────────────────────
  let mirrorOutput: MirrorOutput
  try {
    mirrorOutput = JSON.parse(parsed.mirrorOutput) as MirrorOutput
  } catch {
    return { ok: false, status: 400, error: 'Invalid mirror output' }
  }

  // ── Create session row ─────────────────────────────────────────────────────
  const { data: newSession, error: sessionError } = await db
    .from('sessions')
    .insert({
      user_id:         userId,
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

  if (sessionError) return { ok: false, status: 500, error: sessionError.message }

  // ── Encrypt and save session content ───────────────────────────────────────
  const { ciphertext: encryptedContext, keyRef } = encrypt(parsed.contextText)
  const { ciphertext: encryptedMirror }           = encrypt(parsed.mirrorOutput)

  await db.from('session_content').insert({
    session_id:              newSession.id,
    encrypted_context:       encryptedContext,
    encrypted_mirror_output: encryptedMirror,
    encryption_key_ref:      keyRef,
  })

  // ── Log event ───────────────────────────────────────────────────────────────
  await db.from('events').insert({
    session_id:  newSession.id,
    user_hash:   userId.slice(0, 8),
    event_name:  'mirror_rendered',
    properties:  {
      branch:    parsed.branch,
      recovered: true,       // flag so analytics can distinguish
    },
  })

  return { ok: true, sessionId: newSession.id }
}
