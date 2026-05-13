// Marketing landing-page sections. Verbatim copy from src/app/page.tsx.

const EMOTIONAL_STATES = [
  "Something keeps pulling you back to a decision you thought you'd made.",
  "You know what you feel but can't quite explain why.",
  "You're not in crisis. But something isn't right.",
  "You've been carrying this alone for a while.",
];
const SCOPE_IS = [
  'The pause before the decision that changes things',
  'Specific to your emotional state when you arrive',
  'Seasonal emotional language — clinically reviewed, non-diagnostic',
  'Something real back from what you share — not generic',
];
const SCOPE_ISNOT = [
  'Therapy or a therapy substitute',
  'A crisis service — call 988 for immediate danger',
  'Diagnostic — no clinical conclusions or labels',
  'A chatbot, journaling tool, or meditation app',
];
const MIRROR_EXAMPLE = {
  carrying: 'Two real things in genuine tension. The decision keeps returning because neither has given way.',
  underneath: 'The urgency may be less about the decision itself — and more about not wanting to carry this weight any longer.',
  question: 'If the deadline disappeared entirely — would the conflict itself change, or would the same two things still be in tension?',
};

function Hero({ onBegin }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '96px 24px 80px' }}>
      <Eyebrow centered>Phase 1 · Behavior validation · April 2026</Eyebrow>
      <h1 style={{
        fontFamily: 'var(--font-serif)', fontWeight: 300,
        lineHeight: 1.1, margin: '16px 0 16px',
        fontSize: 'clamp(32px, 5vw, 58px)', color: 'var(--sand2)', maxWidth: 760,
      }}>
        The structured pause between<br/>
        <em style={{ color: 'var(--gold2)' }}>emotional overload</em> and consequential action.
      </h1>
      <p style={{ fontSize: 17, color: 'var(--mist)', maxWidth: 520, marginBottom: 16, lineHeight: 1.7 }}>
        Not therapy. Not meditation. Not a budgeting app.<br/>
        The pause before the decision that changes things.
      </p>
      <Affirm style={{ marginBottom: 32, fontSize: 17 }}>Whatever brought you here — you do not need to have it figured out yet.</Affirm>
      <button onClick={onBegin} className="btn-primary" style={{ padding: '16px 36px', fontSize: 15 }}>Begin your session →</button>
      <p style={{ fontSize: 13, color: 'rgba(139,167,184,.55)', marginTop: 14 }}>
        Free · No account required · 3–5 minutes
      </p>
    </section>
  );
}

function ResonanceShowcase() {
  return (
    <section style={{ padding: '64px 24px', maxWidth: 720, margin: '0 auto' }}>
      <Eyebrow>Right now, something feels like this</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 20 }}>
        {EMOTIONAL_STATES.map((s, i) => (
          <div key={i} style={{
            borderRadius: 12, padding: 20,
            border: '1px solid rgba(201,168,76,.12)',
            background: 'rgba(201,168,76,.02)',
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            fontSize: 18, color: 'var(--sand)', lineHeight: 1.5,
          }}>“{s}”</div>
        ))}
      </div>
      <p style={{ fontSize: 15, color: 'var(--mist)', textAlign: 'center', marginTop: 20 }}>
        You tap one. Everything that follows adapts to your selection.
      </p>
    </section>
  );
}

function MirrorExample() {
  return (
    <section style={{ padding: '64px 24px', background: 'rgba(15,30,46,.5)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Eyebrow>The Mirror — what it gives back</Eyebrow>
        <p style={{ fontSize: 15, color: 'var(--mist)', margin: '14px 0 28px', lineHeight: 1.6 }}>
          Three short paragraphs. Specific to what you shared. Not generic. Not diagnostic.
        </p>
        {['carrying', 'underneath'].map(k => (
          <div key={k} style={{
            background: 'var(--ink2)', borderRadius: 12, padding: 16, marginBottom: 10,
            border: '1px solid rgba(201,168,76,.1)',
          }}>
            <div style={{ fontSize: 7, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
              {k === 'carrying' ? "What you're carrying" : 'What appears underneath'}
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--sand)', lineHeight: 1.55, fontSize: 17 }}>
              {MIRROR_EXAMPLE[k]}
            </p>
          </div>
        ))}
        <div style={{ borderRadius: 12, padding: 16, background: 'rgba(42,140,122,.08)', border: '1px solid rgba(42,140,122,.2)' }}>
          <div style={{ fontSize: 7, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--teal2)', marginBottom: 8 }}>
            One question back to you
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--sand2)', lineHeight: 1.45, fontSize: 17 }}>
            {MIRROR_EXAMPLE.question}
          </p>
        </div>
      </div>
    </section>
  );
}

function ScopeIsIsNot() {
  return (
    <section style={{ padding: '64px 24px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 32 }}>
        <div>
          <Eyebrow color="var(--teal2)">Soul Space is</Eyebrow>
          <div style={{ marginTop: 16 }}>
            {SCOPE_IS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 15, color: 'var(--teal2)', marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 15, color: 'var(--sand)', lineHeight: 1.55 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Eyebrow color="rgba(212,64,64,.7)">Soul Space is not</Eyebrow>
          <div style={{ marginTop: 16 }}>
            {SCOPE_ISNOT.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 15, color: 'rgba(212,64,64,.7)', marginTop: 1 }}>✕</span>
                <span style={{ fontSize: 15, color: 'var(--sand)', lineHeight: 1.55 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingCTA({ onBegin }) {
  return (
    <section style={{ padding: '80px 24px', textAlign: 'center' }}>
      <h2 style={{
        fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)',
        fontSize: 32, lineHeight: 1.15, margin: '0 0 12px',
      }}>
        Does the first session<br/>
        <em style={{ color: 'var(--gold2)' }}>earn the second?</em>
      </h2>
      <p style={{ fontSize: 16, color: 'var(--mist)', maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.6 }}>
        Phase 1 goal: prove that one session creates enough value and trust to earn a return visit.
      </p>
      <button onClick={onBegin} className="btn-primary" style={{ padding: '16px 36px', fontSize: 15 }}>Begin →</button>
    </section>
  );
}

function MarketingFooter() {
  return (
    <footer style={{ padding: '32px', textAlign: 'center', borderTop: '1px solid rgba(245,237,216,.04)' }}>
      <Logo size="sm" />
      <p style={{ fontSize: 13, color: 'rgba(139,167,184,.6)', marginTop: 16, lineHeight: 1.7 }}>
        Affirm. Ask. Reflect. · Non-clinical · Non-diagnostic · Not a crisis service<br/>
        If you are in immediate danger, call or text 988.
      </p>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 16 }}>
        <a style={{ fontSize: 13, color: 'rgba(139,167,184,.7)', cursor: 'pointer' }}>Settings</a>
        <span style={{ fontSize: 13, color: 'rgba(139,167,184,.3)' }}>·</span>
        <a style={{ fontSize: 13, color: 'rgba(139,167,184,.7)', cursor: 'pointer' }}>Crisis resources</a>
      </div>
    </footer>
  );
}

Object.assign(window, { Hero, ResonanceShowcase, MirrorExample, ScopeIsIsNot, ClosingCTA, MarketingFooter });
