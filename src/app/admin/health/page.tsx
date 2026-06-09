'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'
import { AdminEnvNotConfigured } from '@/components/ui/AdminEnvNotConfigured'
type StatusType = 'ok' | 'degraded' | 'down'

interface HealthData {
  overallStatus: StatusType
  checkedAt: string
  db: {
    status: StatusType
    pingMs: number | null
  }
  mirror: {
    status: StatusType
    lastEventAt: string | null
    allTime: { avg: number | null; p50: number | null; p95: number | null; p99: number | null; count: number }
    last24h: { avg: number | null; p50: number | null; p95: number | null; p99: number | null; count: number }
  }
  sessions: {
    last24h: number
    last7d: number
    completedLast24h: number
    completionRate24h: number | null
    hourlySessions: Array<{ hour: number; count: number }>
  }
  safety: {
    flagsLast24h: number
    flagRateLast24h: number
    totalFlagsAllTime: number
  }
  errors: {
    last24hCount: number
    recent: Array<{ timestamp: string; detail: unknown }>
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

const STATUS_COLORS: Record<StatusType, string> = {
  ok:       '#3DAF96',
  degraded: '#C9A84C',
  down:     '#D44040',
}
const STATUS_BG: Record<StatusType, string> = {
  ok:       'rgba(61,175,150,.08)',
  degraded: 'rgba(201,168,76,.08)',
  down:     'rgba(212,64,64,.08)',
}
const STATUS_LABEL: Record<StatusType, string> = {
  ok: 'Operational', degraded: 'Degraded', down: 'Down',
}

function StatusBadge({ status, large }: { status: StatusType; large?: boolean }) {
  const color = STATUS_COLORS[status]
  const bg    = STATUS_BG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: large ? '5px 12px' : '3px 9px',
      borderRadius: '999px', background: bg,
      border: `1px solid ${color}40`,
      fontSize: large ? '13px' : '11px', fontWeight: 600,
      color,
    }}>
      <span style={{
        width: large ? '9px' : '7px', height: large ? '9px' : '7px',
        borderRadius: '50%', background: color,
        boxShadow: status !== 'down' ? `0 0 6px ${color}` : undefined,
        animation: status === 'ok' ? undefined : 'pulse 1.5s ease-in-out infinite',
      }} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function MetricRow({ label, value, unit, color, note }: {
  label: string; value: string | number | null; unit?: string
  color?: string; note?: string
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 0', borderBottom: '1px solid rgba(245,237,216,.04)',
    }}>
      <span style={{ fontSize: '12px', color: 'var(--mist)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{
          fontSize: '18px', fontFamily: 'var(--font-serif)', fontWeight: 300,
          color: color ?? 'var(--sand2)',
        }}>
          {value === null ? '—' : value}{unit && value !== null ? <span style={{ fontSize: '11px', color: 'var(--mist)', marginLeft: '3px' }}>{unit}</span> : null}
        </span>
        {note && <div style={{ ...metaText, marginTop: '1px' }}>{note}</div>}
      </div>
    </div>
  )
}

function HourBar({ data }: { data: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px' }}>
      {data.map(d => {
        const pct = d.count / max
        const nowHour = new Date().getUTCHours()
        const isNow = d.hour === nowHour
        return (
          <div
            key={d.hour}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
            title={`${d.hour}:00 UTC — ${d.count} sessions`}
          >
            <div style={{
              width: '100%',
              height: `${Math.max(pct * 100, 2)}%`,
              borderRadius: '2px 2px 0 0',
              background: isNow ? '#C9A84C' : '#6B8CAE',
              opacity: isNow ? 0.9 : 0.4 + pct * 0.5,
              transition: 'height .4s ease',
            }} />
          </div>
        )
      })}
    </div>
  )
}

function msToS(ms: number | null) {
  if (ms === null) return null
  return `${(ms / 1000).toFixed(2)}`
}

