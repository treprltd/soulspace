import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

const VALID_GENDERS = ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const

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

  const body = await req.json().catch(() => ({})) as {
    firstName?: string
    lastName?:  string
    dob?:       string
    phone?:     string
    gender?:    string
  }

  const { firstName, lastName, dob, phone, gender } = body

  // ── Validation ────────────────────────────────────────────────────────────
  if (!firstName?.trim()) {
    return NextResponse.json({ error: 'First name is required.' }, { status: 400 })
  }
  if (!lastName?.trim()) {
    return NextResponse.json({ error: 'Last name is required.' }, { status: 400 })
  }
  if (!dob) {
    return NextResponse.json({ error: 'Date of birth is required.' }, { status: 400 })
  }
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
  }
  if (!gender || !(VALID_GENDERS as readonly string[]).includes(gender)) {
    return NextResponse.json({ error: 'Please select your gender identity.' }, { status: 400 })
  }

  // DOB: must be a valid date and user must be >= 18
  const dobDate   = new Date(dob)
  const threshold = new Date()
  threshold.setFullYear(threshold.getFullYear() - 18)
  if (isNaN(dobDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date of birth.' }, { status: 400 })
  }
  if (dobDate > threshold) {
    return NextResponse.json({ error: 'You must be 18 or older to use Soul Space.' }, { status: 400 })
  }

  // Phone: at least 7 digits (international formats accepted)
  const digitsOnly = phone.replace(/\D/g, '')
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 })
  }

  const cleanPhone = phone.trim()
  const service    = createServiceClient()

  // ── Phone uniqueness ──────────────────────────────────────────────────────
  const { data: phoneOwner } = await service
    .from('users')
    .select('id')
    .eq('phone', cleanPhone)
    .neq('id', user.id)
    .maybeSingle()

  if (phoneOwner) {
    return NextResponse.json(
      { error: 'This phone number is already registered with another account.' },
      { status: 409 },
    )
  }

  // ── Upsert profile ────────────────────────────────────────────────────────
  const { error: upsertErr } = await service
    .from('users')
    .upsert(
      {
        id:               user.id,
        email:            user.email ?? '',
        first_name:       firstName.trim(),
        last_name:        lastName.trim(),
        dob,
        phone:            cleanPhone,
        gender,
        profile_complete: true,
      },
      { onConflict: 'id' },
    )

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
