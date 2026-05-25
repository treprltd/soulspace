'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'

interface Stats {
  users: {
    total: number
    newToday: number
    new7d: number
    planBreakdown: { free: number; essentials: number; insights: number }
  }
  sessions: {
    total: number
    today: number
    last7d: number
    completed: number
    completionRate: number | null
    branchBreakdown: Record<string, number>
  }
  mirror: {
    resonanceRate: number | null
    accurateCount: number
    totalTapped: number
    targetMet: boolean | null
  }
  safety: {
    total: number
    unreviewed: number
  }
  funnel: {
    sessionStart: number
    branchSelected: number
    mirrorRendered: number
    sessionComplete: number
    window: string
  }
  system: {
    lastSessionAt: string | null
    avgMirrorMs: number | null
    mirrorSampleSize: number
  }
}

const BRANCH_LABELS: Record<string, string> = {
  A: 'Decision Pressure',
  B: 'Something Unnamed',
  C: 'Pattern Repeating',
  D: 'Carrying Alone',
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div style={{
      background: 'var(--ink2)', border: '1px solid var(--hairline)',
      borderRadius: 'var(--r-lg)', padding: '18px 20px',
    }}>
      <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: accent ?? 'var(--sand2)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', marginTop: '6px' }}>{sub}</div>
      )}
    </div>
  )
}

