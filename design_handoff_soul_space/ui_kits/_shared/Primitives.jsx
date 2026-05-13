// Soul Space wordmark — used identically across marketing and app.
function Logo({ size = 'md' }) {
  const sizes = { sm: 14, md: 18, lg: 28 };
  return (
    <span style={{
      fontFamily: 'var(--font-serif)',
      fontWeight: 300,
      color: 'var(--sand2)',
      fontSize: sizes[size],
    }}>
      Soul <em style={{ fontStyle: 'normal', color: 'var(--gold)', fontWeight: 400 }}>Space</em>
    </span>
  );
}

// Marketing nav — 56h, two CTAs on the right.
function MarketingNav({ onBegin }) {
  return (
    <nav style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', borderBottom: '1px solid rgba(245,237,216,.04)',
    }}>
      <Logo size="md" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <a style={{ fontSize: 11, color: 'var(--mist)', cursor: 'pointer' }}>Settings</a>
        <button onClick={onBegin} className="btn-primary" style={{ fontSize: 11, padding: '8px 16px' }}>Begin →</button>
      </div>
    </nav>
  );
}

// Session nav — 48h, single label on the right.
function SessionNav({ right }) {
  return (
    <nav style={{
      height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', background: 'rgba(8,17,28,.98)',
      borderBottom: '1px solid rgba(245,237,216,.04)',
    }}>
      <Logo size="sm" />
      {right && <span style={{ fontSize: 9, color: 'var(--mist)' }}>{right}</span>}
    </nav>
  );
}

// Eyebrow (tracked gold label, optional leading rule)
function Eyebrow({ children, color = 'var(--gold)', centered = false }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 8, letterSpacing: '.18em', textTransform: 'uppercase', color,
      justifyContent: centered ? 'center' : 'flex-start',
    }}>
      <span style={{ width: 10, height: 1, background: color, flexShrink: 0 }} />
      {children}
    </div>
  );
}

// Affirmation copy — frozen serif italic
function Affirm({ children, style }) {
  return (
    <div style={{
      fontFamily: 'var(--font-serif)', fontStyle: 'italic',
      fontSize: 12, color: 'rgba(139,167,184,.55)', lineHeight: 1.85,
      ...style,
    }}>{children}</div>
  );
}

// Progress (n of total) — three small bars on session screens
function ProgressBar({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      {Array.from({ length: total }).map((_, i) => {
        const state = i < step - 1 ? 'done' : i === step - 1 ? 'current' : 'todo';
        const bg = state === 'done' ? 'var(--gold)'
                 : state === 'current' ? 'rgba(201,168,76,.38)'
                 : 'rgba(245,237,216,.06)';
        return <div key={i} style={{ height: 2, borderRadius: 2, flex: 1, background: bg }} />;
      })}
    </div>
  );
}

// Clinical pill badge — used on Season + crisis.
function ClinicalBadge({ children, danger = false }) {
  const c = danger ? 'rgba(212,64,64,.85)' : 'var(--teal2)';
  const bg = danger ? 'rgba(212,64,64,.06)' : 'rgba(42,140,122,.07)';
  const bd = danger ? 'rgba(212,64,64,.22)' : 'rgba(42,140,122,.22)';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
      borderRadius: 999, fontSize: 8, color: c, background: bg, border: `1px solid ${bd}`,
    }}>
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke={danger ? '#D44040' : '#3DAF96'} strokeWidth="1.4" strokeLinecap="round">
        <path d="M6 1l3.5 1.75v3.5C9.5 8.75 7.9 10.5 6 11c-1.9-.5-3.5-2.25-3.5-4.75v-3.5L6 1z" />
      </svg>
      {children}
    </div>
  );
}

Object.assign(window, { Logo, MarketingNav, SessionNav, Eyebrow, Affirm, ProgressBar, ClinicalBadge });
