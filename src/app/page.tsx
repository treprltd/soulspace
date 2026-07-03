'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'

const EMOTIONAL_STATES = [
  {
    phrase: "Something keeps pulling you back to a decision you thought you'd made.",
    response: "That kind of pull is its own kind of tiring — and it makes sense that going over it again hasn't settled it.",
  },
  {
    phrase: "You know what you feel but can't quite explain why.",
    response: "A feeling can have a shape long before it has a name. That's already something to start from.",
  },
  {
    phrase: "You're not in crisis. But something isn't right.",
    response: "Noticing that something isn't right is its own kind of clarity — it doesn't need a label to matter.",
  },
  {
    phrase: "You've been carrying this alone for a while.",
    response: 'Carrying something alone for a while is its own particular weight. Naming that, even quietly, is a start.',
  },
]

const MIRROR_EXAMPLE = {
  carrying: 'Two real things in genuine tension. The decision keeps returning because neither has given way.',
  underneath: 'The urgency may be less about the decision itself — and more about not wanting to carry this weight any longer.',
  question: 'If the deadline disappeared entirely — would the conflict itself change, or would the same two things still be in tension?',
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [emailPrefix, setEmailPrefix] = useState('')
  const [selectedState, setSelectedState] = useState<number | null>(null)

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

      {/* ── Hero + Resonance — one unified above-fold section ── */}
      <section className="flex flex-col items-center text-center px-6 pt-12 pb-16 max-w-2xl mx-auto">
        <div className="eyebrow mb-4 justify-center">
          <span>Early beta · Feedback wanted</span>
        </div>

        <h1
          className="font-serif font-light leading-tight mb-4 max-w-xl"
          style={{ fontSize: 'clamp(26px, 4.5vw, 52px)', color: 'var(--sand2)' }}
        >
          Try one private reflection.<br />
          <em className="text-gold2">Help shape Soul Space.</em>
        </h1>

        <p className="text-base text-sand max-w-md mb-10 leading-relaxed">
          A 3–5 minute reflection for the moment before an emotionally heavy decision.
        </p>

        {/* ── Resonance cards — the experience starts here ── */}
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'rgba(213,226,235,.4)' }}>
          Does any of this feel familiar?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-4">
          {EMOTIONAL_STATES.map((state, i) => {
            const isSelected = selectedState === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedState(isSelected ? null : i)}
                aria-pressed={isSelected}
                className="text-left rounded-xl px-4 py-4 font-serif italic leading-relaxed transition-all cursor-pointer"
                style={{
                  border: `1px solid ${isSelected ? 'var(--gold)' : 'rgba(201,168,76,.16)'}`,
                  color: isSelected ? 'var(--gold3)' : 'var(--sand)',
                  fontSize: '14px',
                  background: isSelected ? 'rgba(201,168,76,.07)' : 'rgba(201,168,76,.02)',
                }}
              >
                &ldquo;{state.phrase}&rdquo;
              </button>
            )
          })}
        </div>

        {/* Response — appears after a card is tapped */}
        {selectedState !== null && (
          <div
            className="w-full mb-6 rounded-xl px-5 py-4 animate-fade-in text-left"
            style={{ border: '1px solid rgba(42,140,122,.22)', background: 'rgba(42,140,122,.06)' }}
          >
            <p className="font-serif italic leading-relaxed" style={{ fontSize: '14px', color: 'var(--sand2)' }}>
              {EMOTIONAL_STATES[selectedState].response}
            </p>
          </div>
        )}

        {/* ── Auth-aware CTA ── */}
        {isAuthenticated ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-2">
            {emailPrefix && (
              <p className="text-xs text-mist">
                Welcome back, <span className="text-sand">{emailPrefix}</span>.
              </p>
            )}
            <Link href="/dashboard" className="btn-primary text-sm px-8 py-3.5 w-full text-center">
              Go to your dashboard →
            </Link>
            <Link href="/age-gate" className="btn-outline text-sm px-8 py-3 w-full text-center">
              Try another reflection →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 w-full max-w-xs mt-2">
            <Link href="/age-gate" className="btn-primary text-sm px-8 py-3.5 w-full text-center">
              {selectedState !== null ? 'See where this leads →' : 'Try one free reflection →'}
            </Link>
            <p className="text-xs mt-1" style={{ color: 'rgba(213,226,235,.45)' }}>
              Free · No account required · 3–5 minutes
            </p>
          </div>
        )}
      </section>

      {/* ── Mirror example — show the product, don't explain it ── */}
      <section className="px-6 py-16" style={{ background: 'rgba(15,30,46,.5)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="eyebrow mb-2">What you get back</div>
          <p className="text-sm text-mist mb-6 leading-relaxed">
            Three short paragraphs. Specific to what you shared. Not generic. Not diagnostic.
          </p>
          <div className="mirror-card">
            <div className="mirror-label text-gold mb-2">What you&apos;re carrying</div>
            <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '15px', lineHeight: '1.8' }}>
              {MIRROR_EXAMPLE.carrying}
            </p>
          </div>
          <div className="mirror-card">
            <div className="mirror-label text-gold mb-2">What appears underneath</div>
            <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '15px', lineHeight: '1.8' }}>
              {MIRROR_EXAMPLE.underneath}
            </p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(42,140,122,.08)', border: '1px solid rgba(42,140,122,.2)' }}>
            <div className="mirror-label mb-2" style={{ color: 'var(--teal2)' }}>One question back to you</div>
            <p className="font-serif italic text-sand2 leading-snug" style={{ fontSize: '15px' }}>
              {MIRROR_EXAMPLE.question}
            </p>
          </div>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: 'rgba(213,226,235,.5)' }}>
            Descriptive only. Reviewed for emotional safety. Not therapy, diagnosis, or crisis care.
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 py-20 text-center">
        <h2 className="font-serif font-light text-sand2 text-3xl mb-3 leading-tight">
          Did one reflection feel useful<br />
          <em className="text-gold2">enough to try again?</em>
        </h2>
        <p className="text-sm text-mist mb-8 max-w-sm mx-auto leading-relaxed">
          Our beta goal: learn whether one short reflection feels clear, safe, and useful enough to return.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link href="/age-gate" className="btn-primary text-sm px-8 py-3.5">
            Try one reflection →
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
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(213,226,235,.48)' }}>
          Affirm. Ask. Reflect. · Non-clinical · Non-diagnostic · Not a crisis service<br />
          Encrypted at rest · No third-party tracking · AI processing, not AI training<br />
          If you are in immediate danger, call or text 988.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-4">
          {isAuthenticated ? (
            <Link href="/dashboard" className="text-xs text-mist/80 hover:text-mist transition-colors">Dashboard</Link>
          ) : (
            <Link href="/auth/signin" className="text-xs text-mist/80 hover:text-mist transition-colors">Sign in</Link>
          )}
          <span className="text-xs" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/pricing" className="text-xs text-mist/80 hover:text-mist transition-colors">Pricing</Link>
          <span className="text-xs" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/settings" className="text-xs text-mist/80 hover:text-mist transition-colors">Settings</Link>
          <span className="text-xs" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/contact" className="text-xs text-mist/80 hover:text-mist transition-colors">Contact</Link>
          <span className="text-xs" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/privacy" className="text-xs text-mist/80 hover:text-mist transition-colors">Privacy</Link>
          <span className="text-xs" style={{ color: 'rgba(213,226,235,.56)' }}>·</span>
          <Link href="/crisis" className="text-xs text-mist/80 hover:text-mist transition-colors">Crisis resources</Link>
        </div>
      </footer>
    </main>
  )
}
