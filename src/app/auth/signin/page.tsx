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
            <h2 className="font-serif font-light text-sand2 text-xl mb-3">Check your email.</h2>
            <p className="text-sm text-mist leading-relaxed">
              We sent a link to <strong className="text-sand">{email}</strong>.<br />
              Click it to sign in — no password needed.
            </p>
            <p className="text-[9px] mt-4" style={{ color: 'rgba(139,167,184,.4)' }}>
              The link expires in 1 hour. Check spam if you don&apos;t see it.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-[9px] mt-4 underline underline-offset-4 block mx-auto"
              style={{ color: 'rgba(139,167,184,.4)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Try a different email
            </button>
          </>
        ) : (
          <>
            <h2 className="font-serif font-light text-sand2 text-xl mb-2">Sign in to Soul Space</h2>
            <p className="text-xs text-mist mb-6 leading-relaxed">
              No password. We&rsquo;ll send a magic link to your email.<br />
              New here? It creates your account automatically.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl text-sm text-sand2 focus:outline-none focus:border-gold/40 transition-colors"
                style={{
                  background: 'rgba(245,237,216,.04)',
                  border: '1px solid rgba(245,237,216,.08)',
                }}
              />
              {error && <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
                {loading ? 'Sending…' : 'Send sign-in link →'}
              </button>
            </form>
            <p className="text-[9px] mt-4 leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
              Your email is used only to send this link.<br />
              No marketing. No password. CPRA compliant.
            </p>
          </>
        )}

        <button
          onClick={() => router.push('/start')}
          className="text-[9px] mt-4 underline underline-offset-4"
          style={{ color: 'rgba(139,167,184,.4)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Continue without signing in
        </button>
      </div>
    </main>
  )
}
