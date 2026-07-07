import type { SupabaseClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://soulspacehealth.org'

// ── One-time sign-in CTA links for outbound email ─────────────────────────────
// Email CTAs land on /auth/email with a one-time token_hash so the click signs
// the reader in automatically. Soul Space is magic-link-only — inbox access
// already IS account access — so this adds convenience without weakening the
// auth model. admin.generateLink never sends anything itself; we only harvest
// the hashed token. Requires a SERVICE-ROLE client.
//
// If generation fails for any reason, fall back to the plain URL: the email
// still goes out, the reader just signs in normally on arrival.
export async function signInLink(
  service: SupabaseClient,
  email: string,
  next = '/age-gate',
): Promise<string> {
  try {
    const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = data?.properties?.hashed_token
    if (error || !tokenHash) throw error ?? new Error('no hashed_token in generateLink response')
    return `${APP_URL}/auth/email?token_hash=${encodeURIComponent(tokenHash)}&next=${encodeURIComponent(next)}`
  } catch {
    return `${APP_URL}${next}`
  }
}
