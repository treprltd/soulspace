import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

const VALID_FREQUENCIES = ['off', 'weekly', 'biweekly', 'monthly', 'custom_days'] as const
type CheckInFrequency = typeof VALID_FREQUENCIES[number]

// Normalise + validate a weekday list (0=Sun..6=Sat), deduped and sorted.
// Only meaningful for check_in_frequency = 'custom_days'; ignored otherwise.
function cleanDays(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  const set = new Set<number>()
  for (const d of input) {
    const n = Number(d)
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n)
  }
  return Array.from(set).sort((a, b) => a - b)
}

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
    .select('check_in_frequency, check_in_days')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    checkInFrequency: data?.check_in_frequency ?? 'off',
    checkInDays: data?.check_in_days ?? [],
  })
}

// ── POST /api/user/memory-preferences ─────────────────────────────────────────
// Body: { checkInFrequency: 'off'|'weekly'|'biweekly'|'monthly'|'custom_days',
//         checkInDays?: number[] }  // 0=Sun..6=Sat, only used for custom_days
// Off by default; the user can change this at any time (per the locked copy's
// promise — see src/lib/copy/memory.ts CHECK_IN_CONSENT / SETTINGS_MEMORY_SECTION).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { checkInFrequency?: string; checkInDays?: unknown }
  const { checkInFrequency } = body

  if (!checkInFrequency || !(VALID_FREQUENCIES as readonly string[]).includes(checkInFrequency)) {
    return NextResponse.json({ error: 'Invalid check-in frequency.' }, { status: 400 })
  }

  // Days only matter for custom_days; clear them for every other cadence so a
  // stale weekday set can never fire once the user switches away from it.
  const days = checkInFrequency === 'custom_days' ? cleanDays(body.checkInDays) : []
  if (checkInFrequency === 'custom_days' && days.length === 0) {
    return NextResponse.json({ error: 'Pick at least one day.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('users')
    .update({
      check_in_frequency: checkInFrequency as CheckInFrequency,
      check_in_days: days,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, checkInFrequency, checkInDays: days })
}
