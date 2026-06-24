import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

const EventSchema = z.object({
  session_id: z.string().uuid().optional(),
  event_name: z.string().min(1).max(64),
  properties: z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const event = EventSchema.parse(body)

    // Auth is optional — anonymous sessions log events with no user_hash.
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)

    // events has no INSERT RLS policy (only an "own rows" SELECT policy), so
    // inserts via the cookie/anon client are silently dropped. Service client
    // bypasses RLS for this server-only write path — identity is already
    // verified by getAuthUser above when present.
    const db = createServiceClient()
    await db.from('events').insert({
      session_id: event.session_id ?? null,
      event_name: event.event_name,
      user_hash: user ? user.id.slice(0, 8) : null,
      properties: event.properties ?? {},
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
