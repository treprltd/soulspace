'use client'

// Auth callback — handles implicit flow.
// With implicit flow, Supabase returns the access_token in the URL hash fragment.
// The Supabase browser client detects this automatically via detectSessionInUrl.
// We check getSession() immediately (SDK may have processed hash before mount)
// and also listen for the SIGNED_IN event as a fallback.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const next = new URLSearchParams(window.location.search).get('next') ?? '/dashboard'

    // Check for error params Supabase may pass in the URL hash
    const hash = window.location.hash
    const hashParams = new URLSearchParams(hash.replace('#', ''))
    const errorInHash = hashParams.get('error')
    const errorDesc = hashParams.get('error_description')

    if (errorInHash) {
      setError(
        errorDesc
          ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
          : 'Sign-in link is invalid or has expired.'
      )
      return
    }

    let redirected = false

    // ── Welcome email (fire-and-forget) ────────────────────────────────────
    // Checks session count server-side — skips for returning users.
    async function maybeWelcome(session: import('@supabase/supabase-js').Session) {
      try {
        await fetch('/api/user/welcome', {
          method: 'POST',
          headers: session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
      } catch { /* non-fatal */ }
    }

    // ── Session recovery ────────────────────────────────────────────────────
    // When an anonymous user clicks "Create free account" on the next-step page,
    // all sessionStorage keys are snapshotted into localStorage as
    // `ss_pending_session`. sessionStorage is tab-scoped; magic-link emails open
    // in a NEW tab, so sessionStorage is empty by the time this callback runs.
    // localStorage survives across tabs, so the snapshot is still here.
    //
    // IMPORTANT: await this before navigating — the dashboard fetches
    // sessionsThisMonth on mount, and the count must be up-to-date.
    async function maybeRecoverSession(session: import('@supabase/supabase-js').Session) {
      try {
        const raw = localStorage.getItem('ss_pending_session')
        if (!raw) return

        const data = JSON.parse(raw) as {
          branch: string
          emotions: string
          intensity: string
          contextText: string
          mirrorOutput: string
          resonanceTap: string | null
          savedAt: number
        }

        // Must have mirror output and be within the 1-hour TTL
        if (!data.mirrorOutput || !data.savedAt) return
        if (Date.now() - data.savedAt > 60 * 60 * 1000) {
          localStorage.removeItem('ss_pending_session')
          return
        }

        await fetch('/api/sessions/recover', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            branch:       data.branch,
            contextText:  data.contextText,
            mirrorOutput: data.mirrorOutput,
            emotions:     data.emotions,
            intensity:    Number(data.intensity ?? 5),
            resonanceTap: data.resonanceTap ?? null,
            savedAt:      data.savedAt,
          }),
        })
      } catch { /* non-fatal — sign-in proceeds regardless */ }

      // Always clear — even if recovery failed, don't retry on next login
      localStorage.removeItem('ss_pending_session')
    }

    // ── Profile save ────────────────────────────────────────────────────────
    // When a user registers via /auth/register, their profile data (first_name,
    // last_name, dob, phone, gender) needs to make it into `users` once they
    // authenticate. Two independent bridges carry it across the magic-link
    // boundary, tried in order:
    //
    //   1. localStorage `ss_pending_profile` — fast path, works when the link
    //      is opened in the SAME browser/profile used to register (the entry
    //      survives the new-tab the email link opens, since localStorage is
    //      shared across tabs in one browser profile — sessionStorage is not).
    //
    //   2. Server-side `pending_profiles` row, looked up by the user's now-
    //      VERIFIED email (see POST /api/auth/pending-profile and
    //      /api/auth/pending-profile/consume) — the bridge that actually
    //      survives the common case where the magic link is opened in a
    //      DIFFERENT browser, browser profile, device, or private/InPrivate
    //      window than the one used to register. localStorage written in tab A
    //      is invisible to tab B in that case, so (1) silently no-ops; (2)
    //      recovers the same data keyed off the email address instead.
    //
    // Returns true if EITHER bridge actually persisted a complete profile —
    // only then can we safely skip the profile-completeness check below and
    // skip routing the user to /profile/setup to re-enter what they already gave us.
    async function maybeSaveProfile(session: import('@supabase/supabase-js').Session): Promise<boolean> {
      let savedViaLocalStorage = false

      try {
        const raw = localStorage.getItem('ss_pending_profile')
        if (raw) {
          try {
            const data = JSON.parse(raw) as {
              firstName: string
              lastName:  string
              dob:       string
              phone:     string
              gender?:   string
            }

            const res = await fetch('/api/user/profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify(data),
            })

            // Only trust this bridge if the save actually succeeded — a 400/409
            // (e.g. phone now claimed elsewhere) must NOT be treated as "done",
            // or the user would be sent straight to a dashboard with an
            // incomplete profile and no way to fix it.
            savedViaLocalStorage = res.ok
          } finally {
            // Always clear — never retried, whether it succeeded or not.
            localStorage.removeItem('ss_pending_profile')
          }
        }
      } catch { /* fall through to the server-side bridge below */ }

      if (savedViaLocalStorage) return true

      // Server-side bridge — works regardless of which browser/device opened
      // the link, because it keys off the verified email rather than anything
      // stored client-side.
      try {
        const res = await fetch('/api/auth/pending-profile/consume', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return false
        const body = await res.json() as { applied?: boolean }
        return body.applied === true
      } catch {
        return false
      }
    }

    // ── Profile completeness check ──────────────────────────────────────────
    // For users who sign in via the normal magic link (not /auth/register),
    // check if they've completed their profile. Incomplete → /profile/setup.
    async function isProfileComplete(session: import('@supabase/supabase-js').Session): Promise<boolean> {
      try {
        const res = await fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) return true // assume complete if check fails — don't block sign-in
        const data = await res.json() as { profile_complete?: boolean }
        return data.profile_complete === true
      } catch {
        return true // assume complete on network error
      }
    }

    // ── Main post-auth flow ─────────────────────────────────────────────────
    async function handleSession(session: import('@supabase/supabase-js').Session) {
      // 1. Welcome email FIRST — must run before session recovery creates any
      //    sessions rows, otherwise the idempotency check on the server sees
      //    count > 0 and skips the email for users who tried the app anonymously
      //    before registering. Awaited so the column is stamped before we proceed.
      await maybeWelcome(session)

      // 2. Recover anonymous session — dashboard reads count on mount.
      //    Must be awaited so the DB row exists before we navigate.
      await maybeRecoverSession(session)

      // 3. Save pending profile from /auth/register flow (if present)
      const hadPendingProfile = await maybeSaveProfile(session)

      // 4. Check profile completeness for returning users who bypassed /auth/register
      const profileComplete = hadPendingProfile || await isProfileComplete(session)

      if (!profileComplete) {
        // Redirect to profile setup, preserving the intended destination
        router.replace(`/profile/setup?next=${encodeURIComponent(next)}`)
      } else {
        router.replace(next)
      }
    }

    // 1. Check if SDK already processed the hash before this component mounted
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !redirected) {
        redirected = true
        handleSession(session)
      }
    })

    // 2. Also listen for SIGNED_IN — fires when SDK processes the hash token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && !redirected) {
        redirected = true
        handleSession(session)
        return
      }
      // If INITIAL_SESSION fires with no session and no hash token, the link is bad
      if (event === 'INITIAL_SESSION' && !session && !hash.includes('access_token')) {
        setTimeout(async () => {
          const { data: { session: s } } = await supabase.auth.getSession()
          if (!s && !redirected) {
            setError('Sign-in link has expired or already been used. Please request a new one.')
          } else if (s && !redirected) {
            redirected = true
            router.replace(next)
          }
        }, 3000)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (error) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: '#060E18' }}
      >
        <div className="animate-fade-in max-w-sm w-full">
          <Logo size="md" />
          <div className="w-8 h-px mx-auto mt-5 mb-6" style={{ background: 'rgba(201,168,76,.2)' }} />
          <p className="text-sm text-mist mb-5 leading-relaxed">{error}</p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="btn-primary text-sm px-6 py-2.5"
          >
            Request a new link →
          </button>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: '#060E18' }}
    >
      <div
        className="w-10 h-10 rounded-full animate-spin-slow"
        style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }}
      />
      <p className="text-xs text-mist">Signing you in…</p>
    </main>
  )
}
