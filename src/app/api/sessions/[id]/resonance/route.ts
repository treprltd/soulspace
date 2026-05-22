import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

const ResonanceSchema = z.object({
  result: z.enum(['accurate', 'not_quite']),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await req.json()
    const { result } = ResonanceSchema.parse(body)

    const supabase = await createClient()
    // Accept both Bearer token (implicit flow) and cookie-based auth
    const user = await getAuthUser(req, supabase)
    if (!user) {
      // Resonance is best-effort — don't fail the UX if user is unauthenticated
      return NextResponse.json({ ok: true })
    }

    // Service client — user verified above; cookie client has no JWT for
    // implicit-flow users so auth.uid() would be null → RLS violation
    const { error } = await createServiceClient()
      .from('sessions')
      .update({ resonance_tap: result })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
