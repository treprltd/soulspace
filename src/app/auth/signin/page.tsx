'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

export default function SignIn() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
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
              The link expires in 1 hour.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-serif font-light text-sand2 text-xl mb-2">Sign in to Soul Space</h2>
            <p className="text-xs text-mist mb-6 leading-relaxed">
              No password. We&rsquo;ll send a link to your email.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full focus:outline-none transition-colors"
                style={{
                  padding: '14px 16px',
                  fontSize: '15px',
                  lineHeight: 1.4,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--sand)',
                  borderRadius: '10px',
                  background: 'rgba(245,237,216,.04)',
                  border: '1px solid rgba(245,237,216,.18)',
                  boxSizing: 'border-box',
                  width: '100%',
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
