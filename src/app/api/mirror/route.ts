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
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('plan_tier')
        .eq('id', user.id)
        .single()

      if (!userData?.plan_tier || userData.plan_tier === 'free') {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { count } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString())

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
    })

    const responseMs = Date.now() - startTime

    // Only persist to Supabase when the user is authenticated
    if (user) {
      // Encrypt and store session content
      const { ciphertext: encryptedContext, keyRef } = encrypt(input.contextText)
      const { ciphertext: encryptedMirror } = encrypt(JSON.stringify(mirrorOutput))

      await supabase.from('session_content').insert({
        session_id: input.sessionId,
        encrypted_context: encryptedContext,
        encrypted_mirror_output: encryptedMirror,
        encryption_key_ref: keyRef,
      })

      // Update session with season, char count and intensity
      await supabase
        .from('sessions')
        .update({
          season_assigned: mirrorOutput.season,
          char_count: input.contextText.length,
          intensity: input.intensity,
        })
        .eq('id', input.sessionId)
        .eq('user_id', user.id)

      // Log mirror_rendered event
      await supabase.from('events').insert({
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
        if (user) {
          await supabase.from('safety_events').insert({
            session_id: parsed.sessionId ?? null,
            flag_type: err.flagType,
            branch: parsed.branch ?? null,
            action: 'crisis_routed',
            season_suppressed: true,
          })
          await supabase
            .from('sessions')
            .update({ safety_flagged: true })
            .eq('id', parsed.sessionId ?? '')

          // Alert admin via email (best-effort, non-blocking)
          const adminEmail = process.env.ADMIN_EMAIL
          if (adminEmail) {
            try {
              const service = createServiceClient()
              const { count: unreviewedCount } = await service
                .from('safety_events')
                .select('*', { count: 'exact', head: true })
                .eq('reviewed', false)
              const template = adminSafetyAlertEmail({
                sessionId: parsed.sessionId ?? 'unknown',
                flagType: err.flagType ?? 'unspecified',
                branch: parsed.branch ?? null,
                flagsUnreviewed: unreviewedCount ?? 0,
              })
              await sendEmail({ to: adminEmail, ...template })
            } catch { /* non-fatal */ }
          }
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
