'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { LoopPreview } from '@/components/ui/LoopPreview'
import { HowItWorks } from '@/components/ui/HowItWorks'
import { createClient } from '@/lib/supabase/client'

// Each state pairs the existing resonance phrase with a short, affirming
// response — descriptive only, never diagnostic or prescriptive (CLAUDE.md
// rule #1). Tapping one is a low-stakes way for a first-time visitor to feel
// "seen" before committing to a full session — a small mirror of the same
// Affirm → Ask shape the product itself uses.
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

      {/* ── Hero ──
          Layout note: the primary CTAs ("Begin your session →",
          "Sign in / Create account →", and the "Free to start · No account
          required · 3–5 minutes" line) must be visible in the viewport on
          initial load without scrolling. They previously sat BELOW the
          LoopPreview animation, which — combined with generous top/bottom
          padding and margins — pushed them off-screen on common laptop/phone
          viewport heights. Fix: render the CTA block immediately after the
          affirmation copy (right where a visitor's eye lands first) and move
          the LoopPreview below it, plus trim the section's vertical rhythm
          (padding/margins) so the whole block fits comfortably above the fold. */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-8 pb-10">
        <div className="eyebrow mb-3 justify-center">
          <span>Phase 1 · Behavior validation · April 2026</span>
        </div>

        <h1
          className="hero-heading font-serif font-light leading-tight mb-3 max-w-3xl"
          style={{ fontSize: 'clamp(24px, 4.5vw, 56px)', color: 'var(--sand2)' }}
        >
          The structured pause between<br />
          <em className="text-gold2">emotional overload</em> and consequential action.
        </h1>

        <p className="text-sm text-mist max-w-md mb-2 leading-loose">
          Not therapy. Not meditation. Not a budgeting app.<br />
          The pause before the decision that changes things.
        </p>
        <p className="font-serif italic mb-5" style={{ fontSize: '15px', color: 'rgba(213,226,235,.74)' }}>
          Whatever brought you here — you do not need to have it figured out yet.
        </p>

        {/* ── Auth-aware CTAs — kept directly under the affirmation copy so
              they land above the fold on first paint ── */}
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
            <p className="text-xs mt-1" style={{ color: 'rgba(213,226,235,.66)' }}>
              Free to start · No account required · 3–5 minutes
            </p>
          </div>
        ) : (
          /* Loading state — neutral placeholder */
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <Link href="/age-gate" className="btn-primary text-sm px-8 py-3.5 w-full text-center">
              Begin your session →
            </Link>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(213,226,235,.62)' }}>
              Free to start · No account required · 3–5 minutes
            </p>
          </div>
        )}

        {/* ── How it works — looping Affirm/Ask/Reflect preview ──
              Moved below the CTAs: still the first thing visible on scroll,
              but no longer competing with the CTAs for above-the-fold space. */}
        <div className="mt-8 w-full">
          <LoopPreview />
        </div>
      </section>

      {/* ── What you arrive with — now tappable ──
            Lets a first-time visitor try a miniature version of the Affirm →
            Ask shape before committing to a full session: tap the phrase that
            feels closest, and a short, non-diagnostic response appears beneath
            it (see EMOTIONAL_STATES — every response is descriptive, never
            prescriptive, per CLAUDE.md rule #1). This is presentational only;
            it does not feed into or alter the actual session flow. */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <div className="eyebrow mb-2">Right now, something feels like this</div>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: 'rgba(213,226,235,.62)' }}>
          Tap whichever feels closest. No wrong answer — this isn&apos;t being saved or scored.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

        {/* Response — appears only after a tap; affirming, not diagnostic */}
        {selectedState !== null && (
          <div
            className="mt-4 rounded-xl px-5 py-4 animate-fade-in"
            style={{ border: '1px solid rgba(42,140,122,.22)', background: 'rgba(42,140,122,.06)' }}
          >
            <p className="font-serif italic leading-relaxed mb-3" style={{ fontSize: '14px', color: 'var(--sand2)' }}>
              {EMOTIONAL_STATES[selectedState].response}
            </p>
            <Link
              href="/age-gate"
              className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--teal2)' }}
            >
              See where this leads — begin a session →
            </Link>
          </div>
        )}

        <p className="text-sm mt-4 text-center" style={{ color: 'rgba(213,226,235,.6)' }}>
          Tap one. Everything that follows in a real session adapts to your selection.
        </p>
      </section>

      {/* ── How it works — illustrated walkthrough ──
            A slower, more legible companion to the looping hero preview —
            see src/components/ui/HowItWorks.tsx for the full rationale. */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <div className="eyebrow mb-2 justify-center">How a session unfolds</div>
        <p className="text-sm mb-10 text-center max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(213,226,235,.64)' }}>
          Three short movements. No account needed to try the first one.
        </p>
        <HowItWorks />
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
          <p className="text-xs mt-3 leading-relaxed" style={{ color: 'rgba(213,226,235,.66)' }}>
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
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(213,226,235,.62)' }}>
          Affirm. Ask. Reflect. · Non-clinical · Non-diagnostic · Not a crisis service<br />
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
          <Link href="/crisis" className="text-xs text-mist/80 hover:text-mist transition-colors">Crisis resources</Link>
        </div>
      </footer>
    </main>
  )
}
