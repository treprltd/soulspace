import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

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
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Marketing nav — 64px, 28px padding */}
      <nav
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          borderBottom: '1px solid var(--hairline)',
          position: 'sticky',
          top: 0,
          background: 'rgba(8,17,28,.98)',
          zIndex: 10,
        }}
      >
        <Logo size="md" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link
            href="/settings"
            style={{ fontSize: '14px', color: 'var(--mist)', textDecoration: 'none' }}
          >
            Settings
          </Link>
          <Link href="/age-gate" className="btn-primary" style={{ fontSize: '14px', fontWeight: 700, padding: '10px 20px' }}>
            Begin →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '96px 24px 80px',
        }}
      >
        <div className="eyebrow" style={{ marginBottom: '20px', justifyContent: 'center' }}>
          Phase 1 · Behavior validation · April 2026
        </div>

        <h1
          className="h-display"
          style={{ maxWidth: '720px', marginBottom: '16px' }}
        >
          The structured pause between<br />
          <em>emotional overload</em> and consequential action.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            color: 'var(--mist)',
            maxWidth: '400px',
            marginBottom: '12px',
            lineHeight: 1.7,
          }}
        >
          Not therapy. Not meditation. Not a budgeting app.<br />
          The pause before the decision that changes things.
        </p>

        <p className="affirm-copy" style={{ marginBottom: '32px' }}>
          Whatever brought you here — you do not need to have it figured out yet.
        </p>

        <Link href="/age-gate" className="btn-primary" style={{ padding: '14px 32px', fontSize: '14px' }}>
          Begin your session →
        </Link>

        <p style={{ fontSize: 'var(--fs-3xs)', marginTop: '12px', color: 'var(--mist-35)' }}>
          Free · No account required · 3–5 minutes
        </p>
      </section>

      {/* What you arrive with */}
      <section style={{ padding: '64px 24px', maxWidth: '720px', margin: '0 auto' }}>
        <div className="eyebrow" style={{ marginBottom: '20px' }}>
          Right now, something feels like this
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
          }}
        >
          {EMOTIONAL_STATES.map((state, i) => (
            <div
              key={i}
              style={{
                borderRadius: 'var(--r-lg)',
                padding: '14px 16px',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                lineHeight: 1.5,
                border: '1px solid var(--gold-12)',
                color: 'var(--sand)',
                fontSize: '16px',
                background: 'var(--gold-04)',
              }}
            >
              &ldquo;{state}&rdquo;
            </div>
          ))}
        </div>
        <p
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--mist)',
            marginTop: '16px',
            textAlign: 'center',
          }}
        >
          You tap one. Everything that follows adapts to your selection.
        </p>
      </section>

      {/* Mirror example */}
      <section
        style={{
          padding: '64px 24px',
          background: 'rgba(15,30,46,.5)',
        }}
      >
        <div style={{ maxWidth: '672px', margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: '8px' }}>
            The Mirror — what it gives back
          </div>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--mist)', marginBottom: '24px', lineHeight: 1.7 }}>
            Three short paragraphs. Specific to what you shared. Not generic. Not diagnostic.
          </p>

          {/* Carrying */}
          <div className="mirror-card">
            <div className="micro-label" style={{ marginBottom: '8px' }}>What you&apos;re carrying</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--sand)', lineHeight: 1.5, fontSize: '16px' }}>
              {MIRROR_EXAMPLE.carrying}
            </p>
          </div>

          {/* Underneath */}
          <div className="mirror-card">
            <div className="micro-label" style={{ marginBottom: '8px' }}>What appears underneath</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--sand)', lineHeight: 1.5, fontSize: '16px' }}>
              {MIRROR_EXAMPLE.underneath}
            </p>
          </div>

          {/* Question */}
          <div
            style={{
              borderRadius: 'var(--r-lg)',
              padding: '14px',
              background: 'rgba(42,140,122,.08)',
              border: '1px solid rgba(42,140,122,.20)',
            }}
          >
            <div
              className="micro-label"
              style={{ marginBottom: '8px', color: 'var(--teal2)' }}
            >
              One question back to you
            </div>
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--sand2)', lineHeight: 1.5, fontSize: '16px' }}>
              {MIRROR_EXAMPLE.question}
            </p>
          </div>

          <p style={{ fontSize: 'var(--fs-3xs)', marginTop: '12px', lineHeight: 1.6, color: 'var(--mist-35)' }}>
            Descriptive only — not diagnostic. Clinically reviewed. Not therapy.
          </p>
        </div>
      </section>

      {/* Is / Is not */}
      <section style={{ padding: '64px 24px', maxWidth: '720px', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '32px',
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: '16px', color: 'var(--teal2)' }}>
              Soul Space is
            </div>
            {SCOPE_IS.map((item, i) => (
              <div key={i} className="scope-row">
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--teal2)', flexShrink: 0, marginTop: '2px' }}>✓</span>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--sand)', lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: '16px', color: 'rgba(212,64,64,.7)' }}>
              Soul Space is not
            </div>
            {SCOPE_ISNOT.map((item, i) => (
              <div key={i} className="scope-row">
                <span style={{ fontSize: 'var(--fs-sm)', color: 'rgba(212,64,64,.6)', flexShrink: 0, marginTop: '2px' }}>✕</span>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--sand)', lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 300,
            fontSize: 'var(--fs-h2)',
            color: 'var(--sand2)',
            marginBottom: '12px',
            lineHeight: 1.2,
          }}
        >
          Does the first session<br />
          <em style={{ color: 'var(--gold2)' }}>earn the second?</em>
        </h2>
        <p
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--mist)',
            marginBottom: '24px',
            maxWidth: '360px',
            margin: '0 auto 24px',
            lineHeight: 1.7,
          }}
        >
          Phase 1 goal: prove that one session creates enough value and trust to earn a return visit.
        </p>
        <Link href="/age-gate" className="btn-primary" style={{ padding: '14px 32px', fontSize: '14px' }}>
          Begin →
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '32px',
          textAlign: 'center',
          borderTop: '1px solid var(--hairline)',
        }}
      >
        <Logo size="sm" />
        <p style={{ fontSize: 'var(--fs-3xs)', marginTop: '12px', lineHeight: 1.7, color: 'var(--mist-35)' }}>
          Affirm. Ask. Reflect. · Non-clinical · Non-diagnostic · Not a crisis service<br />
          If you are in immediate danger, call or text 988.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px', alignItems: 'center' }}>
          <Link href="/settings" style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist-55)', textDecoration: 'none' }}>
            Settings
          </Link>
          <span style={{ fontSize: 'var(--fs-3xs)', color: 'rgba(139,167,184,.52)' }}>·</span>
          <Link href="/crisis" style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist-55)', textDecoration: 'none' }}>
            Crisis resources
          </Link>
        </div>
      </footer>

    </main>
  )
}
