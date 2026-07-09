'use client'

import { useEffect } from 'react'

// Registers the service worker (offline fallback + static-asset cache).
// Production only — a service worker during `next dev` serves stale chunks
// and makes local development miserable.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal — the site works fully without it.
    })
  }, [])

  return null
}
