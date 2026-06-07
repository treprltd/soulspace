import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

const VALID_FREQUENCIES = ['off', 'biweekly', 'monthly'] as const
type CheckInFrequency = typeof VALID_FREQUENCIES[number]

// ── GET /api/user/memory-preferences ──────────────────────────────────────────
// Returns the authenticated user's check-in opt-in setting.
// Memory itself (the "welcome back" greeting) is always-on and has no
// preference to read here — only the opt-in check-in emails are configurable.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('users')
    .select('check_in_frequency')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checkInFrequency: data?.check_in_frequency ?? 'off' })
}

// ── POST /api/user/memory-preferences ─────────────────────────────────────────
// Body: { checkInFrequency: 'off' | 'biweekly' | 'monthly' }
// Off by default; the user can change this at any time (per the locked copy's
// promise — see src/lib/copy/memory.ts CHECK_IN_CONSENT / SETTINGS_MEMORY_SECTION).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { checkInFrequency?: string }
  const { checkInFrequency } = body

  if (!checkInFrequency || !(VALID_FREQUENCIES as readonly string[]).includes(checkInFrequency)) {
    return NextResponse.json({ error: 'Invalid check-in frequency.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('users')
    .update({ check_in_frequency: checkInFrequency as CheckInFrequency })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, checkInFrequency })
}
