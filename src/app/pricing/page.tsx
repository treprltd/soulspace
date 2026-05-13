'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { PLANS } from '@/lib/stripe/plans'
import type { PaidPlan } from '@/lib/stripe/plans'

const FREE_FEATURES = [
  '3 sessions per month',
  'All 4 resonance branches',
  'All 4 seasonal responses',
  'Mirror output every session',
]

export default function Pricing() {
  const router = useRouter()
  const [loading, setLoading] = useState<PaidPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string>('free')

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => {
        setAuthenticated(d.authenticated)
        setCurrentPlan(d.planTier ?? 'free')
      })
      .catch(() => setAuthenticated(false))
  }, [])

  const handleSubscribe = async (plan: PaidPlan) => {
    if (!authenticated) {
      router.push('/auth/signin?next=/pricing')
      return
    }

    setLoading(plan)
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier: plan }),
      })

      const data = await res.json() as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(null)
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch {
      setError('Connection error. Please try again.')
      setLoading(null)
    }
  }

  const handleManage = async () => {
    setLoading('essentials') // borrow loading state
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else setError(data.error ?? 'Could not open billing portal.')
    } catch {
      setError('Connection error.')
    } finally {
      setLoading(null)
    }
  }

  const isCurrentPlan = (plan: string) => currentPlan === plan

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Nav */}
      <nav
        className="h-14 flex items-center justify-between px-8"
        style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
      >
        <Logo size="md" />
        <Link href="/" className="text-xs text-mist hover:text-sand2 transition-colors">← Back</Link>
      </nav>

      <div className="px-6 py-12 max-w-3xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="eyebrow mb-4 justify-center">Plans</div>
          <h1 className="font-serif font-light text-sand2 leading-tight mb-3" style={{ fontSize: '32px' }}>
            Continue when you&apos;re<br />
            <em className="text-gold2">ready to go deeper.</em>
          </h1>
          <p className="text-xs text-mist leading-relaxed max-w-sm mx-auto">
            Start free. Three sessions a month, no account required.<br />
            Upgrade when the first one earns it.
          </p>
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 mb-6 text-sm text-center"
            style={{ background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.2)', color: 'var(--danger)' }}
          >
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Free */}
          <div
            className="rounded-xl p-5 flex flex-col"
            style={{
              background: 'rgba(15,30,46,.5)',
              border: isCurrentPlan('free') ? '1px solid rgba(201,168,76,.4)' : '1px solid rgba(245,237,216,.06)',
            }}
          >
            <div className="mb-4">
              <div className="text-[8px] tracking-[.14em] uppercase text-mist mb-1">Free</div>
              <div className="font-serif font-light text-sand2 text-3xl">$0</div>
              <div className="text-[9px] text-mist mt-0.5">forever</div>
            </div>

            <ul className="flex-1 mb-5 space-y-2">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-[11px] text-sand leading-relaxed">
                  <span style={{ color: 'var(--teal2)' }} className="flex-shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {isCurrentPlan('free') ? (
              <div
                className="w-full py-2.5 rounded-lg text-[11px] text-center"
                style={{ border: '1px solid rgba(201,168,76,.3)', color: 'var(--gold2)' }}
              >
                Current plan
              </div>
            ) : (
              <Link
                href="/age-gate"
                className="w-full py-2.5 rounded-lg text-[11px] text-center block transition-opacity hover:opacity-80"
                style={{ border: '1px solid rgba(245,237,216,.1)', color: 'var(--mist)' }}
              >
                Continue free →
              </Link>
            )}
          </div>

          {/* Essentials */}
          <div
            className="rounded-xl p-5 flex flex-col relative"
            style={{
              background: isCurrentPlan('essentials') ? 'rgba(201,168,76,.06)' : 'rgba(15,30,46,.7)',
              border: isCurrentPlan('essentials')
                ? '1px solid rgba(201,168,76,.5)'
                : '1px solid rgba(201,168,76,.25)',
            }}
          >
            {!isCurrentPlan('essentials') && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[8px] tracking-[.1em] uppercase"
                style={{ background: 'var(--gold)', color: 'var(--ink)' }}
              >
                Most popular
              </div>
            )}

            <div className="mb-4">
              <div className="text-[8px] tracking-[.14em] uppercase text-gold mb-1">Essentials</div>
              <div className="font-serif font-light text-sand2 text-3xl">$9.99</div>
              <div className="text-[9px] text-mist mt-0.5">per month</div>
            </div>

            <ul className="flex-1 mb-5 space-y-2">
              {PLANS.essentials.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-[11px] text-sand leading-relaxed">
                  <span style={{ color: 'var(--teal2)' }} className="flex-shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {isCurrentPlan('essentials') ? (
              <button
                onClick={handleManage}
                className="btn-outline text-xs w-full py-2.5"
              >
                Manage subscription →
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe('essentials')}
                disabled={loading !== null}
                className="btn-primary text-xs w-full py-2.5 disabled:opacity-50"
              >
                {loading === 'essentials' ? 'Redirecting…' : 'Get Essentials →'}
              </button>
            )}
          </div>

          {/* Insights */}
          <div
            className="rounded-xl p-5 flex flex-col"
            style={{
              background: isCurrentPlan('insights') ? 'rgba(201,168,76,.06)' : 'rgba(15,30,46,.5)',
              border: isCurrentPlan('insights')
                ? '1px solid rgba(201,168,76,.5)'
                : '1px solid rgba(245,237,216,.06)',
            }}
          >
            <div className="mb-4">
              <div className="text-[8px] tracking-[.14em] uppercase text-mist mb-1">Insights</div>
              <div className="font-serif font-light text-sand2 text-3xl">$19.99</div>
              <div className="text-[9px] text-mist mt-0.5">per month</div>
            </div>

            <ul className="flex-1 mb-5 space-y-2">
              {PLANS.insights.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-[11px] text-sand leading-relaxed">
                  <span style={{ color: 'var(--teal2)' }} className="flex-shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {isCurrentPlan('insights') ? (
              <button
                onClick={handleManage}
                className="btn-outline text-xs w-full py-2.5"
              >
                Manage subscription →
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe('insights')}
                disabled={loading !== null}
                className="btn-outline text-xs w-full py-2.5 disabled:opacity-50"
              >
                {loading === 'insights' ? 'Redirecting…' : 'Get Insights →'}
              </button>
            )}
          </div>
        </div>

        {/* Footer notes */}
        <div className="mt-8 text-center space-y-1.5">
          <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(139,167,184,.4)' }}>
            Billed monthly. Cancel any time from your account settings.
          </p>
          <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
            Secure payment via Stripe. Soul Space does not store card details.
          </p>
          {!authenticated && (
            <p className="text-[9px] mt-2" style={{ color: 'rgba(139,167,184,.35)' }}>
              Signing in is required to subscribe.{' '}
              <Link href="/auth/signin?next=/pricing" className="underline underline-offset-2 hover:text-mist">
                Sign in →
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
