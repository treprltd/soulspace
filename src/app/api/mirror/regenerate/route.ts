import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { runMirror, SafetyFlagError, MirrorOverloadedError } from '@/lib/mirror'
import { encrypt } from '@/lib/encryption'
import { sendEmail, adminSafetyAlertEmail } from '@/lib/email'

const RegenerateSchema = z.object({
  sessionId: z.string().uuid(),
  branch: z.enum(['A', 'B', 'C', 'D']),
  emotionTags: z.array(z.string()).min(1).max(15),
  intensity: z.number().int().min(1).max(10),
  contextText: z.string().max(800),
  situation: z.string().max(80).optional(),
  /** The user's answer to "What did it miss?" after tapping "Not quite" */
  correctionContext: z.string().min(1).max(300),
})

export async function POST(req: NextRequest) {
  const rawBody = await req.json() as Record<string, unknown>

  try {
    const input = RegenerateSchema.parse(rawBody)

    // Auth is optional — unauthenticated users get the regenerated mirror but
    // no persistence, same as /api/mirror. No free-tier gating here: this is
    // a correction of an already-counted session, not a new one.
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)

    const mirrorOutput = await runMirror({
      branch: input.branch,
      emotionTags: input.emotionTags,
      intensity: input.intensity,
      contextText: input.contextText,
      situation: input.situation,
      correctionContext: input.correctionContext,
    })

    if (user) {
      const db = createServiceClient()

      const { ciphertext: encryptedMirror, keyRef } = encrypt(JSON.stringify(mirrorOutput))

      // Crisis gate: never seed memory from a safety-flagged session — Season
      // is suppressed for these, and so is memory.
      const encryptedMemoryNote = mirrorOutput.safetyFlagged || !mirrorOutput.memoryNote
        ? null
        : encrypt(mirrorOutput.memoryNote).ciphertext

      await db
        .from('session_content')
        .update({
          encrypted_mirror_output: encryptedMirror,
          encrypted_memory_note: encryptedMemoryNote,
          encryption_key_ref: keyRef,
        })
        .eq('session_id', input.sessionId)

      // Reset resonance_tap so the user can react to the regenerated reflection
      await db
        .from('sessions')
        .update({
          season_assigned: mirrorOutput.season,
          resonance_tap: null,
        })
        .eq('id', input.sessionId)
        .eq('user_id', user.id)

      await db.from('events').insert({
        session_id: input.sessionId,
        user_hash: user.id.slice(0, 8),
        event_name: 'mirror_regenerated',
        properties: { branch: input.branch },
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
      console.warn('Mirror regenerate API: Anthropic overloaded after retries')
      return NextResponse.json(
        { error: 'overloaded', code: 'overloaded', message: 'The reflection service is momentarily busy. Please try again in a few seconds.' },
        { status: 503 }
      )
    }

    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }

    console.error('Mirror regenerate API error:', err)
    return NextResponse.json({ error: 'internal', code: 'internal' }, { status: 500 })
  }
}
