import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { runMirror, SafetyFlagError, MirrorOverloadedError } from '@/lib/mirror'
import { encrypt } from '@/lib/encryption'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'
import { sendEmail, adminSafetyAlertEmail } from '@/lib/email'

const MirrorSchema = z.object({
  sessionId: z.string().uuid(),
  branch: z.enum(['A', 'B', 'C', 'D']),
  emotionTags: z.array(z.string()).min(1).max(15),
  intensity: z.number().int().min(1).max(10),
  contextText: z.string().max(800),
  /** Human-readable situation label from the situation picker (optional) */
  situation: z.string().max(80).optional(),
})

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  // Parse body once — store raw for use in safety catch block
  const rawBody = await req.json() as Record<string, unknown>

  try {
    const input = MirrorSchema.parse(rawBody)

    // Auth is optional — unauthenticated users get the mirror but no persistence.
    // Use getAuthUser so Bearer token (implicit flow) and cookies both work.
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)

    // ── Free-tier session gating ──────────────────────────────────────────────
    // Authenticated free-tier users are limited to FREE_SESSIONS_PER_MONTH/month.
    // Count is from the sessions table (created when session started, not completed)
    // so users can't game the gate by abandoning sessions.
    //
    // IMPORTANT: must use service client here — cookie client returns count=0 for
    // implicit-flow (localStorage) users because auth.uid() is null, which would
    // allow unlimited free sessions as a security bypass.
    if (user) {
      const gate = createServiceClient()
      const { data: userData } = await gate
        .from('users')
        .select('plan_tier')
        .eq('id', user.id)
        .single()

      if (!userData?.plan_tier || userData.plan_tier === 'free') {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        // Count only sessions where the mirror actually ran (season_assigned IS NOT NULL).
        // Also exclude the current in-progress session by ID.
        //
        // Why both conditions?
        //
        // 1. .neq('id', input.sessionId)
        //    The sessions row is created on the context page BEFORE the mirror fires.
        //    Without this, the user's own in-progress session is counted against their
        //    limit and the paywall fires before they see any reflection.
        //
        // 2. .not('season_assigned', 'is', null)
        //    Only rows where the mirror completed count as a "used" session. This
        //    prevents orphaned rows (e.g. user reached context page then navigated
        //    away before the mirror ran) from consuming the monthly allowance.
        const { count } = await gate
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString())
          .neq('id', input.sessionId)
          .not('season_assigned', 'is', null)

        if ((count ?? 0) >= FREE_SESSIONS_PER_MONTH) {
          return NextResponse.json({ paywall: true }, { status: 200 })
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const mirrorOutput = await runMirror({
      branch: input.branch,
      emotionTags: input.emotionTags,
      intensity: input.intensity,
      contextText: input.contextText,
      situation: input.situation,
    })

    const responseMs = Date.now() - startTime

    // Only persist to Supabase when the user is authenticated
    if (user) {
      // Use the service client for all DB writes here.
      // The cookie-based `supabase` client has no auth context for
      // implicit-flow (localStorage) users — auth.uid() would be null,
      // causing RLS violations. User identity is already verified above.
      const db = createServiceClient()

      // Encrypt and store session content
      const { ciphertext: encryptedContext, keyRef } = encrypt(input.contextText)
      const { ciphertext: encryptedMirror } = encrypt(JSON.stringify(mirrorOutput))

      // memoryNote is narrative-derived (a paraphrase of what the person
      // shared) — it must be encrypted at rest like everything else here.
      // It gets its own ciphertext column (rather than living only inside
      // encrypted_mirror_output) so a future visit's "welcome back" greeting
      // can fetch one short field without decrypting the full mirror blob.
      // Crisis gate: never seed memory from a safety-flagged session — Season
      // is suppressed for these, and so is memory.
      const encryptedMemoryNote = mirrorOutput.safetyFlagged || !mirrorOutput.memoryNote
        ? null
        : encrypt(mirrorOutput.memoryNote).ciphertext

      await db.from('session_content').insert({
        session_id: input.sessionId,
        encrypted_context: encryptedContext,
        encrypted_mirror_output: encryptedMirror,
        encrypted_memory_note: encryptedMemoryNote,
        encryption_key_ref: keyRef,
      })

      // Update session with season, char count, intensity, and emotion tags.
      // emotion_tags stored unencrypted — predefined vocabulary (app-level
      // metadata), not personal narrative. Enables Growth Map pattern queries
      // without per-request decryption of heavier session_content rows.
      await db
        .from('sessions')
        .update({
          season_assigned: mirrorOutput.season,
          char_count:      input.contextText.length,
          intensity:       input.intensity,
          emotion_tags:    input.emotionTags,
        })
        .eq('id', input.sessionId)
        .eq('user_id', user.id)

      // Log mirror_rendered event
      await db.from('events').insert({
        session_id: input.sessionId,
        user_hash: user.id.slice(0, 8),
        event_name: 'mirror_rendered',
        properties: { branch: input.branch, response_ms: responseMs },
      })
    }

    return NextResponse.json({ mirror: mirrorOutput })
  } catch (err) {
    if (err instanceof SafetyFlagError) {
      // Log safety event then route to crisis (best-effort — may fail if unauthenticated)
      try {
        const parsed = rawBody as { sessionId?: string; branch?: string }
        const supabase = await createClient()
        const user = await getAuthUser(req, supabase)

        // DB logging — only for authenticated users (anonymous sessions aren't persisted)
        if (user) {
          const safetyDb = createServiceClient()
          await safetyDb.from('safety_events').insert({
            session_id: parsed.sessionId ?? null,
            flag_type: err.flagType,
            branch: parsed.branch ?? null,
            action: 'crisis_routed',
            season_suppressed: true,
          })
          await safetyDb
            .from('sessions')
            .update({ safety_flagged: true })
            .eq('id', parsed.sessionId ?? '')
        }

        // Admin safety alert — fire for ALL users (auth + anonymous).
        // An admin must know whenever a crisis flag fires, regardless of session state.
        const adminEmail = process.env.ADMIN_EMAIL
        if (adminEmail) {
          try {
            const service = createServiceClient()
            const { count: unreviewedCount } = await service
              .from('safety_events')
              .select('*', { count: 'exact', head: true })
              .eq('reviewed', false)
            const template = adminSafetyAlertEmail({
              sessionId: parsed.sessionId ?? 'anonymous',
              flagType:  err.flagType ?? 'unspecified',
              branch:    parsed.branch ?? null,
              flagsUnreviewed: unreviewedCount ?? 0,
            })
            await sendEmail({ to: adminEmail, ...template })
          } catch { /* non-fatal — crisis gate fires regardless */ }
        }
      } catch { /* intentional — crisis gate fires regardless of DB update */ }
      return NextResponse.json({ crisis: true }, { status: 200 })
    }

    if (err instanceof MirrorOverloadedError) {
      // Anthropic 529 — service temporarily overloaded after retries. Return a
      // structured 503 so the client can show a friendly retry message.
      console.warn('Mirror API: Anthropic overloaded after retries')
      return NextResponse.json(
        { error: 'overloaded', code: 'overloaded', message: 'The reflection service is momentarily busy. Please try again in a few seconds.' },
        { status: 503 }
      )
    }

    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }

    // Never expose raw Anthropic error messages to the client — log server-side only
    console.error('Mirror API error:', err)
    return NextResponse.json({ error: 'internal', code: 'internal' }, { status: 500 })
  }
}
