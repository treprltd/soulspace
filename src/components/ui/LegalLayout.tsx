import Link from 'next/link'
import { Logo } from './Logo'

interface Section {
  heading: string
  body: React.ReactNode
}

interface LegalLayoutProps {
  title: string
  subtitle: string
  lastUpdated: string
  sections: Section[]
}

export function LegalLayout({ title, subtitle, lastUpdated, sections }: LegalLayoutProps) {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#060E18' }}>
      {/* Minimal nav */}
      <nav
        className="h-12 flex items-center justify-between px-6 flex-shrink-0"
        style={{ background: 'rgba(8,17,28,.98)', borderBottom: '1px solid rgba(245,237,216,.04)' }}
      >
        <Logo size="sm" />
        <Link
          href="/"
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: 'rgba(139,167,184,.55)' }}
        >
          ← Back
        </Link>
      </nav>

      <div className="flex-1 flex justify-center px-5 py-14">
        <div className="w-full max-w-2xl">

          {/* Header */}
          <div className="mb-10">
            <h1
              className="font-serif font-light text-sand2 mb-2"
              style={{ fontSize: '28px', lineHeight: 1.25 }}
            >
              {title}
            </h1>
            <p className="text-sm text-mist mb-1">{subtitle}</p>
            <p className="text-xs" style={{ color: 'rgba(139,167,184,.4)' }}>
              Last updated: {lastUpdated}
            </p>
          </div>

          {/* Divider */}
          <div className="mb-10 h-px w-12" style={{ background: 'rgba(201,168,76,.2)' }} />

          {/* Sections */}
          <div className="space-y-10">
            {sections.map((s, i) => (
              <div key={i}>
                <h2
                  className="font-medium text-sand mb-3"
                  style={{ fontSize: '13px', letterSpacing: '0.04em' }}
                >
                  {s.heading}
                </h2>
                <div
                  className="text-sm leading-relaxed"
                  style={{ color: 'rgba(139,167,184,.75)' }}
                >
                  {s.body}
                </div>
              </div>
            ))}
          </div>

          {/* Footer links */}
          <div
            className="mt-14 pt-6 flex flex-wrap gap-x-5 gap-y-2"
            style={{ borderTop: '1px solid rgba(245,237,216,.05)' }}
          >
            <Link href="/privacy" className="text-xs hover:opacity-80 transition-opacity" style={{ color: 'rgba(139,167,184,.4)' }}>Privacy Policy</Link>
            <Link href="/terms"   className="text-xs hover:opacity-80 transition-opacity" style={{ color: 'rgba(139,167,184,.4)' }}>Terms of Use</Link>
            <Link href="/cookies" className="text-xs hover:opacity-80 transition-opacity" style={{ color: 'rgba(139,167,184,.4)' }}>Cookie Notice</Link>
            <a href="mailto:hello@soulspacehealth.org" className="text-xs hover:opacity-80 transition-opacity" style={{ color: 'rgba(139,167,184,.4)' }}>Contact</a>
          </div>

        </div>
      </div>
    </main>
  )
}
