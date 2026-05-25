'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'
import { AdminEnvNotConfigured } from '@/components/ui/AdminEnvNotConfigured'

interface RevenueData {
  mrr: number
  arr: number
  activeSubscriptions: {
    total: number
    essentials: number
    insights: number
  }
  churn: {
    cancellingCount: number
    churnRate: number
  }
  newInWindow: {
    days: number
    total: number
    essentials: number
    insights: number
    revenue: number
  }
  newSubs7d: number
  conversion: {
    totalUsers: number
    paidUsers: number
    conversionRate: number
  }
  dailyNewSubs: Array<{ date: string; essentials: number; insights: number; total: number }>
  recentSubscriptions: Array<{
    id: string
    planTier: string
    status: string
    cancelAtPeriodEnd: boolean
    createdAt: string
    currentPeriodEnd: string | null
    customerId: string
  }>
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--ink2)', border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-lg)', padding: '18px 20px',
}
const sectionLabel: React.CSSProperties = {
  fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px',
}
const metaText: React.CSSProperties = {
  fontSize: '11px', color: 'var(--mist)', lineHeight: 1.6,
}

// ── Mini sparkline ─────────────────────────────────────────────────────────────
function Sparkline({
  data, color = '#C9A84C', height = 48, secondaryData, secondaryColor,
}: {
  data: number[]; color?: string; height?: number
  secondaryData?: number[]; secondaryColor?: string
}) {
  if (data.length < 2) return <div style={{ height }} />
  const max = Math.max(...data, ...(secondaryData ?? []), 1)
  const w = 100, h = height
  const pts = (vals: number[]) =>
    vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h * 0.9}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      {secondaryData && (
        <polyline points={pts(secondaryData)} fill="none"
          stroke={secondaryColor ?? 'rgba(139,167,184,.3)'} strokeWidth="1" strokeDasharray="2 2" />
      )}
      <polyline points={pts(data)} fill="none" stroke={color} strokeWidth="1.5" />
      <polygon points={`0,${h} ${pts(data)} ${w},${h}`} fill={color} opacity="0.07" />
    </svg>
  )
}

function StatCard({
  label, value, sub, color, pill,
}: {
  label: string; value: string; sub?: string; color?: string
  pill?: { text: string; color: string; bg: string }
}) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div style={sectionLabel}>{label}</div>
        {pill && (
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
            color: pill.color, background: pill.bg, border: `1px solid ${pill.color}40`,
          }}>{pill.text}</span>
        )}
      </div>
      <div style={{
        fontSize: '32px', fontFamily: 'var(--font-serif)', fontWeight: 300,
        color: color ?? 'var(--sand2)', lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && <div style={{ ...metaText, marginTop: '6px' }}>{sub}</div>}
    </div>
  )
}

