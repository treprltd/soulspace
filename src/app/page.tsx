'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'

// A single real Mirror example — the fastest way for a first-time visitor
// (or a professor evaluating the tool) to understand what Soul Space gives
// back. Descriptive only, never diagnostic or prescriptive (CLAUDE.md rule #1).
const MIRROR_EXAMPLE = {
  carrying: 'Two real things in genuine tension. The decision keeps returning because neither has given way.',
  underneath: 'The urgency may be less about the decision itself — and more about not wanting to carry this weight any longer.',
  question: 'If the deadline disappeared entirely — would the conflict itself change, or would the same two things still be in tension?',
}

// Credibility signals — the numbers shown are ones we can stand behind:
// the 4.48/5 average is computed from real in-app ratings; the 300+ figure
// is from the separate pre-launch survey.
const TRUST = [
  { value: '300+', label: 'Survey responses shaping the design' },
  { value: '4.48 / 5', label: 'Average rating from early users' },
  { value: 'Dr. Sofia Georgiadou', label: 'Psychologist — early concept consultation' },
  { value: 'NVIDIA Inception', label: 'Program member' },
]

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [emailPrefix, setEmailPrefix] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user)
      if (user?.email) setEmailPrefix(user.email.split('@')[0])
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session?.user)
      if (session?.user?.email) setEmailPrefix(session.user.email.split('@')[0])
      else if (!session) setEmailPrefix('')
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />

      {/* ── Hero — one clear value proposition, one call to action ── */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-16 max-w-2xl mx-auto">
        <div className="eyebrow mb-6 justify-center rise-in">
          <span>Guided emotional reflection</span>
        </div>

        <h1
          className="font-serif font-light leading-tight mb-6 rise-in-1"
          style={{ fontSize: 'clamp(36px, 8vw, 68px)', color: 'var(--sand2)' }}
        >
          Understand what you feel —<br />
          <em className="text-gold2">before you act on it.</em>
        </h1>

        <p className="text-lg text-sand max-w-lg mb-10 leading-relaxed rise-in-2">
          Soul Space is a private, guided space for emotional reflection. Take a few
          quiet minutes, and get back a clearer view of what&apos;s really going on inside.
        </p>

        {isAuthenticated ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm rise-in-3">
            {emailPrefix && (
              <p className="text-sm text-mist">
                Welcome back, <span className="text-sand">{emailPrefix}</span>.
              </p>
            )}
            <Link href="/dashboard" className="btn-primary px-10 py-4 w-full text-center">
              Go to your dashboard →
            </Link>
            <Link href="/age-gate" className="btn-outline px-10 py-3.5 w-full text-center">
              Try another reflection →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm rise-in-3">
            <Link href="/age-gate" className="btn-primary px-10 py-4 w-full text-center">
              Try a free reflection →
            </Link>
            <p className="text-sm" style={{ color: 'rgba(213,226,235,.55)' }}>
              Free · No account needed · 3–5 minutes
            </p>
          </div>
        )}
      </section>

      {/* ── Credibility band — trust before the ask ── */}
      <section className="px-6 py-14" style={{ background: 'rgba(15,30,46,.5)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
            {TRUST.map((t) => (
              <div key={t.value} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="font-serif text-gold2 leading-none mb-2" style={{ fontSize: '26px' }}>
                  {t.value}
                </div>
                <div className="text-base leading-relaxed" style={{ color: 'rgba(213,226,235,.7)' }}>
                  {t.label}
                </div>
              </div>
            ))}
          </div>
          <p className="text-base text-center mt-12 max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(213,226,235,.62)' }}>
            Built from lived experience, research, and years of studying human behavior.
          </p>
        </div>
      </section>

      {/* ── What you get — show the product, plainly ── */}
      <section className="px-6 py-20 max-w-2xl mx-auto">
        <h2 className="font-serif font-light text-sand2 mb-3 leading-tight" style={{ fontSize: 'clamp(26px, 5vw, 38px)' }}>
          A clearer reflection back
        </h2>
        <p className="text-base text-mist mb-8 leading-relaxed">
          After a few gentle questions, you get one short &ldquo;Mirror&rdquo; — specific to what
          you shared. Not advice. Not a diagnosis. Just what seems to be underneath.
        </p>

        <div className="mirror-card card-lift">
          <div className="mirror-label text-gold mb-2">What you&apos;re carrying</div>
          <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '22px', lineHeight: '1.8' }}>
            {MIRROR_EXAMPLE.carrying}
          </p>
        </div>
        <div className="mirror-card card-lift">
          <div className="mirror-label text-gold mb-2">What appears underneath</div>
          <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '22px', lineHeight: '1.8' }}>
            {MIRROR_EXAMPLE.underneath}
          </p>
        </div>
        <div className="rounded-xl p-5 card-lift" style={{ background: 'rgba(42,140,122,.08)', border: '1px solid rgba(42,140,122,.2)' }}>
          <div className="mirror-label mb-2" style={{ color: 'var(--teal2)' }}>One question back to you</div>
          <p className="font-serif italic text-sand2 leading-snug" style={{ fontSize: '22px' }}>
            {MIRROR_EXAMPLE.question}
          </p>
        </div>
      </section>

      {/* ── What Soul Space is — and is not ── */}
      <section className="px-6 py-16">
        <div
          className="max-w-2xl mx-auto rounded-2xl px-8 py-10 text-center"
          style={{ background: 'rgba(15,30,46,.5)', border: '1px solid rgba(245,237,216,.06)' }}
        >
          <p className="font-serif text-sand2 leading-relaxed mb-4" style={{ fontSize: 'clamp(22px, 4.5vw, 30px)' }}>
            Soul Space is <em className="text-gold2">not</em> therapy, diagnosis, or crisis care.
          </p>
          <p className="text-base leading-relaxed max-w-lg mx-auto" style={{ color: 'rgba(213,226,235,.7)' }}>
            It is a guided space for emotional reflection — a calm, structured pause between
            what you feel and what you decide to do next. If you are in immediate danger,
            please call or text&nbsp;988.
          </p>
        </div>
      </section>

      {/* ── Closing CTA — one action, calm ── */}
      <section className="px-6 py-20 text-center">
        <h2 className="font-serif font-light text-sand2 mb-6 leading-tight" style={{ fontSize: 'clamp(28px, 5.5vw, 42px)' }}>
          Take a few quiet minutes
          <br /><em className="text-gold2">for yourself.</em>
        </h2>
        <div className="flex justify-center">
          {isAuthenticated ? (
            <Link href="/dashboard" className="btn-primary px-10 py-4">
              Go to your dashboard →
            </Link>
          ) : (
            <Link href="/age-gate" className="btn-primary px-10 py-4">
              Try a free reflection →
            </Link>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-8 py-10 text-center"
        style={{ borderTop: '1px solid rgba(245,237,216,.04)' }}
      >
        <p className="font-serif font-light text-sand2 mb-2" style={{ fontSize: '21px' }}>
          Soul <em className="not-italic text-gold font-normal">Space</em>
        </p>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(213,226,235,.5)' }}>
          Guided emotional reflection · Non-clinical · Non-diagnostic · Not a crisis service<br />
          Encrypted at rest · No third-party tracking · AI processing, not AI training<br />
          If you are in immediate danger, call or text 988.
        </p>
        <div className="flex flex-wrap gap-5 justify-center mt-5">
          {isAuthenticated ? (
            <Link href="/dashboard" className="text-sm text-mist/80 hover:text-mist transition-colors">Dashboard</Link>
          ) : (
            <Link href="/auth/signin" className="text-sm text-mist/80 hover:text-mist transition-colors">Sign in</Link>
          )}
          <span className="text-sm" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/pricing" className="text-sm text-mist/80 hover:text-mist transition-colors">Pricing</Link>
          <span className="text-sm" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/settings" className="text-sm text-mist/80 hover:text-mist transition-colors">Settings</Link>
          <span className="text-sm" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/contact" className="text-sm text-mist/80 hover:text-mist transition-colors">Contact</Link>
          <span className="text-sm" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/privacy" className="text-sm text-mist/80 hover:text-mist transition-colors">Privacy</Link>
          <span className="text-sm" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/crisis" className="text-sm text-mist/80 hover:text-mist transition-colors">Crisis resources</Link>
        </div>
      </footer>
    </main>
  )
}
