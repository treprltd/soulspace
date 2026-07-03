'use client'

// FeedbackWrapper — shown on all non-admin pages.
// Uses the Supabase client (not a manual localStorage scan) to read the auth
// token reliably across SDK versions. Renders nothing until mounted to prevent
// SSR/hydration mismatches.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FeedbackPanel } from '@/components/dashboard/FeedbackPanel'

// Pages where the feedback panel opens automatically on load.
const AUTO_OPEN_PATHS = ['/auth/register']

export function FeedbackWrapper() {
  const pathname = usePathname()
  const [mounted, setMounted]         = useState(false)
  const [token, setToken]             = useState<string | null>(null)
  const [defaultOpen, setDefaultOpen] = useState(false)

  useEffect(() => {
    setMounted(true)

    // ── Auto-open logic ────────────────────────────────────────────────────
    // Open on designated paths OR when navigated to with ?feedback=1.
    // Strip the param from the URL immediately so refresh doesn't re-trigger.
    const params    = new URLSearchParams(window.location.search)
    const openByPath  = AUTO_OPEN_PATHS.includes(window.location.pathname)
    const openByParam = params.get('feedback') === '1'

    setDefaultOpen(openByPath || openByParam)

    if (openByParam) {
      params.delete('feedback')
      const qs    = params.toString()
      const clean = window.location.pathname + (qs ? `?${qs}` : '')
      window.history.replaceState(null, '', clean)
    }

    // ── Auth token — use the Supabase client, not a localStorage key scan ──
    // The manual sb-*-auth-token scan was fragile (key format varies across
    // SDK versions). getSession() is the reliable, officially-supported path.
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => setToken(session?.access_token ?? null))
      .catch(() => setToken(null))
  }, [pathname]) // re-run on every route change (catches login/logout)

  // Don't render on admin pages, the public landing page, or before mount.
  // The landing page (/) is the professor/student-facing entry point — a
  // pinned "BETA FEEDBACK" tab there adds clutter and overlaps hero copy on
  // mobile; feedback belongs inside the app experience, not the front door.
  if (!mounted || pathname === '/' || pathname.startsWith('/admin')) return null

  return <FeedbackPanel authToken={token} defaultOpen={defaultOpen} />
}
