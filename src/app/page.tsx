'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { LoopPreview } from '@/components/ui/LoopPreview'
import { createClient } from '@/lib/supabase/client'

const EMOTIONAL_STATES = [
  "Something keeps pulling you back to a decision you thought you'd made.",
  "You know what you feel but can't quite explain why.",
  "You're not in crisis. But something isn't right.",
  "You've been carrying this alone for a while.",
]

const SCOPE_IS = [
  'The pause before the decision that changes things',
  'Specific to your emotional state when you arrive',
  'Seasonal emotional language — clinically reviewed, non-diagnostic',
  'Something real back from what you share — not generic',
]

const SCOPE_ISNOT = [
  'Therapy or a therapy substitute',
  'A crisis service — call 988 for immediate danger',
  'Diagnostic — no clinical conclusions or labels',
  'A chatbot, journaling tool, or meditation app',
]

const MIRROR_EXAMPLE = {
  carrying: 'Two real things in genuine tension. The decision keeps returning because neither has given way.',
  underneath: 'The urgency may be less about the decision itself — and more about not wanting to carry this weight any longer.',
  question: 'If the deadline disappeared entirely — would the conflict itself change, or would the same two things still be in tension?',
}

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

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-12 pb-16">
        <div className="eyebrow mb-4 justify-center">
          <span>Phase 1 · Behavior validation · April 2026</span>
        </div>

        <h1
          className="hero-heading font-serif font-light leading-tight mb-4 max-w-3xl"
          style={{ fontSize: 'clamp(26px, 5vw, 56px)', color: 'var(--sand2)' }}
        >
          The structured pause between<br />
          <em className="text-gold2">emotional overload</em> and consequential action.
        </h1>

        <p className="text-sm text-mist max-w-md mb-3 leading-loose">
          Not therapy. Not meditation. Not a budgeting app.<br />
          The pause before the decision that changes things.
        </p>
        <p className="font-serif italic mb-6" style={{ fontSize: '15px', color: 'rgba(139,167,184,.5)' }}>
          Whatever brought you here — you do not need to have it figured out yet.
        </p>

        {/* ── How it works — looping Affirm/Ask/Reflect preview ── */}
        <div className="mb-8 w-full">
          <LoopPreview />
        </div>

        {/* ── Auth-aware CTAs ── */}
        {isAuthenticated ? (
          /* Returning signed-in user */
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            {emailPrefix && (
              <p className="text-xs text-mist mb-1">
                Welcome back, <span className="text-sand">{emailPrefix}</span>.
              </p>
            )}
            <Link href="/dashboard" className="btn-primary text-sm px-8 py-3.5 w-full text-center">
              Go to your dashboard →
            </Link>
            <Link href="/age-gate" className="btn-outline text-sm px-8 py-3 w-full text-center">
              Begin a new session →
            </Link>
          </div>
        ) : isAuthenticated === false ? (
          /* New / signed-out visitor */
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <Link href="/age-gate" className="btn-primary text-sm px-8 py-3.5 w-full text-center">
              Begin your session →
            </Link>
            <Link href="/auth/signin" className="btn-outline text-sm px-8 py-3 w-full text-center">
              Sign in / Create account →
            </Link>
            <p className="text-xs mt-1" style={{ color: 'rgba(139,167,184,.4)' }}>
              Free to start · No account required · 3–5 minutes
            </p>
          </div>
        ) : (
          /* Loading state — neutral placeholder */
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <Link href="/age-gate" className="btn-primary text-sm px-8 py-3.5 w-full text-center">
              Begin your session →
            </Link>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(139,167,184,.35)' }}>
              Free to start · No account required · 3–5 minutes
            </p>
          </div>
        )}
      </section>

      {/* ── What you arrive with ── */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <div className="eyebrow mb-5">Right now, something feels like this</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EMOTIONAL_STATES.map((state, i) => (
            <div
              key={i}
              className="rounded-xl px-4 py-4 font-serif italic leading-relaxed"
              style={{
                border: '1px solid rgba(201,168,76,.12)',
                color: 'var(--sand)',
                fontSize: '14px',
                background: 'rgba(201,168,76,.02)',
              }}
            >
              &ldquo;{state}&rdquo;
            </div>
          ))}
        </div>
        <p className="text-sm text-mist mt-4 text-center">
          You tap one. Everything that follows adapts to your selection.
        </p>
      </section>

      {/* ── Mirror example ── */}
      <section className="px-6 py-16" style={{ background: 'rgba(15,30,46,.5)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="eyebrow mb-2">The Mirror — what it gives back</div>
          <p className="text-sm text-mist mb-6 leading-relaxed">
            Three short paragraphs. Specific to what you shared. Not generic. Not diagnostic.
          </p>
          <div className="mirror-card">
            <div className="mirror-label text-gold mb-2">What you&apos;re carrying</div>
            <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '15px', lineHeight: '1.8' }}>{MIRROR_EXAMPLE.carrying}</p>
          </div>
          <div className="mirror-card">
            <div className="mirror-label text-gold mb-2">What appears underneath</div>
            <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '15px', lineHeight: '1.8' }}>{MIRROR_EXAMPLE.underneath}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(42,140,122,.08)', border: '1px solid rgba(42,140,122,.2)' }}>
            <div className="mirror-label mb-2" style={{ color: 'var(--teal2)' }}>One question back to you</div>
            <p className="font-serif italic text-sand2 leading-snug" style={{ fontSize: '15px' }}>{MIRROR_EXAMPLE.question}</p>
          </div>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: 'rgba(139,167,184,.4)' }}>
            Descriptive only — not diagnostic. Clinically reviewed. Not therapy.
          </p>
        </div>
      </section>

      {/* ── Is / Is not ── */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <div className="eyebrow mb-4" style={{ color: 'var(--teal2)' }}>Soul Space is</div>
            {SCOPE_IS.map((item, i) => (
              <div key={i} className="flex items-start gap-2 mb-2.5">
                <span className="text-sm flex-shrink-0 mt-0.5" style={{ color: 'var(--teal2)' }}>✓</span>
                <span className="text-sm text-sand leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="eyebrow mb-4" style={{ color: 'rgba(212,64,64,.7)' }}>Soul Space is not</div>
            {SCOPE_ISNOT.map((item, i) => (
              <div key={i} className="flex items-start gap-2 mb-2.5">
                <span className="text-sm flex-shrink-0 mt-0.5" style={{ color: 'rgba(212,64,64,.6)' }}>✕</span>
                <span className="text-sm text-sand leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 py-20 text-center">
        <h2 className="font-serif font-light text-sand2 text-3xl mb-3 leading-tight">
          Does the first session<br /><em className="text-gold2">earn the second?</em>
        </h2>
        <p className="text-sm text-mist mb-8 max-w-sm mx-auto leading-relaxed">
          Phase 1 goal: prove that one session creates enough value and trust to earn a return visit.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link href="/age-gate" className="btn-primary text-sm px-8 py-3.5">
            Begin →
          </Link>
          {isAuthenticated === false && (
            <Link href="/auth/signin" className="btn-outline text-sm px-8 py-3.5">
              Sign in →
            </Link>
          )}
          {isAuthenticated === true && (
            <Link href="/dashboard" className="btn-outline text-sm px-8 py-3.5">
              Your dashboard →
            </Link>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-8 py-8 text-center"
        style={{ borderTop: '1px solid rgba(245,237,216,.04)' }}
      >
        <p className="font-serif font-light text-sand2 text-sm mb-1">
          Soul <em className="not-italic text-gold font-normal">Space</em>
        </p>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
          Affirm. Ask. Reflect. · Non-clinical · Non-diagnostic · Not a crisis service<br />
          If you are in immediate danger, call or text 988.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-4">
          {isAuthenticated ? (
            <Link href="/dashboard" className="text-xs text-mist/50 hover:text-mist transition-colors">Dashboard</Link>
          ) : (
            <Link href="/auth/signin" className="text-xs text-mist/50 hover:text-mist transition-colors">Sign in</Link>
          )}
          <span className="text-xs" style={{ color: 'rgba(139,167,184,.2)' }}>·</span>
          <Link href="/pricing" className="text-xs text-mist/50 hover:text-mist transition-colors">Pricing</Link>
          <span className="text-xs" style={{ color: 'rgba(139,167,184,.2)' }}>·</span>
          <Link href="/settings" className="text-xs text-mist/50 hover:text-mist transition-colors">Settings</Link>
          <span className="text-xs" style={{ color: 'rgba(139,167,184,.2)' }}>·</span>
          <Link href="/crisis" className="text-xs text-mist/50 hover:text-mist transition-colors">Crisis resources</Link>
        </div>
      </footer>
    </main>
  )
}
