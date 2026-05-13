'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type AdminEnv = 'dev' | 'qa' | 'prod'

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
  const env = (searchParams.get('env') ?? 'dev') as AdminEnv
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

  const { users, sessions, mirror, safety } = stats
  const totalBranch = Object.values(sessions.branchBreakdown).reduce((a, b) => a + b, 0)

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
