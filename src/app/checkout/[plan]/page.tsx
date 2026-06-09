'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { createClient } from '@/lib/supabase/client'
import { PLANS } from '@/lib/stripe/plans'
import type { PaidPlan } from '@/lib/stripe/plans'

const CHECKOUT_META: Record<PaidPlan, { tagline: string }> = {
  essentials: { tagline: 'Unlimited sessions. Full history. No monthly cap.' },
  insights:   { tagline: 'Deep pattern tracking and season trend analysis across all your sessions.' },
}

const TRUST_SIGNALS = [
  {
    icon: '⚿',
    label: 'AES-256-GCM encrypted',
    desc: 'Session content is encrypted before storage. Soul Space cannot read it.',
  },
  {
    icon: '↩',
    label: 'Cancel any time',
    desc: 'No lock-in. Cancel in seconds from your account settings.',
  },
  {
    icon: '🛡',
    label: 'No card details stored',
    desc: 'Payments are handled by Stripe. Soul Space never sees your card.',
  },
]

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const plan = params.plan as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (plan !== 'essentials' && plan !== 'insights') {
      router.replace('/pricing')
      return
    }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace(`/auth/signin?next=/checkout/${plan}`)
      } else {
        setReady(true)
      }
    })
  }, [plan, router])

  const handleProceed = async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ planTier: plan }),
      })
      const data = await res.json() as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      window.location.href = data.url
    } catch {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#060E18' }}>
        <div
          className="w-7 h-7 rounded-full"
          style={{
            border: '1.5px solid rgba(201,168,76,.12)',
            borderTopColor: 'var(--gold)',
            animation: 'spin 0.9s linear infinite',
          }}
        />
      </main>
    )
  }

  const planData = PLANS[plan as PaidPlan]
  const meta = CHECKOUT_META[plan as PaidPlan]

  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#060E18' }}>

      {/* ── Header ────────────────────────────────────── */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
      >
        <Logo size="md" />
        <Link
          href="/pricing"
          className="text-[10px] hover:text-sand transition-colors"
          style={{ color: 'rgba(213,226,235,.72)', textDecoration: 'none' }}
        >
          ← Back to plans
        </Link>
      </header>

      {/* ── Body ──────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-md animate-fade-in">

          {/* Step tracker */}
          <div className="flex items-center gap-0 mb-9">
            <Step n={1} label="Choose plan" active done />
            <Connector filled />
            <Step n={2} label="Payment" active={false} done={false} current />
            <Connector filled={false} />
            <Step n={3} label="Active" active={false} done={false} />
          </div>

          {/* Plan card */}
          <div
            className="rounded-2xl p-6 mb-5"
            style={{
              background: 'rgba(15,30,46,.65)',
              border: '1px solid rgba(201,168,76,.22)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Plan header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div
                  className="text-[8px] tracking-[.16em] uppercase mb-1.5"
                  style={{ color: 'var(--gold)' }}
                >
                  Soul Space
                </div>
                <div className="font-serif font-light text-sand2 text-xl leading-tight">
                  {planData.name}
                </div>
                <div
                  className="text-[10px] leading-relaxed mt-1 max-w-[200px]"
                  style={{ color: 'rgba(139,167,184,.7)' }}
                >
                  {meta.tagline}
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <div className="font-serif font-light text-sand2 text-2xl">
                  {planData.priceDisplay}
                </div>
                <div className="text-[9px] text-mist">per month</div>
              </div>
            </div>

            <div className="h-px mb-5" style={{ background: 'rgba(201,168,76,.08)' }} />

            {/* Features */}
            <ul className="space-y-2.5 mb-5">
              {planData.features.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-[11px] text-sand leading-relaxed">
                  <span style={{ color: 'var(--teal2)', fontSize: '12px', flexShrink: 0 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="h-px mb-4" style={{ background: 'rgba(201,168,76,.08)' }} />

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-mist">Total due today</span>
              <span className="text-sand2 text-[13px] font-medium">{planData.priceDisplay}</span>
            </div>
            <div className="text-[9px] text-right mt-0.5" style={{ color: 'rgba(213,226,235,.65)' }}>
              Billed monthly · Cancel any time
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-[11px] text-center"
              style={{
                background: 'rgba(212,64,64,.07)',
                border: '1px solid rgba(212,64,64,.18)',
                color: 'var(--danger)',
              }}
            >
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleProceed}
            disabled={loading}
            className="btn-primary w-full py-3.5 text-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{
                    border: '1.5px solid rgba(8,17,28,.25)',
                    borderTopColor: 'var(--ink)',
                    animation: 'spin 0.9s linear infinite',
                  }}
                />
                Redirecting to payment…
              </span>
            ) : (
              'Proceed to secure payment →'
            )}
          </button>

          {/* Stripe badge */}
          <p className="text-[9px] text-center mt-2.5" style={{ color: 'rgba(213,226,235,.60)' }}>
            Payments secured by Stripe · PCI DSS Level 1
          </p>

          {/* Trust signals */}
          <div className="mt-8 space-y-4">
            {TRUST_SIGNALS.map(s => (
              <div key={s.label} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px]"
                  style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.1)' }}
                >
                  {s.icon}
                </span>
                <div>
                  <div className="text-[10px] text-sand leading-tight">{s.label}</div>
                  <div className="text-[9px] leading-relaxed mt-0.5" style={{ color: 'rgba(213,226,235,.65)' }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="text-[9px] text-center mt-8 leading-relaxed" style={{ color: 'rgba(213,226,235,.56)' }}>
            Soul Space is not a medical service. Sessions are a private pause,<br />
            not treatment or advice.
          </p>
        </div>
      </div>
    </main>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Step({
  n,
  label,
  done = false,
  current = false,
}: {
  n: number
  label: string
  active?: boolean
  done?: boolean
  current?: boolean
}) {
  const bg = done
    ? 'var(--gold)'
    : current
    ? 'transparent'
    : 'transparent'

  const textColor = done
    ? 'var(--ink)'
    : current
    ? 'var(--gold2)'
    : 'rgba(139,167,184,.3)'

  const border = done
    ? 'none'
    : current
    ? '1px solid rgba(201,168,76,.5)'
    : '1px solid rgba(139,167,184,.15)'

  const labelColor = done
    ? 'var(--gold)'
    : current
    ? 'var(--gold2)'
    : 'rgba(139,167,184,.3)'

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium"
        style={{ background: bg, border, color: textColor }}
      >
        {done ? '✓' : n}
      </div>
      <span className="text-[8px] tracking-[.04em] whitespace-nowrap" style={{ color: labelColor }}>
        {label}
      </span>
    </div>
  )
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <div
      className="flex-1 h-px mx-2 mb-4"
      style={{ background: filled ? 'rgba(201,168,76,.3)' : 'rgba(139,167,184,.1)' }}
    />
  )
}
