'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'

interface RetentionData {
  activeUsers: {
    dau: number
    wau: number
    mau: number
    stickinessWAU: number | null
  }
  retention: {
    returningUsers: number
    usersWithSessions: number
    returningRate: number
    avgSessionsPerUser: number
    sessionDistribution: Array<{ label: string; count: number }>
  }
  dailyActiveUsers: Array<{ date: string; count: number }>
  cohorts: Array<{
    week: string
    cohortSize: number
    returnedWeek1: number
    returnedWeek2: number
    week1Rate: number | null
    week2Rate: number | null
  }>
  resonanceByUserType: {
    returning: { total: number; accurate: number; rate: number | null }
    new: { total: number; accurate: number; rate: number | null }
  }
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

// ── DAU Sparkline ──────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#C9A84C', height = 60 }: {
  data: number[]; color?: string; height?: number
}) {
  if (data.length < 2) return <div style={{ height }} />
  const max = Math.max(...data, 1)
  const w = 100, h = height
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.9}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.07" />
    </svg>
  )
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={card}>
      <div style={sectionLabel}>{label}</div>
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

// ── Cohort heatmap row ─────────────────────────────────────────────────────────
function CohortCell({ rate, label }: { rate: number | null; label?: string }) {
  if (rate === null) {
    return (
      <td style={{
        padding: '6px 10px', textAlign: 'center',
        fontSize: '11px', color: 'rgba(139,167,184,.3)',
      }}>
        {label ?? '—'}
      </td>
    )
  }
  const color = rate >= 40 ? '#3DAF96' : rate >= 20 ? '#C9A84C' : rate > 0 ? '#C4784A' : '#D44040'
  const bg = rate >= 40 ? 'rgba(61,175,150,.12)' : rate >= 20 ? 'rgba(201,168,76,.12)' : rate > 0 ? 'rgba(196,120,74,.1)' : 'rgba(212,64,64,.06)'
  return (
    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
      <span style={{
        display: 'inline-block', padding: '3px 8px', borderRadius: '4px',
        background: bg, color, fontSize: '12px', fontWeight: 600, minWidth: '40px',
      }}>
        {rate}%
      </span>
    </td>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
function RetentionInner() {
  const searchParams = useSearchParams()
  const env = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv

  const [data, setData]     = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/admin/retention?env=${env}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [env])

  const r = data?.retention
  const a = data?.activeUsers

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Retention · {env.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
          User Retention
        </h1>
      </div>

      {error && (
        <div style={{ padding: '14px 16px', background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)', borderRadius: 'var(--r-lg)', color: '#D44040', fontSize: 'var(--fs-sm)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }} />
          Loading retention data…
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── Section 1: Active users (DAU / WAU / MAU) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <StatCard label="DAU" value={a!.dau} sub="Unique users — last 24h" />
            <StatCard label="WAU" value={a!.wau} sub="Unique users — last 7d" color="#C9A84C" />
            <StatCard label="MAU" value={a!.mau} sub="Unique users — last 30d" />
            <StatCard
              label="WAU/MAU Stickiness"
              value={a!.stickinessWAU !== null ? `${a!.stickinessWAU}%` : '—'}
              sub="Weekly engagement / monthly reach"
              color={a!.stickinessWAU !== null && a!.stickinessWAU >= 20 ? '#3DAF96' : 'var(--sand2)'}
            />
            <StatCard
              label="Returning Rate"
              value={`${r!.returningRate}%`}
              sub={`${r!.returningUsers} of ${r!.usersWithSessions} users returned (90d)`}
              color={r!.returningRate >= 30 ? '#3DAF96' : r!.returningRate >= 15 ? '#C9A84C' : 'var(--sand2)'}
            />
            <StatCard
              label="Avg Sessions / User"
              value={r!.avgSessionsPerUser}
              sub="All time average"
              color="#C9A84C"
            />
          </div>

          {/* ── Section 2: DAU chart + session distribution ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>

            <div style={card}>
              <div style={sectionLabel}>Daily Active Users — Last 30d</div>
              {data.dailyActiveUsers.length < 2 ? (
                <div style={metaText}>Not enough data yet.</div>
              ) : (
                <>
                  <Sparkline data={data.dailyActiveUsers.map(d => d.count)} color="#3DAF96" height={70} />
                  <div style={{ ...metaText, marginTop: '8px' }}>
                    {data.dailyActiveUsers.slice(-1)[0]?.count ?? 0} active users today
                    · Peak: {Math.max(...data.dailyActiveUsers.map(d => d.count))} in a day
                  </div>
                  <div style={{ ...metaText, marginTop: '2px' }}>
                    Avg: {Math.round(data.dailyActiveUsers.reduce((a, b) => a + b.count, 0) / data.dailyActiveUsers.length)} DAU over 30d
                  </div>
                </>
              )}
            </div>

            <div style={card}>
              <div style={sectionLabel}>Sessions per User Distribution</div>
              {(() => {
                const max = Math.max(...r!.sessionDistribution.map(d => d.count), 1)
                return r!.sessionDistribution.map((d, i) => {
                  const colors = ['rgba(139,167,184,.5)', '#6B8CAE', '#C9A84C', '#3DAF96', '#C4784A']
                  return (
                    <HBar
                      key={d.label}
                      value={d.count}
                      max={max}
                      color={colors[i] ?? '#6B8CAE'}
                      label={d.label}
                      sub={`${d.count} users`}
                    />
                  )
                })
              })()}
              <div style={{ ...metaText, marginTop: '8px', borderTop: '1px solid var(--hairline)', paddingTop: '8px' }}>
                {r!.sessionDistribution.filter(d => d.label !== '1 session').reduce((a, b) => a + b.count, 0)} users have returned at least once
              </div>
            </div>
          </div>

          {/* ── Section 3: Cohort retention table ── */}
          <div style={{ ...card, marginBottom: '20px' }}>
            <div style={sectionLabel}>Weekly Cohort Retention (Last 8 Weeks)</div>
            <div style={{ ...metaText, marginBottom: '14px' }}>
              % of users from each signup week who returned in the following week(s).
              Grey = cohort too recent to measure.
            </div>
            {data.cohorts.every(c => c.cohortSize === 0) ? (
              <div style={metaText}>Not enough signup data to build cohort table yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['Signup week', 'Cohort size', 'Week 1 return', 'Week 2 return'].map(h => (
                        <th key={h} style={{
                          textAlign: h === 'Signup week' ? 'left' : 'center',
                          padding: '6px 10px',
                          fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase',
                          color: 'var(--mist)', borderBottom: '1px solid var(--hairline)',
                          fontWeight: 500,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohorts.map(c => (
                      <tr key={c.week} style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--sand)', fontSize: '12px' }}>
                          {c.week}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--mist)', fontSize: '13px' }}>
                          {c.cohortSize === 0 ? '—' : c.cohortSize}
                        </td>
                        <CohortCell rate={c.cohortSize === 0 ? null : c.week1Rate} />
                        <CohortCell rate={c.cohortSize === 0 ? null : c.week2Rate} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ ...metaText, marginTop: '12px' }}>
              Colour scale: <span style={{ color: '#3DAF96' }}>≥ 40%</span> excellent ·&nbsp;
              <span style={{ color: '#C9A84C' }}>≥ 20%</span> good ·&nbsp;
              <span style={{ color: '#C4784A' }}>&gt; 0%</span> low ·&nbsp;
              <span style={{ color: '#D44040' }}>0%</span> no returns
            </div>
          </div>

          {/* ── Section 4: Resonance by user type ── */}
          <div style={{ ...card, marginBottom: '8px' }}>
            <div style={sectionLabel}>Mirror Resonance — Returning vs. New Users</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {[
                { label: 'Returning Users', data: data.resonanceByUserType.returning, color: '#3DAF96' },
                { label: 'New Users',       data: data.resonanceByUserType.new,       color: '#C9A84C' },
              ].map(({ label, data: rd, color }) => (
                <div key={label} style={{
                  padding: '14px 16px', background: 'rgba(245,237,216,.02)',
                  borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)',
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '8px' }}>{label}</div>
                  <div style={{
                    fontSize: '36px', fontFamily: 'var(--font-serif)', fontWeight: 300,
                    color: rd.rate !== null && rd.rate >= 60 ? '#3DAF96' : rd.rate !== null && rd.rate >= 50 ? '#C9A84C' : color,
                    lineHeight: 1,
                  }}>
                    {rd.rate !== null ? `${rd.rate}%` : '—'}
                  </div>
                  <div style={{ ...metaText, marginTop: '4px' }}>
                    {rd.accurate} accurate / {rd.total} tapped
                  </div>
                  {rd.rate !== null && (
                    <div style={{
                      fontSize: '10px', marginTop: '6px',
                      color: rd.rate >= 60 ? '#3DAF96' : '#D44040',
                    }}>
                      {rd.rate >= 60 ? '✓ Above 60% target' : '✕ Below 60% target'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ ...metaText, marginTop: '12px' }}>
              Higher resonance in returning users suggests the Mirror improves as it learns the emotional patterns
              users bring across sessions. Target: &gt; 60% for both groups.
            </div>
          </div>

          <div style={{ ...metaText, textAlign: 'right', marginTop: '12px' }}>
            Retention data · {env.toUpperCase()} environment · Cohort window: 90 days · Times UTC
          </div>
        </>
      )}
    </div>
  )
}

function LoadingShell() {
  return <div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
}

export default function RetentionPage() {
  return <Suspense fallback={<LoadingShell />}><RetentionInner /></Suspense>
}
