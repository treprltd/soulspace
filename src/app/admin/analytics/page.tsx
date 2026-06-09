'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'
import { AdminEnvNotConfigured } from '@/components/ui/AdminEnvNotConfigured'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  windowDays: number
  totals: {
    sessions: number
    completedSessions: number
    completionRate: number | null
    newUsers: number
    resonanceRate: number | null
    avgResponseMs: number | null
    p95ResponseMs: number | null
    returningRate: number | null
    avgSessionsPerUser: number | null
    conversionRate: number | null
    newConversions: number
  }
  planBreakdown: { free: number; essentials: number; insights: number }
  funnel: Array<{ step: string; count: number }>
  dailySessions: Array<{ date: string; total: number; completed: number }>
  dailyUsers: Array<{ date: string; count: number }>
  hourlyDistribution: Array<{ hour: number; count: number }>
  dowDistribution: Array<{ day: string; count: number }>
  branchDistribution: Array<{
    branch: string; total: number
    resonanceRate: number | null; avgIntensity: number | null; avgChars: number | null
  }>
  seasonDistribution: Array<{ season: string; total: number; resonanceRate: number | null }>
  intensityHistogram: Array<{ intensity: number; count: number }>
}

// ── Shared styles ─────────────────────────────────────────────────────────────
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
const sel: React.CSSProperties = {
  padding: '7px 12px', fontSize: 'var(--fs-3xs)', fontFamily: 'var(--font-sans)',
  background: 'var(--ink2)', border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)', color: 'var(--sand)', outline: 'none', cursor: 'pointer',
}

// ── Colour constants ──────────────────────────────────────────────────────────
const BRANCH_COLORS = ['#6B8CAE', '#3DAF96', '#C9A84C', '#C4784A']
const SEASON_COLORS: Record<string, string> = {
  W: '#9BB8D4', Sp: '#7DC98A', Su: '#E8C97A', Au: '#C4784A',
}
const SEASON_LABELS: Record<string, string> = {
  W: 'Winter', Sp: 'Spring', Su: 'Summer', Au: 'Autumn',
}
const BRANCH_LABELS: Record<string, string> = {
  A: 'Decision Pressure', B: 'Something Unnamed',
  C: 'Pattern Repeating', D: 'Carrying Alone',
}
const FUNNEL_LABELS: Record<string, string> = {
  session_start: 'Session Start',
  branch_selected: 'Branch Selected',
  emotions_submitted: 'Emotions',
  intensity_submitted: 'Intensity',
  context_submitted: 'Context',
  mirror_rendered: 'Mirror Shown',
  resonance_tapped: 'Resonance Tap',
  session_complete: 'Completed',
}

// ── Mini chart helpers ────────────────────────────────────────────────────────
function Sparkline({
  data, color = '#C9A84C', height = 48, secondaryData, secondaryColor,
}: {
  data: number[]; color?: string; height?: number
  secondaryData?: number[]; secondaryColor?: string
}) {
  if (data.length < 2) return <div style={{ height }} />
  const max = Math.max(...data, ...(secondaryData ?? []), 1)
  const w = 100
  const h = height
  const pts = (vals: number[]) =>
    vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h * 0.9}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      {secondaryData && (
        <polyline
          points={pts(secondaryData)}
          fill="none"
          stroke={secondaryColor ?? 'rgba(139,167,184,.3)'}
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}
      <polyline
        points={pts(data)}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Area fill */}
      <polygon
        points={`0,${h} ${pts(data)} ${w},${h}`}
        fill={color}
        opacity="0.07"
      />
    </svg>
  )
}

