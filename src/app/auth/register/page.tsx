'use client'

// /auth/register — collected when an anonymous user clicks "Create free account".
// Collects: first name, last name, DOB, phone, email.
// Stores profile in localStorage (ss_pending_profile) so the auth/callback page
// can save it after the magic link is clicked (magic links open in a new tab,
// which destroys sessionStorage — localStorage survives).

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'
import {
  ProfileFields,
  validateProfileFields,
  Field,
  inputClass,
  inputStyle,
  inputFocusStyle,
} from '@/components/ui/ProfileFields'

type Step = 'form' | 'sent'

export default function Register() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [next, setNext] = useState('/dashboard')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [dob, setDob]             = useState('')
  const [phone, setPhone]         = useState('')
  const [gender, setGender]       = useState('')
  const [email, setEmail]         = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Resend state
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading]   = useState(false)
  const [resendDone, setResendDone]         = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setNext(params.get('next') ?? '/dashboard')

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        // Already signed in — go to destination
        router.replace(params.get('next') ?? '/dashboard')
      } else {
        setCheckingAuth(false)
      }
    })
  }, [router])

  function validate() {
    const errs = validateProfileFields({ firstName, lastName, dob, phone, gender })

    if (!email.trim()) {
      errs.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid email address.'
    }

    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)

    // Check phone uniqueness before sending magic link — only when a phone
    // number was actually given, since it's now optional.
    if (phone.trim()) {
      try {
        const res = await fetch(
          `/api/user/profile/check-phone?phone=${encodeURIComponent(phone.trim())}`,
        )
        const { available } = await res.json()
        if (!available) {
          setErrors({ phone: 'This phone number is already registered. Try signing in instead.' })
          setLoading(false)
          return
        }
      } catch {
        // Non-fatal — proceed; server will catch duplicate on profile save
      }
    }

    // Snapshot profile to localStorage so the auth/callback page can save it
    // after the magic link opens in a new tab (sessionStorage would be lost)
    try {
      localStorage.setItem('ss_pending_profile', JSON.stringify({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        dob,
        phone:     phone.trim(),
        gender,
      }))
    } catch { /* non-fatal */ }

    // ALSO stash server-side, keyed by email — magic-link emails are very
    // often opened in a different browser/profile/device/private window than
    // the one used to register, none of which can see the localStorage entry
    // above. /auth/callback consumes this by the verified email regardless of
    // where the link is opened. Awaited (but non-blocking on failure) so it's
    // reliably persisted before we navigate away to check the inbox.
    try {
      await fetch('/api/auth/pending-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:     email.trim(),
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          dob,
          phone:     phone.trim(),
          gender,
        }),
      })
    } catch { /* non-fatal — localStorage bridge and /profile/setup remain as fallbacks */ }

    // ALSO re-stage any anonymously-completed session server-side, keyed by
    // the same email — companion bridge to the one above. /session/next-step
    // already snapshotted the completed session into localStorage
    // (`ss_pending_session`) before routing here; sessionStorage from that
    // page survives this client-side navigation, so it's readable here too.
    // Re-staging it now (the moment the email is known, before the magic link
    // is sent) means /auth/callback can recover it by the verified email
    // regardless of which browser/device/profile opens the link — without
    // this, a user's first completed session can simply vanish whenever the
    // link is opened somewhere other than where the session was completed
    // (the common case: checking email on a different device/app/profile).
    // See migration 016_pending_sessions.sql for the full rationale.
    try {
      const pendingSessionRaw = localStorage.getItem('ss_pending_session')
      if (pendingSessionRaw) {
        const pendingSession = JSON.parse(pendingSessionRaw) as Record<string, unknown>
        await fetch('/api/auth/pending-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), ...pendingSession }),
        })
      }
    } catch { /* non-fatal — localStorage bridge remains as a fallback */ }

    // Send magic link
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)

    if (error) {
      setErrors({ email: error.message })
      return
    }

    setStep('sent')
  }

  async function handleResend() {
    setResendLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setResendLoading(false)
    setResendDone(true)
    setTimeout(() => setResendDone(false), 3000)

    setResendCooldown(60)
    const interval = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(interval); return 0 }
        return c - 1
      })
    }, 1000)
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#060E18' }}>
        <div
          className="w-8 h-8 rounded-full"
          style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }}
        />
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-5 py-10"
      style={{ background: '#060E18' }}
    >
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-6">
          <Logo size="md" />
          <div className="w-8 h-px mx-auto mt-4 mb-5" style={{ background: 'rgba(201,168,76,.2)' }} />
        </div>

        {step === 'sent' ? (
          /* ── Check inbox state ─────────────────────────────────────────── */
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.2)' }}
            >
              <span style={{ fontSize: '28px' }}>✉</span>
            </div>

            <h2 className="font-serif font-light text-sand2 text-xl mb-2">Check your inbox.</h2>
            <p className="text-sm text-mist leading-relaxed mb-1">
              We sent a sign-in link to
            </p>
            <p className="text-sm font-medium text-sand mb-5 break-all">{email}</p>

            <div
              className="rounded-xl px-4 py-3.5 mb-5 text-left"
              style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.06)' }}
            >
              <p className="text-xs text-mist leading-relaxed">
                Click the link in the email to create your account.<br />
                <span style={{ color: 'rgba(139,167,184,.6)' }}>
                  Didn&apos;t get it? Check your spam folder. The link expires in 1 hour.
                </span>
              </p>
            </div>

            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendLoading}
              className="w-full py-3 rounded-xl text-sm transition-all mb-3 disabled:cursor-not-allowed"
              style={{
                border: '1px solid rgba(201,168,76,.22)',
                color: resendDone ? 'var(--teal2)' : resendCooldown > 0 ? 'rgba(213,226,235,.65)' : 'var(--gold)',
                background: 'transparent',
              }}
            >
              {resendLoading ? 'Sending…' : resendDone ? '✓ New link sent' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend link →'}
            </button>

            <button
              onClick={() => { setStep('form'); setResendCooldown(0); setResendDone(false) }}
              className="text-xs block mx-auto underline underline-offset-4 hover:text-mist transition-colors"
              style={{ color: 'rgba(213,226,235,.72)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Change details
            </button>
          </div>
        ) : (
          /* ── Registration form ─────────────────────────────────────────── */
          <>
            <h2 className="font-serif font-light text-sand2 text-xl mb-1 text-center">
              Create your account.
            </h2>
            <p className="text-sm text-mist mb-5 leading-relaxed text-center">
              Your details are used only to save your sessions<br />and for future communication. Never shared.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

              <ProfileFields
                values={{ firstName, lastName, dob, phone, gender }}
                setters={{ setFirstName, setLastName, setDob, setPhone, setGender }}
                errors={errors}
                focusedField={focusedField}
                onFocus={setFocusedField}
                onBlur={() => setFocusedField(null)}
              />

              <Field label="Email address" error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className={inputClass}
                  style={focusedField === 'email' ? inputFocusStyle : inputStyle}
                />
                <p className="text-xs pl-0.5" style={{ color: 'rgba(213,226,235,.65)' }}>
                  We&rsquo;ll email you a sign-in link — no password needed.
                </p>
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 mt-1"
              >
                {loading ? 'Creating account…' : 'Create free account →'}
              </button>
            </form>

            <div className="mt-4 text-center space-y-2">
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(213,226,235,.65)' }}>
                Already have an account?{' '}
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="underline underline-offset-2 hover:text-mist transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  Sign in here
                </button>
              </p>
              <p className="text-xs" style={{ color: 'rgba(213,226,235,.45)' }}>
                <a
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-mist transition-colors"
                  style={{ color: 'inherit' }}
                >
                  Privacy policy →
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
