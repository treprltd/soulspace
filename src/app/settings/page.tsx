'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'

interface SubscriptionStatus {
  planTier: 'free' | 'essentials' | 'insights'
  sessionsThisMonth: number | null
  limit: number | null
  authenticated: boolean
  subscription?: {
    status: string
    current_period_end: string
    cancel_at_period_end: boolean
  } | null
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  essentials: 'Essentials',
  insights: 'Insights',
}

export default function Settings() {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => setSubStatus(d as SubscriptionStatus))
      .catch(() => {})
  }, [])

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await fetch('/api/user/data', { method: 'DELETE' })
      setDeleted(true)
      setTimeout(() => router.push('/'), 1500)
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string }
      if (data.url) window.location.href = data.url
    } catch {
      // noop
    } finally {
      setPortalLoading(false)
    }
  }

  const isPaid = subStatus && subStatus.planTier !== 'free'
  const periodEnd = subStatus?.subscription?.current_period_end
    ? new Date(subStatus.subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <NavBar right="Settings" />
      <div className="px-6 py-5 max-w-lg mx-auto animate-fade-in">
        <h2 className="font-serif font-light text-sand2 text-3xl mb-1.5 leading-tight">
          Your <em className="text-gold2">account.</em>
        </h2>
        <p className="text-base text-mist mb-6">Manage your plan and data.</p>

        {/* Plan & Subscription */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[11px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Subscription
          </div>

          {subStatus ? (
            <>
              <div className="flex justify-between items-center py-2 border-b border-white/[.04]">
                <div>
                  <div className="text-base text-sand">Current plan</div>
                  <div className="text-[13px] text-mist mt-0.5">
                    {isPaid ? 'Unlimited sessions' : `${FREE_SESSIONS_PER_MONTH} sessions per month`}
                  </div>
                </div>
                <div
                  className="px-2.5 py-1 rounded-full text-[13px] font-medium"
                  style={{
                    background: isPaid ? 'rgba(201,168,76,.1)' : 'rgba(139,167,184,.08)',
                    color: isPaid ? 'var(--gold2)' : 'var(--mist)',
                    border: isPaid ? '1px solid rgba(201,168,76,.2)' : '1px solid rgba(139,167,184,.15)',
                  }}
                >
                  {PLAN_LABELS[subStatus.planTier] ?? 'Free'}
                </div>
              </div>

              {subStatus.authenticated && subStatus.planTier === 'free' && (
                <div className="flex justify-between items-center py-2 border-b border-white/[.04]">
                  <div className="text-base text-sand">Sessions this month</div>
                  <div className="text-base text-mist">
                    {subStatus.sessionsThisMonth ?? 0} / {FREE_SESSIONS_PER_MONTH}
                  </div>
                </div>
              )}

              {isPaid && periodEnd && (
                <div className="flex justify-between items-center py-2 border-b border-white/[.04]">
                  <div className="text-base text-sand">
                    {subStatus.subscription?.cancel_at_period_end ? 'Cancels on' : 'Renews on'}
                  </div>
                  <div className="text-base text-mist">{periodEnd}</div>
                </div>
              )}

              <div className="pt-3">
                {isPaid ? (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="btn-outline text-sm w-full py-2.5 disabled:opacity-50"
                  >
                    {portalLoading ? 'Opening…' : 'Manage billing & subscription →'}
                  </button>
                ) : (
                  <Link href="/pricing" className="btn-primary text-sm block text-center w-full py-2.5">
                    Upgrade plan →
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="py-3 text-center">
              <div className="w-5 h-5 rounded-full animate-spin-slow mx-auto" style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }} />
            </div>
          )}
        </div>

        {/* What is stored */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[11px] tracking-[.11em] uppercase text-mist mb-2 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Phase 1 — what is stored
          </div>
          {[
            { label: 'Session content', sub: 'Emotion tags, context text, Mirror output — encrypted' },
            { label: 'Session count', sub: 'Number and timestamps — for return measurement' },
            { label: 'Resonance tap result', sub: 'Accurate / Not quite — anonymous aggregate' },
          ].map(({ label, sub }) => (
            <div key={label} className="flex justify-between items-center py-2.5 border-b border-white/[.04] last:border-0">
              <div>
                <div className="text-base text-sand">{label}</div>
                <div className="text-[13px] text-mist mt-0.5">{sub}</div>
              </div>
              <div
                className="w-7 h-4 rounded-full relative flex-shrink-0"
                style={{ background: 'var(--gold)' }}
              >
                <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-white" />
              </div>
            </div>
          ))}
        </div>

        {/* Delete */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[11px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Delete your data
          </div>

          {deleted ? (
            <p className="text-base text-mist text-center py-2">All data deleted. Redirecting…</p>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-2.5 text-sm rounded-lg text-center mb-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ border: '1px solid rgba(212,64,64,.3)', color: 'rgba(212,64,64,.75)', background: 'transparent' }}
              >
                {confirmDelete
                  ? 'Tap again to confirm — this is permanent'
                  : 'Delete all my sessions and data →'}
              </button>
              <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(139,167,184,.68)' }}>
                Permanent. Encrypted. No recycle bin. CPRA compliant.<br />
                Full privacy dashboard ships in Phase 2.
              </p>
            </>
          )}
        </div>

        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(139,167,184,.62)' }}>
          Phase 2 will add: toggle controls per data type, export, assessment reset, notification preferences.
        </p>
      </div>
    </main>
  )
}
