import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { applyProfile, type ProfileInput } from '@/lib/profile/applyProfile'

const MAX_AGE_DAYS = 7

// ── POST /api/auth/pending-profile/consume ───────────────────────────────────
//
// Called from /auth/callback right after the user authenticates via magic
// link. Looks up a pending profile staged at /auth/register time (see
// POST /api/auth/pending-profile) by the user's now-VERIFIED email, applies it
// through the same validation + upsert path as /api/user/profile, and deletes
// the row so it can never be replayed.
//
// This is the cross-browser/cross-device fallback for the localStorage
// (`ss_pending_profile`) bridge: that bridge only survives when the magic
// link is opened in the same browser/profile used to register. This endpoint
// works regardless, because it keys off the verified email rather than
// anything stored client-side.
//
// Returns { applied: boolean }. `applied: true` means the authenticated
// user's profile is now complete — the caller can skip the /profile/setup
// redirect. `applied: false` (no row, expired row, or failed validation) means
// the caller should fall through to the normal profile-completeness check.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email) return NextResponse.json({ applied: false })

  const service = createServiceClient()
  const email = user.email.trim().toLowerCase()

  const { data: pending } = await service
    .from('pending_profiles')
    .select('first_name, last_name, dob, phone, gender, created_at')
    .eq('email', email)
    .maybeSingle()

  if (!pending) return NextResponse.json({ applied: false })

  // Always consume on read — a stale or invalid row should never be retried.
  await service.from('pending_profiles').delete().eq('email', email)

  const ageMs = Date.now() - new Date(pending.created_at).getTime()
  if (ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ applied: false, reason: 'expired' })
  }

  const profileInput: ProfileInput = {
    firstName: pending.first_name,
    lastName:  pending.last_name,
    dob:       pending.dob,
    phone:     pending.phone,
    gender:    pending.gender,
  }

  const result = await applyProfile(service, user.id, user.email, profileInput)
  if (!result.ok) {
    // Don't block sign-in — fall through to /profile/setup so the user can
    // correct whatever failed validation (e.g. phone now claimed elsewhere).
    return NextResponse.json({ applied: false, reason: result.error })
  }

  return NextResponse.json({ applied: true })
}
