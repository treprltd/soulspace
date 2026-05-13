'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [planTier, setPlanTier] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) { setPlanTier('essentials'); return }

    // Poll until webhook has updated the plan (up to ~6 seconds)
    let attempts = 0
    const check = async () => {
      try {
        const res = await fetch('/api/subscription')
        const data = await res.json() as { planTier?: string }
        if (data.planTier && data.planTier !== 'free') {
          setPlanTier(data.planTier)
          return
        }
      } catch { /* ignore */ }
      attempts++
      if (attempts < 5) setTimeout(check, 1200)
      else setPlanTier('essentials') // fallback — show success anyway
    }
    check()
  }, [sessionId])

  const planName = planTier === 'insights' ? 'Insights' : 'Essentials'

  return (
    <div className="animate-fade-in max-w-sm w-full">
      <Logo size="md" />
      <div className="w-8 h-px mx-auto mt-5 mb-6" style={{ background: 'rgba(201,168,76,.2)' }} />

      {planTier ? (
        <>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)' }}
          >
            <span style={{ color: 'var(--gold2)', fontSize: '20px' }}>✓</span>
          </div>

          <h1 className="font-serif font-light text-sand2 text-2xl mb-3 leading-tight">
            Welcome to <em className="text-gold2">{planName}.</em>
          </h1>
          <p className="text-xs text-mist leading-relaxed mb-7">
            Your subscription is active. Unlimited sessions are now available.<br />
            Everything you share is still encrypted and private.
          </p>

          <button
            onClick={() => router.push('/age-gate')}
            className="btn-primary text-sm px-8 py-3 w-full"
          >
            Begin a session →
          </button>

          <button
            onClick={() => router.push('/settings')}
            className="block mt-3 text-[9px] mx-auto hover:text-mist transition-colors"
            style={{ color: 'rgba(139,167,184,.4)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View settings & subscription →
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full animate-spin-slow"
            style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }}
          />
          <p className="text-xs text-mist">Confirming your subscription…</p>
        </div>
      )}
    </div>
  )
}

export default function SubscribeSuccess() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--bg)' }}
    >
      <Suspense fallback={
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-spin-slow" style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }} />
          <p className="text-xs text-mist">Loading…</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </main>
  )
}
