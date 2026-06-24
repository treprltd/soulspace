import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { VALID_GENDERS } from '@/lib/profile/applyProfile'

// ── POST /api/auth/pending-profile ────────────────────────────────────────────
//
// Server-side bridge for /auth/register. Called the moment the user submits
// the registration form — BEFORE the magic link is sent and before any
// authenticated session exists, so this stashes the entered profile keyed by
// the email address the link will be sent to.
//
// Why this exists alongside the existing localStorage (`ss_pending_profile`)
// snapshot: magic-link emails are frequently opened in a different browser,
// browser profile, device, or private/InPrivate window than the one used to
// register — none of which can see localStorage written by the registration
// tab. When that happens the existing bridge silently fails, the user is
// bounced to /profile/setup to re-enter everything, and /settings shows blank
// fields in the meantime. This server-side row lets /auth/callback recover the
// data by the now-VERIFIED email address regardless of where the link is opened.
//
// Public by design (mirrors /api/user/profile/check-phone — no session exists
// yet at this point in the flow). Input is re-validated in full by
// applyProfile() at consumption time, so a malformed or malicious stash here
// can, at worst, fail validation later — it can never bypass any check.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    email?:     string
    firstName?: string
    lastName?:  string
    dob?:       string
    phone?:     string
    gender?:    string
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  // Phone and gender are optional — see applyProfile.ts. Only the fields
  // actually required to create an account (name, DOB) are required here too.
  const { firstName, lastName, dob, phone, gender } = body
  if (!firstName?.trim() || !lastName?.trim() || !dob) {
    return NextResponse.json({ error: 'Missing profile fields.' }, { status: 400 })
  }
  if (gender && !(VALID_GENDERS as readonly string[]).includes(gender)) {
    return NextResponse.json({ error: 'Invalid gender value.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('pending_profiles')
    .upsert(
      {
        email,
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        dob,
        phone:      phone?.trim() || null,
        gender:     gender || null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    )

  // Non-fatal from the client's perspective — the localStorage bridge may still
  // work, and /profile/setup remains a safety net either way. Don't block
  // sign-in over a staging failure.
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  return NextResponse.json({ ok: true })
}
