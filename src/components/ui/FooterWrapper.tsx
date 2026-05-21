'use client'

import { usePathname } from 'next/navigation'
import { LegalFooter } from './LegalFooter'

// Paths where the footer should NOT appear:
//   /admin/*        — has its own internal chrome
//   /auth/callback  — pure redirect, nothing shown
//   /session/loading — immersive loading screen
const HIDDEN_PREFIXES = ['/admin', '/auth/callback', '/session/loading']

export function FooterWrapper() {
  const pathname = usePathname()
  const hidden = HIDDEN_PREFIXES.some(p => pathname.startsWith(p))
  if (hidden) return null
  return <LegalFooter />
}
