import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const EventSchema = z.object({
  session_id: z.string().uuid().optional(),
  event_name: z.string().min(1).max(64),
  user_hash: z.string().max(64).optional(),
  properties: z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const event = EventSchema.parse(body)

    const supabase = await createClient()

    await supabase.from('events').insert({
      session_id: event.session_id ?? null,
      event_name: event.event_name,
      user_hash: event.user_hash ?? null,
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