function HBar({
  value, max, color, label, sub,
}: { value: number; max: number; color: string; label: string; sub?: string }) {
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

function StatBox({
  label, value, sub, color, target, targetLabel,
}: {
  label: string; value: string | number; sub?: string
  color?: string; target?: number; targetLabel?: string
}) {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  const met = target !== undefined && !isNaN(num) ? num >= target : undefined
  return (
    <div style={{ ...card }}>
      <div style={sectionLabel}>{label}</div>
      <div style={{
        fontSize: '32px', fontFamily: 'var(--font-serif)', fontWeight: 300,
        color: met === false ? '#D44040' : met === true ? '#3DAF96' : (color ?? 'var(--sand2)'),
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && <div style={{ ...metaText, marginTop: '6px' }}>{sub}</div>}
      {target !== undefined && met !== undefined && (
        <div style={{ fontSize: '10px', marginTop: '4px', color: met ? '#3DAF96' : '#D44040' }}>
          {met ? `✓ Above ${targetLabel ?? target}% target` : `✕ Below ${targetLabel ?? target}% target`}
        </div>
      )}
    </div>
  )
}

// ── Funnel chart ──────────────────────────────────────────────────────────────
function FunnelChart({ steps }: { steps: Array<{ step: string; count: number }> }) {
  const top = steps[0]?.count || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {steps.map((s, i) => {
        const pct = Math.round((s.count / top) * 100)
        const dropPct = i > 0 && steps[i - 1].count > 0
          ? Math.round(((steps[i - 1].count - s.count) / steps[i - 1].count) * 100)
          : 0
        const color = pct >= 80 ? '#3DAF96' : pct >= 60 ? '#C9A84C' : pct >= 40 ? '#C4784A' : '#D44040'
        return (
          <div key={s.step}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
              <span style={{ fontSize: '11px', color: 'var(--sand)', minWidth: '140px' }}>
                {FUNNEL_LABELS[s.step] ?? s.step}
              </span>
              <div style={{ flex: 1, height: '20px', background: 'rgba(245,237,216,.04)', borderRadius: '3px', position: 'relative' }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${pct}%`, background: color,
                  opacity: 0.7, transition: 'width .5s ease',
                }} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--sand2)', minWidth: '36px', textAlign: 'right' }}>
                {s.count.toLocaleString()}
              </span>
              <span style={{ fontSize: '10px', color, minWidth: '36px', textAlign: 'right' }}>
                {pct}%
              </span>
              {i > 0 && dropPct > 0 && (
                <span style={{ fontSize: '10px', color: 'rgba(212,64,64,.6)', minWidth: '50px' }}>
                  −{dropPct}% drop
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Hour heatmap ──────────────────────────────────────────────────────────────
function HourHeatmap({ data }: { data: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const periods = [
    { label: 'Night', hours: [0, 1, 2, 3, 4, 5], color: '#6B8CAE' },
    { label: 'Morning', hours: [6, 7, 8, 9, 10, 11], color: '#C9A84C' },
    { label: 'Afternoon', hours: [12, 13, 14, 15, 16, 17], color: '#3DAF96' },
    { label: 'Evening', hours: [18, 19, 20, 21, 22, 23], color: '#C4784A' },
  ]
  return (
    <div>
      {periods.map(p => (
        <div key={p.label} style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', color: p.color, marginBottom: '5px', letterSpacing: '0.08em' }}>
            {p.label}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {p.hours.map(h => {
              const item = data[h]
              const pct = item ? item.count / max : 0
              return (
                <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div
                    style={{
                      width: '100%', height: '28px', borderRadius: '3px',
                      background: p.color,
                      opacity: 0.1 + pct * 0.85,
                      transition: 'opacity .3s',
                    }}
                    title={`${h}:00 — ${item?.count ?? 0} sessions`}
                  />
                  <span style={{ fontSize: '9px', color: 'rgba(213,226,235,.72)' }}>{h}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Intensity histogram ───────────────────────────────────────────────────────
function IntensityHistogram({ data }: { data: Array<{ intensity: number; count: number }> }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const total = data.reduce((a, b) => a + b.count, 0)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px', marginBottom: '6px' }}>
        {data.map(d => {
          const pct = d.count / max
          const hue = d.intensity <= 3 ? '#6B8CAE' : d.intensity <= 6 ? '#C9A84C' : '#D44040'
          return (
            <div
              key={d.intensity}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
              title={`Intensity ${d.intensity}: ${d.count} sessions`}
            >
              <div style={{
                width: '100%', borderRadius: '3px 3px 0 0',
                height: `${Math.max(pct * 100, 2)}%`,
                background: hue, opacity: 0.75,
                transition: 'height .4s ease',
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {data.map(d => (
          <div key={d.intensity} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: 'rgba(213,226,235,.72)' }}>{d.intensity}</div>
            {total > 0 && (
              <div style={{ fontSize: '8px', color: 'rgba(213,226,235,.60)' }}>
                {Math.round((d.count / total) * 100)}%
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
        {[['Low (1–3)', '#6B8CAE'], ['Mid (4–6)', '#C9A84C'], ['High (7–10)', '#D44040']].map(([l, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: c as string, opacity: 0.75 }} />
            <span style={{ fontSize: '10px', color: 'var(--mist)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main analytics inner component ───────────────────────────────────────────
function AnalyticsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const env = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const days = parseInt(searchParams.get('days') ?? '30', 10)

  const [data, setData] = useState<AnalyticsData | null>(null)
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
    fetch(`/api/admin/analytics?env=${env}&days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.not_configured) { setNotConfigured(true); return }; if (d.error) throw new Error(d.error); setNotConfigured(false); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [env, days])

  const t = data?.totals

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
            Analytics · {env.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
            User Behaviour
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setParam('days', String(d))}
              style={{
                ...sel,
                background: days === d ? 'rgba(201,168,76,.12)' : 'var(--ink2)',
                color: days === d ? 'var(--gold2)' : 'var(--mist)',
                border: days === d ? '1px solid rgba(201,168,76,.3)' : '1px solid var(--hairline)',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {notConfigured && <AdminEnvNotConfigured env={env} />}

      {!notConfigured && error && (
        <div style={{ padding: '14px 16px', background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)', borderRadius: 'var(--r-lg)', color: '#D44040', fontSize: 'var(--fs-sm)', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      {!notConfigured && loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }} />
          Loading analytics…
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── Section 1: Key metrics ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <StatBox label="Sessions" value={t!.sessions.toLocaleString()} sub={`${t!.newUsers} new users · ${days}d window`} />
            <StatBox label="Completion Rate" value={t!.completionRate !== null ? `${t!.completionRate}%` : '—'} sub={`${t!.completedSessions} completed`} />
            <StatBox
              label="Resonance Rate" value={t!.resonanceRate !== null ? `${t!.resonanceRate}%` : '—'}
              color="#3DAF96" target={60} targetLabel="60"
            />
            <StatBox
              label="Conversion Rate" value={t!.conversionRate !== null ? `${t!.conversionRate}%` : '—'}
              sub={`${data.planBreakdown.essentials + data.planBreakdown.insights} paid users · ${t!.newConversions} new`}
            />
            <StatBox
              label="Returning Users"
              value={t!.returningRate !== null ? `${t!.returningRate}%` : '—'}
              sub={t!.avgSessionsPerUser !== null ? `Avg ${t!.avgSessionsPerUser} sessions/user` : undefined}
            />
            <StatBox
              label="Mirror p95"
              value={t!.p95ResponseMs !== null ? `${(t!.p95ResponseMs / 1000).toFixed(1)}s` : '—'}
              sub={t!.avgResponseMs !== null ? `Avg ${(t!.avgResponseMs / 1000).toFixed(1)}s` : 'No data'}
              color={t!.p95ResponseMs !== null && t!.p95ResponseMs > 8000 ? '#D44040' : '#3DAF96'}
            />
          </div>

          {/* ── Section 2: Session funnel ── */}
          <div style={{ ...card, marginBottom: '20px' }}>
            <div style={sectionLabel}>Session Funnel · Drop-off by Step</div>
            {data.funnel[0]?.count === 0 ? (
              <div style={metaText}>No event data in this window.</div>
            ) : (
              <FunnelChart steps={data.funnel} />
            )}
          </div>

          {/* ── Section 3: Daily trends ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '20px' }}>

            {/* Sessions per day */}
            <div style={card}>
              <div style={sectionLabel}>Daily Sessions</div>
              {data.dailySessions.length < 2 ? (
                <div style={metaText}>Not enough data.</div>
              ) : (
                <>
                  <Sparkline
                    data={data.dailySessions.map(d => d.total)}
                    secondaryData={data.dailySessions.map(d => d.completed)}
                    color="#C9A84C"
                    secondaryColor="rgba(61,175,150,.6)"
                    height={60}
                  />
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '20px', height: '2px', background: '#C9A84C', borderRadius: '1px' }} />
                      <span style={metaText}>All sessions</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '20px', height: '2px', borderRadius: '1px', borderTop: '1px dashed rgba(61,175,150,.6)' }} />
                      <span style={metaText}>Completed</span>
                    </div>
                  </div>
                  <div style={{ ...metaText, marginTop: '6px' }}>
                    {data.dailySessions.slice(-1)[0]?.date} — {data.dailySessions.slice(-1)[0]?.total ?? 0} sessions today
                  </div>
                </>
              )}
            </div>

            {/* New users per day */}
            <div style={card}>
              <div style={sectionLabel}>Daily New Users</div>
              {data.dailyUsers.length < 2 ? (
                <div style={metaText}>Not enough data.</div>
              ) : (
                <>
                  <Sparkline data={data.dailyUsers.map(d => d.count)} color="#3DAF96" height={60} />
                  <div style={{ ...metaText, marginTop: '8px' }}>
                    {t!.newUsers} new signups in {days}d window
                    {data.dailyUsers.length > 0 && ` · Avg ${Math.round(t!.newUsers / data.dailyUsers.length)}/day`}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Section 4: Time-of-day heatmap + Day-of-week ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>

            <div style={card}>
              <div style={sectionLabel}>Sessions by Hour (UTC)</div>
              <HourHeatmap data={data.hourlyDistribution} />
              <div style={{ ...metaText, marginTop: '10px' }}>
                Peak hour: {data.hourlyDistribution.reduce((a, b) => a.count > b.count ? a : b).hour}:00 UTC
                ({data.hourlyDistribution.reduce((a, b) => a.count > b.count ? a : b).count} sessions)
              </div>
            </div>

            <div style={card}>
              <div style={sectionLabel}>Sessions by Day of Week</div>
              {(() => {
                const max = Math.max(...data.dowDistribution.map(d => d.count), 1)
                return data.dowDistribution.map(d => (
                  <HBar key={d.day} value={d.count} max={max} color="#6B8CAE" label={d.day} />
                ))
              })()}
              <div style={{ ...metaText, marginTop: '4px' }}>
                Busiest: {data.dowDistribution.reduce((a, b) => a.count > b.count ? a : b).day}
              </div>
            </div>
          </div>

          {/* ── Section 5: Branch breakdown ── */}
          <div style={{ ...card, marginBottom: '20px' }}>
            <div style={sectionLabel}>Resonance Branch Performance</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {data.branchDistribution.map((b, i) => {
                const color = BRANCH_COLORS[i]
                const rate = b.resonanceRate
                return (
                  <div
                    key={b.branch}
                    style={{
                      background: 'rgba(245,237,216,.02)', border: `1px solid ${color}25`,
                      borderRadius: 'var(--r-md)', padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', color, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600 }}>
                        Branch {b.branch}
                      </div>
                      {rate !== null && (
                        <div style={{
                          fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                          background: rate >= 60 ? 'rgba(42,140,122,.12)' : 'rgba(212,64,64,.1)',
                          color: rate >= 60 ? '#3DAF96' : '#D44040',
                          border: `1px solid ${rate >= 60 ? 'rgba(42,140,122,.3)' : 'rgba(212,64,64,.25)'}`,
                        }}>
                          {rate}% resonance
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '26px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', marginBottom: '4px' }}>
                      {b.total.toLocaleString()}
                    </div>
                    <div style={metaText}>
                      {BRANCH_LABELS[b.branch]}<br />
                      {b.avgIntensity !== null && `Avg intensity: ${b.avgIntensity}`}
                      {b.avgChars !== null && ` · Avg chars: ${b.avgChars}`}
                    </div>
                    {b.total > 0 && (
                      <div style={{ marginTop: '10px', height: '4px', borderRadius: '2px', background: 'rgba(245,237,216,.05)' }}>
                        <div style={{
                          height: '100%', borderRadius: '2px', background: color,
                          width: `${Math.min((b.total / Math.max(...data.branchDistribution.map(x => x.total), 1)) * 100, 100)}%`,
                        }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Section 6: Season distribution ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={card}>
              <div style={sectionLabel}>Season Assignment Distribution</div>
              {(() => {
                const max = Math.max(...data.seasonDistribution.map(s => s.total), 1)
                return data.seasonDistribution.map(s => (
                  <HBar
                    key={s.season}
                    value={s.total}
                    max={max}
                    color={SEASON_COLORS[s.season] ?? 'var(--mist)'}
                    label={SEASON_LABELS[s.season] ?? s.season}
                    sub={`${s.total} sessions${s.resonanceRate !== null ? ` · ${s.resonanceRate}% resonance` : ''}`}
                  />
                ))
              })()}
            </div>

            {/* ── Section 7: Intensity histogram ── */}
            <div style={card}>
              <div style={sectionLabel}>Emotional Intensity Distribution (All Time)</div>
              <IntensityHistogram data={data.intensityHistogram} />
              <div style={{ ...metaText, marginTop: '10px' }}>
                {(() => {
                  const total = data.intensityHistogram.reduce((a, b) => a + b.count, 0)
                  const avgI = total > 0
                    ? data.intensityHistogram.reduce((a, b) => a + b.intensity * b.count, 0) / total
                    : null
                  return avgI !== null ? `Avg intensity: ${avgI.toFixed(1)} · ${total.toLocaleString()} sessions total` : 'No data'
                })()}
              </div>
            </div>
          </div>

          {/* ── Section 8: Plan conversion ── */}
          <div style={{ ...card, marginBottom: '20px' }}>
            <div style={sectionLabel}>Plan Distribution & Conversion</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>

              {/* Donut-style numbers */}
              <div>
                {[
                  { key: 'free', label: 'Free', color: 'var(--mist)' },
                  { key: 'essentials', label: 'Essentials', color: '#C9A84C' },
                  { key: 'insights', label: 'Insights', color: '#3DAF96' },
                ].map(({ key, label, color }) => {
                  const count = data.planBreakdown[key as keyof typeof data.planBreakdown]
                  const total = Object.values(data.planBreakdown).reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={key} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--sand)' }}>{label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{count} users ({pct}%)</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(245,237,216,.05)' }}>
                        <div style={{ height: '100%', borderRadius: '3px', width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Conversion KPIs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '12px 14px', background: 'rgba(245,237,216,.02)', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)' }}>
                  <div style={metaText}>Overall conversion</div>
                  <div style={{ fontSize: '28px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: '#C9A84C' }}>
                    {t!.conversionRate !== null ? `${t!.conversionRate}%` : '—'}
                  </div>
                </div>
                <div style={{ padding: '12px 14px', background: 'rgba(245,237,216,.02)', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)' }}>
                  <div style={metaText}>New paid in {days}d</div>
                  <div style={{ fontSize: '28px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: '#3DAF96' }}>
                    {t!.newConversions}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 9: Mirror performance ── */}
          <div style={{ ...card, marginBottom: '8px' }}>
            <div style={sectionLabel}>Mirror API Performance</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                {
                  label: 'Avg Response Time',
                  value: t!.avgResponseMs !== null ? `${(t!.avgResponseMs / 1000).toFixed(2)}s` : '—',
                  color: t!.avgResponseMs !== null && t!.avgResponseMs > 5000 ? '#D44040' : '#3DAF96',
                },
                {
                  label: 'p95 Response Time',
                  value: t!.p95ResponseMs !== null ? `${(t!.p95ResponseMs / 1000).toFixed(2)}s` : '—',
                  color: t!.p95ResponseMs !== null && t!.p95ResponseMs > 8000 ? '#D44040' : '#C9A84C',
                },
                {
                  label: 'Resonance Rate',
                  value: t!.resonanceRate !== null ? `${t!.resonanceRate}%` : '—',
                  color: t!.resonanceRate !== null
                    ? t!.resonanceRate >= 60 ? '#3DAF96' : t!.resonanceRate >= 50 ? '#C9A84C' : '#D44040'
                    : 'var(--mist)',
                },
                {
                  label: 'Mirror Renders',
                  value: (data.funnel.find(f => f.step === 'mirror_rendered')?.count ?? 0).toLocaleString(),
                  color: 'var(--sand2)',
                },
              ].map(item => (
                <div key={item.label} style={{ padding: '14px 16px', background: 'rgba(245,237,216,.02)', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)' }}>
                  <div style={metaText}>{item.label}</div>
                  <div style={{ fontSize: '26px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: item.color, marginTop: '4px' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...metaText, textAlign: 'right', marginTop: '12px' }}>
            Data window: last {days} days · {env.toUpperCase()} environment · All times UTC
          </div>
        </>
      )}
    </div>
  )
}

function LoadingShell() {
  return <div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
}

export default function AnalyticsPage() {
  return <Suspense fallback={<LoadingShell />}><AnalyticsInner /></Suspense>
}
