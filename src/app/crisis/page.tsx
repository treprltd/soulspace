import Link from 'next/link'

// Hard gate: Season suppressed. No Mirror output. 988 and Crisis Text Line shown.
// This screen appears when safety_flagged = true. Zero exceptions.
export default function CrisisPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-5 sm:px-12 text-center"
      style={{ background: '#060E18' }}
    >
      <div className="animate-fade-in">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{
            border: '2px solid rgba(212,64,64,.3)',
            background: 'rgba(212,64,64,.05)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#D44040" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 2l7 4v6C17 16.5 13.8 19.5 10 20.5 6.2 19.5 3 16.5 3 12V6l7-4z" />
          </svg>
        </div>

        <p className="text-xs tracking-[.14em] uppercase mb-3" style={{ color: 'rgba(212,64,64,.7)' }}>
          Outside Soul Space&apos;s scope
        </p>

        <h1 className="font-serif font-light text-sand2 text-2xl mb-2.5 max-w-sm leading-snug">
          We noticed something outside the scope of Soul Space.
        </h1>

        <p className="text-sm text-mist max-w-sm mb-6 leading-relaxed">
          If you are in crisis or having thoughts of harming yourself or others, please reach out now:
        </p>

        <div className="flex flex-col gap-2 w-full max-w-xs mx-auto mb-5">
          <a
            href="tel:988"
            className="block px-4 py-3.5 rounded-xl text-left no-underline transition-opacity hover:opacity-90"
            style={{ background: 'rgba(212,64,64,.05)', border: '1px solid rgba(212,64,64,.18)' }}
          >
            <div className="text-sm font-semibold text-sand2 mb-0.5">988 Suicide &amp; Crisis Lifeline</div>
            <div className="text-sm text-mist">Call or text 988 · Available 24/7</div>
          </a>
          <div
            className="px-4 py-3.5 rounded-xl text-left"
            style={{ background: 'rgba(212,64,64,.05)', border: '1px solid rgba(212,64,64,.18)' }}
          >
            <div className="text-sm font-semibold text-sand2 mb-0.5">Crisis Text Line</div>
            <div className="text-sm text-mist">Text HOME to 741741</div>
          </div>
        </div>

        <p className="font-serif text-sm italic text-mist mb-4">
          Soul Space will be here when you are ready to return.
        </p>

        <Link href="/" className="btn-outline text-sm">
          Return to Soul Space
        </Link>
      </div>
    </main>
  )
}
