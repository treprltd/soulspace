import type { SupabaseClient } from '@supabase/supabase-js'

// ── Shared profile validation + upsert ────────────────────────────────────────
//
// Used by both POST /api/user/profile (direct submission from /profile/setup
// or /auth/register's same-tab fallback) and POST /api/auth/pending-profile/consume
// (server-side bridge applied from /auth/callback). Keeping this in one place
// guarantees both paths enforce identical rules — required fields, age >= 18,
// phone format/uniqueness — and write the same shape to `users`.

export const VALID_GENDERS = ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const

export interface ProfileInput {
  firstName?: string
  lastName?:  string
  dob?:       string
  phone?:     string
  gender?:    string
}

export type ApplyProfileResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

export async function applyProfile(
  service: SupabaseClient,
  userId: string,
  userEmail: string | null | undefined,
  body: ProfileInput,
): Promise<ApplyProfileResult> {
  const { firstName, lastName, dob, phone, gender } = body

  // ── Validation ────────────────────────────────────────────────────────────
  if (!firstName?.trim()) {
    return { ok: false, error: 'First name is required.', status: 400 }
  }
  if (!lastName?.trim()) {
    return { ok: false, error: 'Last name is required.', status: 400 }
  }
  if (!dob) {
    return { ok: false, error: 'Date of birth is required.', status: 400 }
  }
  if (!phone?.trim()) {
    return { ok: false, error: 'Phone number is required.', status: 400 }
  }
  if (!gender || !(VALID_GENDERS as readonly string[]).includes(gender)) {
    return { ok: false, error: 'Please select your gender identity.', status: 400 }
  }

  // DOB: must be a valid date and user must be >= 18
  const dobDate   = new Date(dob)
  const threshold = new Date()
  threshold.setFullYear(threshold.getFullYear() - 18)
  if (isNaN(dobDate.getTime())) {
    return { ok: false, error: 'Invalid date of birth.', status: 400 }
  }
  if (dobDate > threshold) {
    return { ok: false, error: 'You must be 18 or older to use Soul Space.', status: 400 }
  }

  // Phone: at least 7 digits (international formats accepted)
  const digitsOnly = phone.replace(/\D/g, '')
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { ok: false, error: 'Please enter a valid phone number.', status: 400 }
  }

  const cleanPhone = phone.trim()

  // ── Phone uniqueness ──────────────────────────────────────────────────────
  const { data: phoneOwner } = await service
    .from('users')
    .select('id')
    .eq('phone', cleanPhone)
    .neq('id', userId)
    .maybeSingle()

  if (phoneOwner) {
    return {
      ok: false,
      error: 'This phone number is already registered with another account.',
      status: 409,
    }
  }

  // ── Upsert profile ────────────────────────────────────────────────────────
  const { error: upsertErr } = await service
    .from('users')
    .upsert(
      {
        id:               userId,
        email:            userEmail ?? '',
        first_name:       firstName.trim(),
        last_name:        lastName.trim(),
        dob,
        phone:            cleanPhone,
        gender,
        profile_complete: true,
      },
      { onConflict: 'id' },
    )

  if (upsertErr) return { ok: false, error: upsertErr.message, status: 500 }

  return { ok: true }
}
