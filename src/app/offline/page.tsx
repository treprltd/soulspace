// Offline fallback — served by the service worker when a navigation fails.
// Deliberately self-contained: inline styles only and zero client-side JS, so
// it renders calmly even when CSS/JS chunks aren't in the cache. Copy is
// additive (not part of any frozen set) and keeps the product's quiet voice.
export const metadata = { title: 'Soul Space — Offline' }

export default function Offline() {
  return (
    <main
      style={{
        background: '#060E18',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ maxWidth: '420px', textAlign: 'center' }}>
        {/* The ring mark, inline so it needs no asset fetch */}
        <svg width="56" height="56" viewBox="0 0 56 56" style={{ margin: '0 auto 24px', display: 'block' }} aria-hidden="true">
          <circle cx="28" cy="28" r="16" fill="none" stroke="#C9A84C" strokeWidth="3" />
          <circle cx="28" cy="28" r="7" fill="none" stroke="#C9A84C" strokeWidth="2.5" />
        </svg>
        <h1
          style={{
            fontWeight: 300,
            fontSize: '30px',
            lineHeight: 1.3,
            color: '#FAF7F0',
            margin: '0 0 14px',
          }}
        >
          You&rsquo;re offline right now.
        </h1>
        <p
          style={{
            fontSize: '19px',
            lineHeight: 1.7,
            color: 'rgba(213,226,235,.75)',
            margin: '0 0 10px',
          }}
        >
          The space isn&rsquo;t going anywhere. When your connection returns,
          everything will be here — exactly as you left it.
        </p>
        <p style={{ fontSize: '16px', lineHeight: 1.7, color: 'rgba(213,226,235,.5)', margin: 0 }}>
          If you are in immediate danger, call or text 988 — phone lines work
          without an internet connection.
        </p>
      </div>
    </main>
  )
}
