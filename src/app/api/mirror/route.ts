import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { runMirror, SafetyFlagError } from '@/lib/mirror'
import { encrypt } from '@/lib/encryption'

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

    // Auth is optional — unauthenticated users get the mirror but no persistence
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

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

      // Update session with season and char count
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
        const { data: { user } } = await supabase.auth.getUser()
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
        }
      } catch {}
      return NextResponse.json({ crisis: true }, { status: 200 })
    }

    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }

    console.error('Mirror API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
