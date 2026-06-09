'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'

const PLAN_PERKS: Record<string, string[]> = {
  essentials: [
    'Unlimited sessions, any time',
    'Full session history, fully encrypted',
    'All 4 resonance branches',
    'All 4 seasonal responses',
  ],
  insights: [
    'Everything in Essentials',
    'Pattern tracking across sessions',
    'Season trend analysis',
    'Priority support',
  ],
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [planTier, setPlanTier] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) { setPlanTier('essentials'); return }

    // Poll until webhook has updated the plan (up to ~6 s).
    // Must pass bearer token — Supabase implicit flow stores JWT in localStorage,
    // not cookies, so the server route can't authenticate without the header.
    let attempts = 0
    const check = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const headers: Record<string, string> = {}
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

        const res = await fetch('/api/subscription', { headers })
        const data = await res.json() as { planTier?: string }
        if (data.planTier && data.planTier !== 'free') {
          setPlanTier(data.planTier)
          return
        }
      } catch { /* ignore */ }
      attempts++
      if (attempts < 6) setTimeout(check, 1500)
      else setPlanTier('essentials') // fallback — show success anyway
    }
    check()
  }, [sessionId])

  const planName = planTier === 'insights' ? 'Insights' : 'Essentials'
  const perks = PLAN_PERKS[planTier ?? 'essentials'] ?? PLAN_PERKS.essentials

  return (
    <div className="animate-fade-in max-w-sm w-full text-left">
      {/* Logo */}
      <div className="text-center mb-6">
        <Logo size="md" />
      </div>

      <div className="w-8 h-px mx-auto mb-7" style={{ background: 'rgba(201,168,76,.2)' }} />

      {planTier ? (
        <>
          {/* Check circle */}
          <div className="flex justify-center mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(201,168,76,.08)',
                border: '1px solid rgba(201,168,76,.3)',
              }}
            >
              <span style={{ color: 'var(--gold2)', fontSize: '22px' }}>✓</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="font-serif font-light text-sand2 text-2xl mb-2 leading-tight text-center">
            Welcome to <em className="text-gold2">{planName}.</em>
          </h1>
          <p className="text-xs text-mist leading-relaxed mb-7 text-center">
            Your subscription is active. Everything you share<br />
            remains encrypted and private to you.
          </p>

          {/* Perks summary card */}
          <div
            className="rounded-xl p-5 mb-6"
            style={{
              background: 'rgba(15,30,46,.6)',
              border: '1px solid rgba(201,168,76,.12)',
            }}
          >
            <div className="text-[8px] tracking-[.14em] uppercase mb-3" style={{ color: 'var(--gold)' }}>
              What&apos;s now available
            </div>
            <ul className="space-y-2.5">
              {perks.map(p => (
                <li key={p} className="flex items-center gap-2.5 text-[11px] text-sand leading-relaxed">
                  <span style={{ color: 'var(--teal2)', fontSize: '12px', flexShrink: 0 }}>✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* CTAs — dashboard first so user sees their plan is active */}
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-primary text-sm py-3 w-full mb-3"
          >
            Go to your dashboard →
          </button>

          <button
            onClick={() => router.push('/age-gate')}
            className="w-full py-2.5 rounded-xl text-sm transition-colors mb-2.5"
            style={{
              border: '1px solid rgba(201,168,76,.2)',
              color: 'var(--gold)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Begin a session →
          </button>

          <button
            onClick={() => router.push('/settings')}
            className="block text-xs mx-auto hover:text-mist transition-colors w-full text-center"
            style={{ color: 'rgba(213,226,235,.65)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View settings &amp; subscription →
          </button>
        </>
      ) : (
        /* Loading state */
        <div className="flex flex-col items-center gap-4 py-8">
          <div
            className="w-8 h-8 rounded-full"
            style={{
              border: '2px solid rgba(201,168,76,.1)',
              borderTopColor: 'var(--gold)',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          <p className="text-xs text-mist">Confirming your subscription…</p>
        </div>
      )}
    </div>
  )
}

export default function SubscribeSuccess() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#060E18' }}>
      <NavBar />
      <div className="flex-1 flex items-center justify-center px-6 text-center">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full"
            style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }}
          />
          <p className="text-xs text-mist">Loading…</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
      </div>
    </main>
  )
}
