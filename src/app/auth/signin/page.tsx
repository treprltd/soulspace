'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

export default function SignIn() {
  const router = useRouter()
  const [next, setNext] = useState('/dashboard')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  // Resend state
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  // If already signed in, redirect immediately
  useEffect(() => {
    // Read ?next param client-side (avoids Suspense requirement for useSearchParams)
    const params = new URLSearchParams(window.location.search)
    const nextParam = params.get('next') ?? '/dashboard'
    setNext(nextParam)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace(nextParam)
      } else {
        setCheckingAuth(false)
      }
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Manual validation — we use noValidate to suppress the browser's native
    // red validation bubble which was rendering as a confusing "{}" on iOS
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  const handleResend = async () => {
    setResendLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setResendLoading(false)
    setResendDone(true)

    // Hide the confirmation tick after 3 s
    setTimeout(() => setResendDone(false), 3000)

    // 60 s cooldown so user can't hammer the send button
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
        <div className="w-8 h-8 rounded-full animate-spin-slow" style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }} />
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: '#060E18' }}>
      <div className="w-full max-w-sm text-center animate-fade-in">
        <Logo size="md" />
        <div className="w-8 h-px mx-auto mt-4 mb-6" style={{ background: 'rgba(201,168,76,.2)' }} />

        {sent ? (
          <>
            {/* Envelope icon */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.2)' }}
            >
              <span style={{ fontSize: '22px' }}>✉</span>
            </div>

            <h2 className="font-serif font-light text-sand2 text-xl mb-2">Check your inbox.</h2>
            <p className="text-base text-mist leading-relaxed mb-1">
              We sent a sign-in link to
            </p>
            <p className="text-base font-medium text-sand mb-5 break-all">{email}</p>

            <div
              className="rounded-xl px-4 py-3.5 mb-5 text-left"
              style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.06)' }}
            >
              <p className="text-sm text-mist leading-relaxed">
                Click the link in the email to sign in — no password needed.<br />
                <span style={{ color: 'rgba(139,167,184,.6)' }}>
                  Didn&apos;t get it? Check your spam or junk folder. The link expires in 1 hour.
                </span>
              </p>
            </div>

            {/* Resend button */}
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendLoading}
              className="w-full py-3 rounded-xl text-base transition-all mb-3 disabled:cursor-not-allowed"
              style={{
                border: '1px solid rgba(201,168,76,.22)',
                color: resendDone ? 'var(--teal2)' : resendCooldown > 0 ? 'rgba(213,226,235,.65)' : 'var(--gold)',
                background: 'transparent',
                cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {resendLoading
                ? 'Sending…'
                : resendDone
                ? '✓ New link sent'
                : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend link →'}
            </button>

            {/* Use a different email */}
            <button
              onClick={() => { setSent(false); setResendCooldown(0); setResendDone(false) }}
              className="text-xs block mx-auto underline underline-offset-4 transition-colors hover:text-mist"
              style={{ color: 'rgba(213,226,235,.72)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <h2 className="font-serif font-light text-sand2 text-xl mb-2">Sign in to Soul Space</h2>
            <p className="text-base text-mist mb-6 leading-relaxed">
              No password. We&rsquo;ll send a sign-in link to your email.
            </p>
            {/* noValidate disables the browser's native red validation bubble (the "{}") */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl text-base text-sand2 focus:outline-none focus:border-gold/40 transition-colors"
                style={{
                  background: 'rgba(245,237,216,.04)',
                  border: '1px solid rgba(245,237,216,.08)',
                }}
              />
              {error && typeof error === 'string' && error.length > 0 && (
                <p className="text-xs leading-relaxed" style={{ color: 'var(--danger)' }}>{error}</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50">
                {loading ? 'Sending…' : 'Send sign-in link →'}
              </button>
            </form>
            <p className="text-base mt-4 leading-relaxed" style={{ color: 'rgba(213,226,235,.72)' }}>
              Your email is used only to send this link.<br />
              No marketing. No password. CPRA compliant.
            </p>
          </>
        )}

        <button
          onClick={() => router.push('/start')}
          className="text-xs mt-5 underline underline-offset-4 hover:text-mist transition-colors"
          style={{ color: 'rgba(213,226,235,.72)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Continue without signing in
        </button>
      </div>
    </main>
  )
}
