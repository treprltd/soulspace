'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'
import { PLANS } from '@/lib/stripe/plans'
import type { PaidPlan } from '@/lib/stripe/plans'

const FREE_FEATURES = [
  '1 session per month',
  'Full Mirror reflection each session',
  'All 4 seasonal responses',
  'Private · Encrypted · No ads',
]

export default function Pricing() {
  const router = useRouter()
  const [manageLoading, setManageLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string>('free')

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthenticated(!!user)
    })

    // Must pass bearer token — implicit flow stores JWT in localStorage, not cookies
    supabase.auth.getSession().then(({ data: { session } }) => {
      const headers: Record<string, string> = {}
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      fetch('/api/subscription', { headers })
        .then(r => r.json())
        .then(d => { setCurrentPlan((d as { planTier?: string }).planTier ?? 'free') })
        .catch(() => {})
    })
  }, [])

  // Route to branded pre-checkout page — auth check + Stripe call happen there
  const handleSubscribe = (plan: PaidPlan) => {
    if (!authenticated) {
      router.push(`/auth/signin?next=/checkout/${plan}`)
      return
    }
    router.push(`/checkout/${plan}`)
  }

  const handleManage = async () => {
    setManageLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {}
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST', headers })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else setError(data.error ?? 'Could not open billing portal.')
    } catch {
      setError('Connection error.')
    } finally {
      setManageLoading(false)
    }
  }

  const isCurrentPlan = (plan: string) => currentPlan === plan

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />

      <div className="px-6 py-12 max-w-3xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="eyebrow mb-4 justify-center">Plans</div>
          <h1 className="font-serif font-light text-sand2 leading-tight mb-3" style={{ fontSize: '39px' }}>
            Continue when you&apos;re<br />
            <em className="text-gold2">ready to go deeper.</em>
          </h1>
          <p className="text-base text-mist leading-relaxed max-w-sm mx-auto">
            Start free. One session a month, no account required.<br />
            Upgrade when it earns it.
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
              <div className="text-[17px] tracking-[.14em] uppercase text-mist mb-1">Free</div>
              <div className="font-serif font-light text-sand2 text-3xl">$0</div>
              <div className="text-xs text-mist mt-0.5">forever</div>
            </div>

            <ul className="flex-1 mb-5 space-y-2">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-sand leading-relaxed">
                  <span style={{ color: 'var(--teal2)' }} className="flex-shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {isCurrentPlan('free') ? (
              <div
                className="w-full py-2.5 rounded-lg text-sm text-center"
                style={{ border: '1px solid rgba(201,168,76,.3)', color: 'var(--gold2)' }}
              >
                Current plan
              </div>
            ) : (
              <Link
                href="/age-gate"
                className="w-full py-2.5 rounded-lg text-sm text-center block transition-opacity hover:opacity-80"
                style={{ border: '1px solid rgba(245,237,216,.76)', color: 'var(--mist)', textDecoration: 'none' }}
              >
                Continue free →
              </Link>
            )}
          </div>

          {/* Essentials */}
          <div
            className="rounded-xl pt-9 px-5 pb-5 flex flex-col relative"
            style={{
              background: isCurrentPlan('essentials') ? 'rgba(201,168,76,.06)' : 'rgba(15,30,46,.7)',
              border: isCurrentPlan('essentials')
                ? '1px solid rgba(201,168,76,.5)'
                : '1px solid rgba(201,168,76,.25)',
            }}
          >
            {!isCurrentPlan('essentials') && (
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full whitespace-nowrap tracking-[.1em] uppercase"
                style={{ background: 'var(--gold)', color: 'var(--ink)', fontSize: '13px' }}
              >
                Most popular
              </div>
            )}

            <div className="mb-4">
              <div className="text-[17px] tracking-[.14em] uppercase text-gold mb-1">Essentials</div>
              <div className="font-serif font-light text-sand2 text-3xl">$9.99</div>
              <div className="text-xs text-mist mt-0.5">per month</div>
            </div>

            <ul className="flex-1 mb-5 space-y-2">
              {PLANS.essentials.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-sand leading-relaxed">
                  <span style={{ color: 'var(--teal2)' }} className="flex-shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {isCurrentPlan('essentials') ? (
              <button
                onClick={handleManage}
                disabled={manageLoading}
                className="btn-outline text-sm w-full py-2.5 disabled:opacity-50"
              >
                {manageLoading ? 'Opening…' : 'Manage subscription →'}
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe('essentials')}
                className="btn-primary text-sm w-full py-2.5"
              >
                Get Essentials →
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
              <div className="text-[17px] tracking-[.14em] uppercase text-mist mb-1">Insights</div>
              <div className="font-serif font-light text-sand2 text-3xl">$19.99</div>
              <div className="text-xs text-mist mt-0.5">per month</div>
            </div>

            <ul className="flex-1 mb-5 space-y-2">
              {PLANS.insights.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-sand leading-relaxed">
                  <span style={{ color: 'var(--teal2)' }} className="flex-shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {isCurrentPlan('insights') ? (
              <button
                onClick={handleManage}
                disabled={manageLoading}
                className="btn-outline text-sm w-full py-2.5 disabled:opacity-50"
              >
                {manageLoading ? 'Opening…' : 'Manage subscription →'}
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe('insights')}
                className="btn-outline text-xs w-full py-2.5"
              >
                Get Insights →
              </button>
            )}
          </div>
        </div>

        {/* Footer notes */}
        <div className="mt-8 text-center space-y-1.5">
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(213,226,235,.65)' }}>
            Billed monthly. Cancel any time from your account settings.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(213,226,235,.60)' }}>
            Secure payment via Stripe · Soul Space does not store card details.
          </p>
          {authenticated === false && (
            <p className="text-xs mt-2" style={{ color: 'rgba(213,226,235,.60)' }}>
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