function HBar({ value, max, color, label, sub }: {
  value: number; max: number; color: string; label: string; sub?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: 'var(--sand)' }}>{label}</span>
        <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{sub ?? value.toLocaleString()}</span>
      </div>
      <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(245,237,216,.05)' }}>
        <div style={{ height: '100%', borderRadius: '3px', width: `${pct}%`, background: color, transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Main ───────────────────────────────────────────────────────────────────────
function RevenueInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const env  = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const days = parseInt(searchParams.get('days') ?? '30', 10)

  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set(key, val)
    router.push(`${pathname}?${p.toString()}`)
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    setNotConfigured(false)
    fetch(`/api/admin/revenue?env=${env}&days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.not_configured) { setNotConfigured(true); return }; if (d.error) throw new Error(d.error); setNotConfigured(false); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [env, days])

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
            Revenue · {env.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
            Revenue & Subscriptions
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setParam('days', String(d))} style={{
              padding: '7px 12px', fontSize: 'var(--fs-3xs)', fontFamily: 'var(--font-sans)',
              background: days === d ? 'rgba(201,168,76,.12)' : 'var(--ink2)',
              color: days === d ? 'var(--gold2)' : 'var(--mist)',
              border: days === d ? '1px solid rgba(201,168,76,.3)' : '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)', cursor: 'pointer', outline: 'none',
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 16px', background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)', borderRadius: 'var(--r-lg)', color: '#D44040', fontSize: 'var(--fs-sm)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }} />
          Loading revenue data…
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── Section 1: Key metrics ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>

            <StatCard
              label="MRR"
              value={fmt(data.mrr)}
              sub={`${data.activeSubscriptions.total} active subscriptions`}
              color="#3DAF96"
            />
            <StatCard
              label="ARR (projected)"
              value={fmt(data.arr)}
              sub="MRR × 12"
              color="#C9A84C"
            />
            <StatCard
              label={`New Revenue (${days}d)`}
              value={fmt(data.newInWindow.revenue)}
              sub={`${data.newInWindow.total} new subscriptions`}
            />
            <StatCard
              label="Conversion Rate"
              value={`${data.conversion.conversionRate}%`}
              sub={`${data.conversion.paidUsers} paid / ${data.conversion.totalUsers} total users`}
              pill={
                data.conversion.conversionRate >= 5
                  ? { text: '✓ Healthy', color: '#3DAF96', bg: 'rgba(42,140,122,.1)' }
                  : { text: 'Low', color: '#C9A84C', bg: 'rgba(201,168,76,.1)' }
              }
            />
            <StatCard
              label="Pending Cancellations"
              value={String(data.churn.cancellingCount)}
              sub={`${data.churn.churnRate}% of active subs cancelling`}
              color={data.churn.cancellingCount > 0 ? '#D44040' : '#3DAF96'}
            />
          </div>

          {/* ── Section 2: Plan breakdown + daily chart ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>

            {/* Plan breakdown */}
            <div style={card}>
              <div style={sectionLabel}>Active Subscriptions by Plan</div>
              {[
                { label: 'Essentials', count: data.activeSubscriptions.essentials, color: '#C9A84C', price: '$9.99/mo' },
                { label: 'Insights',   count: data.activeSubscriptions.insights,   color: '#3DAF96', price: '$19.99/mo' },
              ].map(({ label, count, color, price }) => (
                <div key={label} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--sand)' }}>{label}</span>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{price}</span>
                      <span style={{ fontSize: '15px', fontFamily: 'var(--font-serif)', color }}>
                        {count}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(245,237,216,.05)' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px', background: color,
                      width: `${data.activeSubscriptions.total > 0 ? (count / data.activeSubscriptions.total) * 100 : 0}%`,
                      transition: 'width .4s ease',
                    }} />
                  </div>
                  <div style={{ ...metaText, marginTop: '4px' }}>
                    {fmt(count * (label === 'Essentials' ? 9.99 : 19.99))} / month
                  </div>
                </div>
              ))}

              {/* Total MRR breakdown */}
              <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '12px', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={metaText}>Total MRR</span>
                  <span style={{ fontSize: '18px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: '#3DAF96' }}>
                    {fmt(data.mrr)}
                  </span>
                </div>
              </div>
            </div>

            {/* Daily new subscriptions sparkline */}
            <div style={card}>
              <div style={sectionLabel}>Daily New Subscriptions (30d)</div>
              {data.dailyNewSubs.length < 2 ? (
                <div style={metaText}>Not enough data yet.</div>
              ) : (
                <>
                  <Sparkline
                    data={data.dailyNewSubs.map(d => d.total)}
                    secondaryData={data.dailyNewSubs.map(d => d.insights)}
                    color="#C9A84C"
                    secondaryColor="rgba(61,175,150,.6)"
                    height={70}
                  />
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    {[
                      { label: 'All new', color: '#C9A84C' },
                      { label: 'Insights', color: 'rgba(61,175,150,.6)', dashed: true },
                    ].map(({ label, color, dashed }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{
                          width: '20px', height: '2px',
                          background: dashed ? 'none' : color,
                          borderRadius: '1px',
                          borderTop: dashed ? `1px dashed ${color}` : undefined,
                        }} />
                        <span style={metaText}>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ ...metaText, marginTop: '8px' }}>
                    {data.newSubs7d} new subscriptions in last 7d
                    · {data.newInWindow.total} in last {days}d
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Section 3: Conversion funnel ── */}
          <div style={{ ...card, marginBottom: '20px' }}>
            <div style={sectionLabel}>User Conversion Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {[
                { label: 'Free',       count: data.conversion.totalUsers - data.conversion.paidUsers, color: 'rgba(139,167,184,.4)' },
                { label: 'Essentials', count: data.activeSubscriptions.essentials, color: '#C9A84C' },
                { label: 'Insights',   count: data.activeSubscriptions.insights, color: '#3DAF96' },
              ].map(({ label, count, color }) => {
                const total = data.conversion.totalUsers
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={label}>
                    <HBar value={count} max={total} color={color} label={label} sub={`${count} users (${pct}%)`} />
                  </div>
                )
              })}
            </div>
            <div style={{ ...metaText, marginTop: '12px', borderTop: '1px solid var(--hairline)', paddingTop: '10px' }}>
              {data.conversion.paidUsers} paid users · {data.conversion.conversionRate}% conversion rate
              · {data.newInWindow.total} converted in the last {days}d
            </div>
          </div>

          {/* ── Section 4: Recent subscriptions table ── */}
          <div style={card}>
            <div style={sectionLabel}>Recent Subscriptions</div>
            {data.recentSubscriptions.length === 0 ? (
              <div style={metaText}>No subscriptions yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['Plan', 'Status', 'Created', 'Renews', 'Customer'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '6px 10px',
                          fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase',
                          color: 'var(--mist)', borderBottom: '1px solid var(--hairline)',
                          fontWeight: 500,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSubscriptions.map((s, i) => {
                      const planColor = s.planTier === 'insights' ? '#3DAF96' : '#C9A84C'
                      const isCancelling = s.cancelAtPeriodEnd
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              fontSize: '11px', fontWeight: 600, padding: '2px 7px',
                              borderRadius: '4px', color: planColor,
                              background: `${planColor}18`,
                              border: `1px solid ${planColor}30`,
                              textTransform: 'capitalize',
                            }}>
                              {s.planTier}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {isCancelling ? (
                              <span style={{ fontSize: '11px', color: '#D44040' }}>Cancelling</span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#3DAF96' }}>Active</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--mist)' }}>
                            {new Date(s.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--mist)' }}>
                            {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'rgba(139,167,184,.5)', fontFamily: 'monospace', fontSize: '11px' }}>
                            {s.customerId}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ ...metaText, textAlign: 'right', marginTop: '12px' }}>
            Revenue data · {env.toUpperCase()} environment · Stripe prices: Essentials $9.99 · Insights $19.99
          </div>
        </>
      )}
    </div>
  )
}

function LoadingShell() {
  return <div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
}

export default function RevenuePage() {
  return <Suspense fallback={<LoadingShell />}><RevenueInner /></Suspense>
}
