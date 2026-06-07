import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { applyProfile, type ProfileInput } from '@/lib/profile/applyProfile'

// ── GET /api/user/profile ─────────────────────────────────────────────────────
// Returns the authenticated user's profile fields.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('users')
    .select('first_name, last_name, dob, phone, gender, profile_complete')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { profile_complete: false })
}

// ── POST /api/user/profile ────────────────────────────────────────────────────
// Creates or updates the authenticated user's profile.
// Body: { firstName, lastName, dob, phone, gender }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as ProfileInput

  const service = createServiceClient()
  const result  = await applyProfile(service, user.id, user.email, body)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
