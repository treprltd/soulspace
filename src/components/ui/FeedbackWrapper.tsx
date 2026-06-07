'use client'

// FeedbackWrapper — shown on all non-admin pages.
// Reads the Supabase session token from localStorage (implicit flow) and
// passes it down to FeedbackPanel. Renders nothing until mounted so there's
// no SSR/hydration mismatch.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { FeedbackPanel } from '@/components/dashboard/FeedbackPanel'

export function FeedbackWrapper() {
  const pathname  = usePathname()
  const [mounted, setMounted]       = useState(false)
  const [token, setToken]           = useState<string | null>(null)
  const [defaultOpen, setDefaultOpen] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Auto-open the panel on /session/next-step (always) or when any page is
    // reached with ?feedback=1. Strip the param from the URL immediately so a
    // refresh doesn't re-open the panel unexpectedly.
    const params = new URLSearchParams(window.location.search)
    const openByPath  = window.location.pathname === '/session/next-step'
    const openByParam = params.get('feedback') === '1'
    if (openByPath || openByParam) {
      setDefaultOpen(true)
      if (openByParam) {
        // Strip the param so back/refresh behaves cleanly
        const clean = window.location.pathname +
          (params.toString().replace(/feedback=1&?/, '').replace(/&$/, '') ? '?' + params.toString().replace(/feedback=1&?/, '').replace(/&$/, '') : '')
        window.history.replaceState(null, '', clean)
      }
    }

    // Try to pull the Supabase access token out of localStorage.
    // The key format is: sb-<project-ref>-auth-token
    // We scan all keys for the Supabase auth payload so we're not hardcoding
    // the project ref, which differs per environment.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
          const raw  = localStorage.getItem(key)
          const data = raw ? JSON.parse(raw) : null
          const at   = data?.access_token ?? data?.session?.access_token ?? null
          if (at) { setToken(at); break }
        }
      }
    } catch {
      // localStorage unavailable (SSR guard, incognito policy) — treat as guest
    }
  }, [pathname]) // re-check on route change (login/logout navigates)

  // Don't render on admin pages or before mount (prevents hydration mismatch)
  if (!mounted || pathname.startsWith('/admin')) return null

  return <FeedbackPanel authToken={token} defaultOpen={defaultOpen} />
}
