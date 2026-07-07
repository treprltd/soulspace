'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── Email CTA sign-in bridge ──────────────────────────────────────────────
// Every primary CTA in a Soul Space email carries a one-time token_hash,
// generated server-side (auth.admin.generateLink) at send time. This page
// consumes it with verifyOtp so the click lands the user already signed in,
// then routes them to `next`. The token is consumed via JS on load — email
// scanners that prefetch links without executing JS can't burn it.
//
// Failure is always soft:
//   · already signed in           → skip the token, go straight to `next`
//   · expired / already-used link → friendly prompt to get a fresh one
//   · no token at all             → normal sign-in page

export default function EmailSignIn() {
  const router = useRouter()
  const [state, setState] = useState<'working' | 'expired'>('working')
  const [next, setNext] = useState('/age-gate')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const rawNext = params.get('next') ?? '/age-gate'
    // Open-redirect guard — internal single-slash paths only
    const safeNext = /^\/(?!\/)/.test(rawNext) ? rawNext : '/age-gate'
    setNext(safeNext)

    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      // Already signed in on this device — don't touch the token, just go.
      if (user) {
        router.replace(safeNext)
        return
      }

      if (!tokenHash) {
        router.replace(`/auth/signin?next=${encodeURIComponent(safeNext)}`)
        return
      }

      const { error } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: tokenHash,
      })

      if (error) {
        setState('expired')
        return
      }

      router.replace(safeNext)
    })
  }, [router])

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#060E18' }}
    >
      {state === 'working' ? (
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <div
            className="w-10 h-10 rounded-full animate-spin-slow"
            style={{ border: '2px solid rgba(201,168,76,.12)', borderTopColor: 'var(--gold)' }}
          />
          <p className="font-serif italic text-base" style={{ color: 'rgba(213,226,235,.72)' }}>
            Opening your space…
          </p>
        </div>
      ) : (
        <div
          className="max-w-md w-full rounded-2xl px-8 py-10 text-center animate-fade-in"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.07)' }}
        >
          <h1 className="font-serif font-light text-sand2 mb-3 leading-tight" style={{ fontSize: '30px' }}>
            That link has <em className="text-gold2">done its job.</em>
          </h1>
          <p className="text-base leading-relaxed mb-7" style={{ color: 'rgba(213,226,235,.72)' }}>
            Sign-in links work once and expire after a little while — it keeps your
            space private. Enter your email on the sign-in page and we&apos;ll send
            you a fresh one. It takes a few seconds.
          </p>
          <Link
            href={`/auth/signin?next=${encodeURIComponent(next)}`}
            className="btn-primary px-8 py-3.5 inline-block"
          >
            Get a fresh sign-in link →
          </Link>
        </div>
      )}
    </main>
  )
}
