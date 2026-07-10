'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// Gentle "install Soul Space" affordance for phones and tablets.
//   · Android / desktop Chrome: captures the native beforeinstallprompt and
//     offers a one-tap Install button.
//   · iOS / iPadOS Safari: no programmatic install exists, so we show a short
//     "Add to Home Screen" hint with the Share glyph.
// Never shown when already installed (standalone), never on the session flow /
// auth / admin surfaces, and dismissible with a 30-day memory. Calm and
// one-time — consistent with the product's no-nagging voice.

const DISMISS_KEY = 'ss_install_dismissed_at'
const DISMISS_DAYS = 30
const HIDE_ON = ['/session', '/admin', '/auth', '/age-gate', '/offline']

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const pathname = usePathname()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already installed → never prompt
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return

    // Recently dismissed → stay quiet
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
      if (at && Date.now() - at < DISMISS_DAYS * 864e5) return
    } catch { /* localStorage blocked — fall through, still one-session only */ }

    const ua = window.navigator.userAgent
    const isIos = /iphone|ipad|ipod/i.test(ua) ||
      // iPadOS 13+ reports as Mac; disambiguate via touch
      (/macintosh/i.test(ua) && 'ontouchend' in document)
    const isSafari = /^((?!chrome|crios|fxios|edgios).)*safari/i.test(ua)

    if (isIos && isSafari) {
      setIosHint(true)
      // Let the page settle before surfacing the hint
      const t = setTimeout(() => setVisible(true), 2500)
      return () => clearTimeout(t)
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setTimeout(() => setVisible(true), 2000)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', () => setVisible(false))
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const dismiss = () => {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    dismiss()
  }

  if (HIDE_ON.some(p => pathname.startsWith(p))) return null
  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Install Soul Space"
      // Centered via inset + auto margins (not a transform) so the fade-in
      // keyframe's translateY can't cancel horizontal centering.
      className="fixed inset-x-4 z-50 mx-auto max-w-md animate-fade-in"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{
          background: 'rgba(10,22,35,.97)',
          border: '1px solid rgba(201,168,76,.28)',
          boxShadow: '0 12px 40px rgba(0,0,0,.5)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Ring mark */}
        <svg width="34" height="34" viewBox="0 0 34 34" className="flex-shrink-0" aria-hidden="true">
          <circle cx="17" cy="17" r="10" fill="none" stroke="#C9A84C" strokeWidth="2.2" />
          <circle cx="17" cy="17" r="4.4" fill="none" stroke="#C9A84C" strokeWidth="1.8" />
        </svg>

        <div className="flex-1 min-w-0">
          {iosHint ? (
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,247,240,.9)' }}>
              Keep Soul Space one tap away — press{' '}
              <span aria-hidden="true" style={{ color: 'var(--gold2)' }}>&#x2191;&#xFE0E; Share</span>, then{' '}
              <span style={{ color: 'var(--gold2)' }}>Add to Home Screen</span>.
            </p>
          ) : (
            <p className="text-sm leading-snug" style={{ color: 'rgba(245,247,240,.9)' }}>
              Keep Soul Space<br />one tap away.
            </p>
          )}
        </div>

        {!iosHint && (
          <button
            onClick={install}
            className="btn-primary text-sm px-4 py-2 flex-shrink-0"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base transition-opacity hover:opacity-70"
          style={{ color: 'rgba(213,226,235,.6)' }}
        >
          &times;
        </button>
      </div>
    </div>
  )
}
