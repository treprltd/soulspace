import Link from 'next/link'

/**
 * Minimal legal footer — shown on all user-facing pages.
 * Keeps a light footprint: just the required legal links + 988 line.
 */
export function LegalFooter() {
  return (
    <footer
      className="py-5 px-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-center"
      style={{ borderTop: '1px solid rgba(245,237,216,.04)' }}
    >
      <Link
        href="/privacy"
        className="text-[10px] transition-opacity hover:opacity-70"
        style={{ color: 'rgba(139,167,184,.35)' }}
      >
        Privacy
      </Link>
      <Link
        href="/terms"
        className="text-[10px] transition-opacity hover:opacity-70"
        style={{ color: 'rgba(139,167,184,.35)' }}
      >
        Terms
      </Link>
      <Link
        href="/cookies"
        className="text-[10px] transition-opacity hover:opacity-70"
        style={{ color: 'rgba(139,167,184,.35)' }}
      >
        Cookies
      </Link>
      <span
        className="text-[10px]"
        style={{ color: 'rgba(139,167,184,.25)' }}
      >
        Not therapy · Not a diagnosis
      </span>
      <span
        className="text-[10px]"
        style={{ color: 'rgba(139,167,184,.2)' }}
      >
        Crisis line: call or text 988
      </span>
    </footer>
  )
}
