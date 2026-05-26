import Link from 'next/link'

/**
 * Minimal legal footer — shown on all user-facing pages.
 * Keeps a light footprint: just the required legal links + 988 line.
 */
export function LegalFooter() {
  return (
    <footer
      className="py-6 px-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center"
      style={{ borderTop: '1px solid rgba(245,237,216,.08)' }}
    >
      <Link
        href="/privacy"
        className="text-xs transition-opacity hover:opacity-100"
        style={{ color: 'rgba(139,167,184,.75)' }}
      >
        Privacy
      </Link>
      <Link
        href="/terms"
        className="text-xs transition-opacity hover:opacity-100"
        style={{ color: 'rgba(139,167,184,.75)' }}
      >
        Terms
      </Link>
      <Link
        href="/cookies"
        className="text-xs transition-opacity hover:opacity-100"
        style={{ color: 'rgba(139,167,184,.75)' }}
      >
        Cookies
      </Link>
      <span
        className="text-xs"
        style={{ color: 'rgba(139,167,184,.6)' }}
      >
        Not therapy · Not a diagnosis
      </span>
      <span
        className="text-xs font-medium"
        style={{ color: 'rgba(139,167,184,.75)' }}
      >
        Crisis line: call or text 988
      </span>
    </footer>
  )
}
