'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'
import { AdminEnvNotConfigured } from '@/components/ui/AdminEnvNotConfigured'

interface Event {
  id: string
  session_id: string | null
  user_hash: string | null
  event_name: string
  properties: Record<string, unknown> | null
  timestamp: string
}

interface EventsResponse {
  events: Event[]
  total: number
  page: number
  pages: number
  breakdown: Record<string, number>
}

const EVENT_COLORS: Record<string, string> = {
  session_start:       '#6B8CAE',
  branch_selected:     '#C9A84C',
  emotions_submitted:  '#3DAF96',
  intensity_submitted: '#C9A84C',
  context_submitted:   '#3DAF96',
  mirror_rendered:     '#C9A84C',
  resonance_tapped:    '#3DAF96',
  season_shown:        '#C4784A',
  nextstep_selected:   '#6B8CAE',
  session_complete:    '#3DAF96',
  safety_event:        '#D44040',
  session_drop:        'rgba(139,167,184,.6)',
}

const ALL_EVENT_NAMES = [
  'session_start', 'branch_selected', 'emotions_submitted', 'intensity_submitted',
  'context_submitted', 'mirror_rendered', 'resonance_tapped', 'season_shown',
  'nextstep_selected', 'session_complete', 'safety_event', 'session_drop',
]

function EventsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const env = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const eventName = searchParams.get('event') ?? ''
  const sessionId = searchParams.get('session') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''

  const [data, setData] = useState<EventsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [sessionSearch, setSessionSearch] = useState(sessionId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (val) p.set(key, val); else p.delete(key)
    p.set('page', '1')
    router.push(`${pathname}?${p.toString()}`)
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    setNotConfigured(false)
    const q = new URLSearchParams({ env, page: String(page) })
    if (eventName) q.set('event', eventName)
    if (sessionId) q.set('session', sessionId)
    if (from) q.set('from', from)
    if (to) q.set('to', to)

    fetch(`/api/admin/events?${q}`)
      .then(r => r.json())
      .then(d => { if (d.not_configured) { setNotConfigured(true); return }; if (d.error) throw new Error(d.error); setNotConfigured(false); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [env, page, eventName, sessionId, from, to])

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Events · {env.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
          Event Log
        </h1>
      </div>

      {/* Event breakdown chips */}
      {data && !loading && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <button
            onClick={() => setParam('event', '')}
            style={chipStyle(eventName === '', 'var(--mist)')}
          >
            All ({data.total.toLocaleString()})
          </button>
          {Object.entries(data.breakdown).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
            <button
              key={name}
              onClick={() => setParam('event', name)}
              style={chipStyle(eventName === name, EVENT_COLORS[name] ?? 'var(--mist)')}
            >
              {name.replace(/_/g, ' ')} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Event name dropdown */}
        <select
          value={eventName}
          onChange={e => setParam('event', e.target.value)}
          style={selectStyle}
        >
          <option value="">All Events</option>
          {ALL_EVENT_NAMES.map(n => (
            <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Session ID search */}
        <form onSubmit={e => { e.preventDefault(); setParam('session', sessionSearch) }} style={{ display: 'flex', gap: '6px' }}>
          <input
            value={sessionSearch}
            onChange={e => setSessionSearch(e.target.value)}
            placeholder="Session ID…"
            style={{ ...selectStyle, width: '200px' }}
          />
          {sessionSearch && (
            <button type="submit" style={{ ...selectStyle, cursor: 'pointer' }}>Filter</button>
          )}
          {sessionId && (
            <button type="button" onClick={() => { setSessionSearch(''); setParam('session', '') }} style={{ ...selectStyle, cursor: 'pointer', color: 'var(--gold)' }}>
              Clear ✕
            </button>
          )}
        </form>

        {/* Date range */}
        <input type="date" value={from} onChange={e => setParam('from', e.target.value)} style={selectStyle} />
        <input type="date" value={to} onChange={e => setParam('to', e.target.value)} style={selectStyle} />

        <div style={{ flex: 1 }} />
        {data && (
          <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)' }}>
            {data.total.toLocaleString()} events
          </span>
        )}
      </div>

      {loading && <p style={{ color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</p>}
      {notConfigured && <AdminEnvNotConfigured env={env} />}
      {!notConfigured && error && <p style={{ color: '#D44040', fontSize: 'var(--fs-sm)' }}>Error: {error}</p>}

      {data && !loading && data.events.length === 0 && (
        <div style={{
          padding: '32px', textAlign: 'center', background: 'var(--ink2)',
          border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)',
          color: 'var(--mist)', fontSize: 'var(--fs-sm)',
        }}>
          No events for this filter.
        </div>
      )}

      {data && !loading && data.events.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {data.events.map(ev => {
              const color = EVENT_COLORS[ev.event_name] ?? 'var(--mist)'
              const expanded = expandedId === ev.id
              const hasProps = ev.properties && Object.keys(ev.properties).length > 0
              return (
                <div
                  key={ev.id}
                  style={{
                    background: 'var(--ink2)', border: '1px solid var(--hairline)',
                    borderRadius: 'var(--r-lg)', padding: '10px 14px',
                    cursor: hasProps ? 'pointer' : 'default',
                    transition: 'border-color .1s',
                  }}
                  onClick={() => hasProps && setExpandedId(expanded ? null : ev.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Event name badge */}
                    <span style={{
                      fontSize: '16px', padding: '2px 8px', borderRadius: '4px',
                      color, background: `${color}18`, fontWeight: 600,
                      letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>
                      {ev.event_name.replace(/_/g, ' ')}
                    </span>

                    {/* Timestamp */}
                    <span style={{ fontSize: '16px', color: 'var(--mist)', fontFamily: 'monospace' }}>
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>

                    {/* Session */}
                    {ev.session_id && (
                      <span style={{ fontSize: '16px', color: 'var(--mist)', fontFamily: 'monospace' }}>
                        session:{ev.session_id.slice(0, 8)}
                      </span>
                    )}

                    {/* User hash */}
                    {ev.user_hash && (
                      <span style={{ fontSize: '16px', color: 'var(--mist)' }}>
                        user:{ev.user_hash}
                      </span>
                    )}

                    {hasProps && (
                      <span style={{ marginLeft: 'auto', fontSize: '16px', color: 'var(--mist)' }}>
                        {expanded ? '▲' : '▼'} props
                      </span>
                    )}
                  </div>

                  {/* Expanded properties */}
                  {expanded && hasProps && (
                    <pre style={{
                      marginTop: '10px', padding: '10px 12px',
                      background: 'rgba(245,237,216,.03)', borderRadius: 'var(--r-md)',
                      fontSize: '16px', color: 'var(--sand)', fontFamily: 'monospace',
                      overflow: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    }}>
                      {JSON.stringify(ev.properties, null, 2)}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
              <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} style={pageBtn(page <= 1)}>← Prev</button>
              <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)' }}>{page} / {data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => setParam('page', String(page + 1))} style={pageBtn(page >= data.pages)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const chipStyle = (active: boolean, color: string): React.CSSProperties => ({
  padding: '4px 10px', fontSize: '16px', fontFamily: 'var(--font-sans)',
  background: active ? `${color}18` : 'var(--ink2)',
  border: `1px solid ${active ? `${color}50` : 'var(--hairline)'}`,
  borderRadius: 'var(--r-pill)', color: active ? color : 'var(--mist)',
  cursor: 'pointer', whiteSpace: 'nowrap',
})

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 'var(--fs-3xs)', fontFamily: 'var(--font-sans)',
  background: 'var(--ink2)', border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)', color: 'var(--sand)', outline: 'none',
}

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '7px 14px', fontSize: 'var(--fs-3xs)', fontFamily: 'var(--font-sans)',
  background: 'var(--ink2)', border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)', color: disabled ? 'var(--mist)' : 'var(--sand)',
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
})

function LoadingShell() {
  return <div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
}

export default function EventsPage() {
  return <Suspense fallback={<LoadingShell />}><EventsInner /></Suspense>
}