function ResonanceMeter({ rate, target = 60 }: { rate: number | null; target?: number }) {
  const pct = rate ?? 0
  const met = rate !== null && rate >= target
  const color = rate === null ? 'var(--mist)' : met ? '#3DAF96' : '#D44040'

  return (
    <div style={{
      background: 'var(--ink2)', border: `1px solid ${color}30`,
      borderRadius: 'var(--r-lg)', padding: '18px 20px',
    }}>
      <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Mirror Resonance Rate
        <span style={{
          fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
          background: 'rgba(201,168,76,.14)', border: '1px solid rgba(201,168,76,.4)',
          color: 'var(--gold2)',
        }}>
          KEY METRIC
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '40px', fontFamily: 'var(--font-serif)', fontWeight: 300, color, lineHeight: 1 }}>
          {rate !== null ? `${rate}%` : '—'}
        </div>
        <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', paddingBottom: '4px' }}>
          {rate !== null ? (met ? '✓ Target met' : `✕ Below ${target}% target`) : 'No data yet'}
        </div>
      </div>

      {/* Bar */}
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(245,237,216,.06)', position: 'relative', marginBottom: '6px' }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${Math.min(pct, 100)}%`,
          background: color, transition: 'width .5s ease',
        }} />
        {/* Target marker */}
        <div style={{
          position: 'absolute', top: '-4px', bottom: '-4px',
          left: `${target}%`, width: '1px',
          background: 'rgba(245,237,216,.3)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--mist)' }}>
        <span>0%</span>
        <span style={{ color: 'rgba(245,237,216,.5)' }}>{target}% target</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function DashboardInner() {
  const searchParams = useSearchParams()
  const env = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/admin/stats?env=${env}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setStats(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [env])

  if (loading) return <LoadingShell />
  if (error) return <ErrorShell message={error} />
  if (!stats) return null

  const { users, sessions, mirror, safety, funnel, system } = stats
  const totalBranch = Object.values(sessions.branchBreakdown).reduce((a, b) => a + b, 0)

  // Funnel drop-off helpers
  function dropPct(from: number, to: number) {
    if (from === 0) return null
    return Math.round(((from - to) / from) * 100)
  }
  function throughPct(top: number, n: number) {
    if (top === 0) return null
    return Math.round((n / top) * 100)
  }

  // System health: relative time of last session
  function relativeTime(iso: string | null) {
    if (!iso) return 'No sessions yet'
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 2) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Overview · {env.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
          Dashboard
        </h1>
      </div>

      {/* Safety alert */}
      {safety.unreviewed > 0 && (
        <Link href={`/admin/safety?env=${env}&reviewed=false`} style={{ textDecoration: 'none' }}>
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: 'var(--r-lg)',
            background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ fontSize: '18px' }}>⚑</span>
            <div>
              <div style={{ fontSize: 'var(--fs-sm)', color: '#D44040', fontWeight: 600 }}>
                {safety.unreviewed} unreviewed safety event{safety.unreviewed !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)' }}>
                Click to review → Safety monitor
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Key metric */}
      <div style={{ marginBottom: '20px' }}>
        <ResonanceMeter rate={mirror.resonanceRate} />
      </div>

      {/* Stat grid — 4 cols */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Total Users" value={users.total.toLocaleString()} sub={`+${users.newToday} today · +${users.new7d} this week`} />
        <StatCard label="Total Sessions" value={sessions.total.toLocaleString()} sub={`${sessions.today} today · ${sessions.last7d} this week`} />
        <StatCard label="Completion Rate" value={sessions.completionRate !== null ? `${sessions.completionRate}%` : '—'} sub={`${sessions.completed} completed sessions`} />
        <StatCard
          label="Safety Events"
          value={safety.unreviewed > 0 ? `${safety.unreviewed} pending` : safety.total.toLocaleString()}
          sub={safety.unreviewed > 0 ? `${safety.total} total` : 'None unreviewed'}
          accent={safety.unreviewed > 0 ? '#D44040' : undefined}
        />
      </div>

      {/* ── Session Funnel (7d) ───────────────────────────────────────────── */}
      <div style={{
        background: 'var(--ink2)', border: '1px solid rgba(245,237,216,.07)',
        borderRadius: '12px', padding: '18px 20px', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Session Funnel — last 7 days</span>
          <Link href={`/admin/analytics?env=${env}`} style={{ color: 'rgba(201,168,76,.5)', textDecoration: 'none', fontSize: '10px' }}>Full analytics →</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '0' }}>
          {[
            { label: 'Started', n: funnel.sessionStart, key: 'sessionStart' },
            { label: 'Branch picked', n: funnel.branchSelected, key: 'branchSelected' },
            { label: 'Mirror shown', n: funnel.mirrorRendered, key: 'mirrorRendered' },
            { label: 'Completed', n: funnel.sessionComplete, key: 'sessionComplete' },
          ].map((step, i, arr) => {
            const pct = throughPct(funnel.sessionStart, step.n)
            const drop = i > 0 ? dropPct(arr[i - 1].n, step.n) : null
            const isBottleneck = drop !== null && drop > 40
            return (
              <div key={step.key} style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
                {/* Step block */}
                <div style={{
                  flex: 1, padding: '12px 10px', borderRadius: '8px',
                  background: pct !== null && pct < 40 ? 'rgba(212,64,64,.05)' : 'rgba(245,237,216,.025)',
                  border: `1px solid ${pct !== null && pct < 40 ? 'rgba(212,64,64,.15)' : 'rgba(245,237,216,.05)'}`,
                }}>
                  <div style={{ fontSize: '18px', fontFamily: 'var(--font-cormorant, Georgia)', fontWeight: 300, color: '#FAF7F0', lineHeight: 1, marginBottom: '4px' }}>
                    {step.n}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8BA7B8', marginBottom: '2px' }}>{step.label}</div>
                  <div style={{ fontSize: '10px', color: pct !== null && pct < 40 ? '#D44040' : '#3DAF96' }}>
                    {pct !== null ? `${pct}% through` : '—'}
                  </div>
                </div>
                {/* Drop-off arrow between steps */}
                {i < arr.length - 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '28px', flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', color: isBottleneck ? '#D44040' : 'rgba(139,167,184,.4)', textAlign: 'center' }}>
                      {drop !== null ? `−${drop}%` : '→'}
                    </div>
                    <div style={{ fontSize: '14px', color: isBottleneck ? '#D44040' : 'rgba(139,167,184,.25)' }}>›</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── System Health ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--ink2)', border: '1px solid rgba(245,237,216,.07)',
        borderRadius: '12px', padding: '14px 20px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9A84C', flexShrink: 0 }}>
          System Health
        </div>

        {/* Last session */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: system.lastSessionAt ? '#3DAF96' : '#8BA7B8', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: '#8BA7B8' }}>Last session:</span>
          <span style={{ fontSize: '12px', color: '#FAF7F0' }}>{relativeTime(system.lastSessionAt)}</span>
        </div>

        {/* Mirror avg response */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
            background: system.avgMirrorMs === null ? '#8BA7B8'
              : system.avgMirrorMs < 4000 ? '#3DAF96'
              : system.avgMirrorMs < 8000 ? '#C9A84C'
              : '#D44040',
          }} />
          <span style={{ fontSize: '12px', color: '#8BA7B8' }}>Mirror avg:</span>
          <span style={{ fontSize: '12px', color: '#FAF7F0' }}>
            {system.avgMirrorMs !== null
              ? `${(system.avgMirrorMs / 1000).toFixed(1)}s`
              : '—'
            }
          </span>
          {system.mirrorSampleSize > 0 && (
            <span style={{ fontSize: '10px', color: 'rgba(139,167,184,.45)' }}>
              ({system.mirrorSampleSize} samples)
            </span>
          )}
        </div>

        {/* Completion rate pulse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
            background: sessions.completionRate === null ? '#8BA7B8'
              : sessions.completionRate >= 60 ? '#3DAF96'
              : sessions.completionRate >= 40 ? '#C9A84C'
              : '#D44040',
          }} />
          <span style={{ fontSize: '12px', color: '#8BA7B8' }}>Completion:</span>
          <span style={{ fontSize: '12px', color: '#FAF7F0' }}>
            {sessions.completionRate !== null ? `${sessions.completionRate}%` : '—'}
          </span>
        </div>
      </div>

      {/* Two-column: plan breakdown + branch breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>

        {/* Plan distribution */}
        <div style={{ background: 'var(--ink2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '18px 20px' }}>
          <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px' }}>
            Users by Plan
          </div>
          {([['free', 'Free', 'var(--mist)'], ['essentials', 'Essentials', '#C9A84C'], ['insights', 'Insights', '#3DAF96']] as const).map(([key, label, color]) => {
            const count = users.planBreakdown[key] ?? 0
            const pct = users.total > 0 ? Math.round((count / users.total) * 100) : 0
            return (
              <div key={key} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-3xs)', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--sand)' }}>{label}</span>
                  <span style={{ color: 'var(--mist)' }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(245,237,216,.06)' }}>
                  <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Branch distribution */}
        <div style={{ background: 'var(--ink2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '18px 20px' }}>
          <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px' }}>
            Sessions by Resonance Branch (30d)
          </div>
          {(['A', 'B', 'C', 'D'] as const).map((b, i) => {
            const count = sessions.branchBreakdown[b] ?? 0
            const pct = totalBranch > 0 ? Math.round((count / totalBranch) * 100) : 0
            const colors = ['#6B8CAE', '#3DAF96', '#C9A84C', '#C4784A']
            return (
              <div key={b} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-3xs)', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--sand)' }}>{b} — {BRANCH_LABELS[b]}</span>
                  <span style={{ color: 'var(--mist)' }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(245,237,216,.06)' }}>
                  <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: colors[i] }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        {[
          { href: `/admin/analytics?env=${env}`, label: 'Analytics', desc: 'Funnel, retention & trends' },
          { href: `/admin/mirror?env=${env}`, label: 'Mirror Quality', desc: 'Resonance accuracy by branch' },
          { href: `/admin/sessions?env=${env}`, label: 'All Sessions', desc: 'Browse & filter sessions' },
          { href: `/admin/safety?env=${env}`, label: 'Safety Monitor', desc: 'Review flagged sessions' },
          { href: `/admin/users?env=${env}`, label: 'User Management', desc: 'Plan tiers & search' },
          { href: `/admin/events?env=${env}`, label: 'Event Log', desc: 'Raw analytics events' },
        ].map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'rgba(245,237,216,.02)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-lg)', padding: '14px 16px',
              transition: 'border-color .12s', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--sand)', fontWeight: 500, marginBottom: '4px' }}>
                {link.label} →
              </div>
              <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', lineHeight: 1.5 }}>
                {link.desc}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function LoadingShell() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--mist)' }}>Loading…</div>
    </div>
  )
}

function ErrorShell({ message }: { message: string }) {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ padding: '14px 16px', background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)', borderRadius: 'var(--r-lg)', color: '#D44040', fontSize: 'var(--fs-sm)' }}>
        Error: {message}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <DashboardInner />
    </Suspense>
  )
}