// ── Main ───────────────────────────────────────────────────────────────────────
function HealthInner() {
  const searchParams = useSearchParams()
  const env = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv

  const [data, setData]     = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  function load() {
    setLoading(true)
    setError('')
    setNotConfigured(false)
    fetch(`/api/admin/health?env=${env}`)
      .then(r => r.json())
      .then(d => {
        if (d.not_configured) { setNotConfigured(true); return }
        if (d.error) throw new Error(d.error)
        setNotConfigured(false)
        setData(d)
        setLastRefresh(new Date())
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [env]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [env]) // eslint-disable-line react-hooks/exhaustive-deps

  const m = data?.mirror
  const p95Color = (ms: number | null) => ms === null ? 'var(--mist)' : ms > 15000 ? '#D44040' : ms > 8000 ? '#C9A84C' : '#3DAF96'

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
            System Health · {env.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
            Health Monitor
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {data && <StatusBadge status={data.overallStatus} large />}
          <button onClick={load} style={{
            padding: '7px 14px', fontSize: '12px', fontFamily: 'var(--font-sans)',
            background: 'var(--ink2)', border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-md)', color: 'var(--mist)', cursor: 'pointer',
          }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {lastRefresh && (
        <div style={{ ...metaText, marginBottom: '20px' }}>
          Last checked: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 60s
        </div>
      )}

      {notConfigured && <AdminEnvNotConfigured env={env} />}
      {!notConfigured && error && (
        <div style={{ padding: '14px 16px', background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)', borderRadius: 'var(--r-lg)', color: '#D44040', fontSize: 'var(--fs-sm)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }} />
          Running health checks…
        </div>
      )}

      {data && (
        <>
          {/* ── Section 1: Service status overview ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              {
                name: 'Database',
                status: data.db.status,
                detail: data.db.pingMs !== null ? `${data.db.pingMs}ms ping` : 'No response',
              },
              {
                name: 'Mirror AI',
                status: data.mirror.status,
                detail: m?.last24h.count ? `${m.last24h.count} renders in 24h` : 'No renders in 24h',
              },
              {
                name: 'Safety Classifier',
                status: data.safety.flagsLast24h < 50 ? 'ok' as StatusType : 'degraded' as StatusType,
                detail: `${data.safety.flagsLast24h} flags in 24h (${data.safety.flagRateLast24h}% rate)`,
              },
              {
                name: 'Error Rate',
                status: data.errors.last24hCount === 0 ? 'ok' as StatusType : data.errors.last24hCount < 10 ? 'degraded' as StatusType : 'down' as StatusType,
                detail: `${data.errors.last24hCount} errors in 24h`,
              },
            ].map(({ name, status, detail }) => (
              <div key={name} style={{
                ...card,
                borderColor: `${STATUS_COLORS[status]}30`,
                background: STATUS_BG[status],
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '13px', color: 'var(--sand)', fontWeight: 500 }}>{name}</div>
                  <StatusBadge status={status} />
                </div>
                <div style={{ ...metaText, marginTop: '8px' }}>{detail}</div>
              </div>
            ))}
          </div>

          {/* ── Section 2: Mirror performance ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={card}>
              <div style={sectionLabel}>Mirror API — Last 24h</div>
              <MetricRow label="Avg response time" value={msToS(m?.last24h.avg ?? null)} unit="s"
                color={m?.last24h.avg !== null && m!.last24h.avg! > 5000 ? '#D44040' : '#3DAF96'} />
              <MetricRow label="p50 (median)" value={msToS(m?.last24h.p50 ?? null)} unit="s" />
              <MetricRow label="p95" value={msToS(m?.last24h.p95 ?? null)} unit="s"
                color={p95Color(m?.last24h.p95 ?? null)} note="Target: < 8s" />
              <MetricRow label="p99" value={msToS(m?.last24h.p99 ?? null)} unit="s" />
              <MetricRow label="Sample size" value={m?.last24h.count ?? 0} />
            </div>

            <div style={card}>
              <div style={sectionLabel}>Mirror API — All Time</div>
              <MetricRow label="Avg response time" value={msToS(m?.allTime.avg ?? null)} unit="s" />
              <MetricRow label="p50 (median)" value={msToS(m?.allTime.p50 ?? null)} unit="s" />
              <MetricRow label="p95" value={msToS(m?.allTime.p95 ?? null)} unit="s"
                color={p95Color(m?.allTime.p95 ?? null)} note="Target: < 8s" />
              <MetricRow label="p99" value={msToS(m?.allTime.p99 ?? null)} unit="s" />
              <MetricRow label="Total renders" value={m?.allTime.count?.toLocaleString() ?? 0} />
              <div style={{ ...metaText, marginTop: '10px', borderTop: '1px solid var(--hairline)', paddingTop: '8px' }}>
                Last mirror render: {m?.lastEventAt ? new Date(m.lastEventAt).toLocaleString() : 'No data'}
              </div>
            </div>
          </div>

          {/* ── Section 3: Session volume + hourly distribution ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={card}>
              <div style={sectionLabel}>Session Volume</div>
              <MetricRow label="Sessions (last 24h)" value={data.sessions.last24h} />
              <MetricRow label="Sessions (last 7d)" value={data.sessions.last7d} />
              <MetricRow label="Completed (last 24h)" value={data.sessions.completedLast24h} />
              <MetricRow
                label="Completion rate (24h)"
                value={data.sessions.completionRate24h !== null ? `${data.sessions.completionRate24h}%` : null}
                color={
                  data.sessions.completionRate24h === null ? 'var(--mist)' :
                  data.sessions.completionRate24h >= 50 ? '#3DAF96' :
                  data.sessions.completionRate24h >= 30 ? '#C9A84C' : '#D44040'
                }
              />
            </div>

            <div style={card}>
              <div style={sectionLabel}>Sessions by Hour — Last 24h (UTC)</div>
              <HourBar data={data.sessions.hourlySessions} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                {[0, 6, 12, 18, 23].map(h => (
                  <span key={h} style={{ fontSize: '9px', color: 'rgba(213,226,235,.65)' }}>{h}:00</span>
                ))}
              </div>
              <div style={{ ...metaText, marginTop: '8px' }}>
                Gold = current hour · Peak: {
                  (() => {
                    const peak = data.sessions.hourlySessions.reduce((a, b) => a.count > b.count ? a : b)
                    return `${peak.hour}:00 UTC (${peak.count} sessions)`
                  })()
                }
              </div>
            </div>
          </div>

          {/* ── Section 4: Safety + errors ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={card}>
              <div style={sectionLabel}>Safety Classifier</div>
              <MetricRow label="Crisis flags (24h)" value={data.safety.flagsLast24h}
                color={data.safety.flagsLast24h > 0 ? '#C9A84C' : '#3DAF96'} />
              <MetricRow label="Flag rate (24h)" value={`${data.safety.flagRateLast24h}%`} note="Flagged / total sessions" />
              <MetricRow label="Total flags (all time)" value={data.safety.totalFlagsAllTime.toLocaleString()} />
              <div style={{ ...metaText, marginTop: '10px', borderTop: '1px solid var(--hairline)', paddingTop: '8px' }}>
                Safety classifier runs before every Mirror call. Crisis gate suppresses Season card when triggered.
              </div>
            </div>

            <div style={card}>
              <div style={sectionLabel}>Application Errors (24h)</div>
              {data.errors.last24hCount === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3DAF96', fontSize: '13px' }}>
                  <span style={{ fontSize: '18px' }}>✓</span>
                  No errors in the last 24 hours
                </div>
              ) : (
                <>
                  <div style={{
                    fontSize: '32px', fontFamily: 'var(--font-serif)', fontWeight: 300,
                    color: '#D44040', lineHeight: 1, marginBottom: '12px',
                  }}>
                    {data.errors.last24hCount}
                  </div>
                  {data.errors.recent.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {data.errors.recent.slice(0, 5).map((e, i) => (
                        <div key={i} style={{
                          padding: '6px 10px', background: 'rgba(212,64,64,.06)',
                          borderRadius: 'var(--r-md)', borderLeft: '2px solid rgba(212,64,64,.3)',
                        }}>
                          <div style={{ fontSize: '10px', color: 'var(--mist)' }}>
                            {new Date(e.timestamp).toLocaleTimeString()}
                          </div>
                          <div style={{ fontSize: '11px', color: '#D44040', marginTop: '2px' }}>
                            {String(e.detail).slice(0, 80)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Section 5: DB health ── */}
          <div style={card}>
            <div style={sectionLabel}>Database Health</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <MetricRow
                  label="Connection status"
                  value={STATUS_LABEL[data.db.status]}
                  color={STATUS_COLORS[data.db.status]}
                />
                <MetricRow
                  label="Ping latency"
                  value={data.db.pingMs}
                  unit="ms"
                  color={
                    data.db.pingMs === null ? 'var(--mist)' :
                    data.db.pingMs > 2000 ? '#D44040' :
                    data.db.pingMs > 500  ? '#C9A84C' : '#3DAF96'
                  }
                  note="Time to execute a simple SELECT"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ ...metaText }}>
                  Supabase PostgreSQL with Row Level Security enabled across all tables.
                  Service-role key used by admin API routes only.
                  User data is AES-256-GCM encrypted at the application layer before storage.
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...metaText, textAlign: 'right', marginTop: '12px' }}>
            Checked at {new Date(data.checkedAt).toLocaleString()} · {env.toUpperCase()} environment
          </div>
        </>
      )}
    </div>
  )
}

function LoadingShell() {
  return <div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
}

export default function HealthPage() {
  return <Suspense fallback={<LoadingShell />}><HealthInner /></Suspense>
}
