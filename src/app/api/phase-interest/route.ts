import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

// Reaction signals for the Phase 2 / Phase 3 concept previews shown at the end
// of the experience. Stored so we can learn which future direction would make
// people return before we build it. See migration 024_phase_interest.sql.
const PhaseInterestSchema = z.object({
  phase: z.union([z.literal(2), z.literal(3)]),
  reaction: z.enum(['would_use', 'interested_concerns', 'not_useful']),
  comment: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = PhaseInterestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid reaction.' }, { status: 400 })
  }

  // Auth is optional — a reaction may come from an anonymous session. When the
  // user is signed in we attribute it; otherwise user_id stays null.
  const supabase = await createClient()
  const user = await getAuthUser(req, supabase)

  const comment = parsed.data.comment?.trim()

  // Service client — write path mirrors /api/mirror; bypasses RLS by design.
  const db = createServiceClient()
  const { error } = await db.from('phase_interest').insert({
    user_id: user?.id ?? null,
    phase: parsed.data.phase,
    reaction: parsed.data.reaction,
    comment: comment && comment.length > 0 ? comment : null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
