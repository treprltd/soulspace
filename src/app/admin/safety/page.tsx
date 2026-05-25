'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'
import { AdminEnvNotConfigured } from '@/components/ui/AdminEnvNotConfigured'

interface SafetyEvent {
  id: string
  session_id: string | null
  flag_type: string | null
  branch: string | null
  action: string
  season_suppressed: boolean
  reviewed: boolean
  reviewed_at: string | null
  timestamp: string
}

interface SafetyResponse {
  events: SafetyEvent[]
  total: number
  page: number
  pages: number
  flagBreakdown: Record<string, number>
}

const FLAG_LABELS: Record<string, { label: string; color: string }> = {
  suicidal_ideation: { label: 'Suicidal Ideation', color: '#D44040' },
  self_harm:         { label: 'Self Harm',          color: '#D44040' },
  harm_to_others:   { label: 'Harm to Others',     color: '#C4784A' },
  acute_crisis:     { label: 'Acute Crisis',        color: '#D44040' },
}

function SafetyInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const env = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const reviewed = searchParams.get('reviewed') ?? ''

  const [data, setData] = useState<SafetyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (val) p.set(key, val); else p.delete(key)
    p.set('page', '1')
    router.push(`${pathname}?${p.toString()}`)
  }

  async function markReviewed(id: string) {
    setReviewing(id)
    try {
      const res = await fetch('/api/admin/safety', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, env }),
      })
      if (res.ok) {
        // Refresh list
        loadData()
      }
    } finally {
      setReviewing(null)
    }
  }

  function loadData() {
    setLoading(true)
    setError('')
    setNotConfigured(false)
    const q = new URLSearchParams({ env, page: String(page) })
    if (reviewed) q.set('reviewed', reviewed)
    fetch(`/api/admin/safety?${q}`)
      .then(r => r.json())
      .then(d => { if (d.not_configured) { setNotConfigured(true); return }; if (d.error) throw new Error(d.error); setNotConfigured(false); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [env, page, reviewed]) // eslint-disable-line

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Safety · {env.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
          Safety Monitor
        </h1>
        <p style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', marginTop: '6px', lineHeight: 1.6 }}>
          Every safety flag triggers crisis routing. Season is always suppressed when flagged. Review each event manually.
        </p>
      </div>

      {/* Flag breakdown */}
      {data && !loading && Object.keys(data.flagBreakdown).length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {Object.entries(data.flagBreakdown).map(([type, count]) => {
            const meta = FLAG_LABELS[type] ?? { label: type, color: '#D44040' }
            return (
              <div key={type} style={{
                padding: '8px 14px', borderRadius: 'var(--r-lg)',
                background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.25)',
              }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: meta.color, marginBottom: '2px' }}>
                  {meta.label}
                </div>
                <div style={{ fontSize: '20px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)' }}>
                  {count}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { val: '',      label: 'All Events' },
          { val: 'false', label: 'Unreviewed' },
          { val: 'true',  label: 'Reviewed'   },
        ].map(opt => (
          <button
            key={opt.val}
            onClick={() => setParam('reviewed', opt.val)}
            style={{
              padding: '7px 14px', fontSize: 'var(--fs-3xs)', fontFamily: 'var(--font-sans)',
              background: reviewed === opt.val ? 'rgba(201,168,76,.12)' : 'var(--ink2)',
              border: `1px solid ${reviewed === opt.val ? 'rgba(201,168,76,.45)' : 'var(--hairline)'}`,
              borderRadius: 'var(--r-md)',
              color: reviewed === opt.val ? 'var(--gold2)' : 'var(--mist)',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', alignSelf: 'center' }}>
          {data ? `${data.total} total events` : ''}
        </div>
      </div>

      {loading && <p style={{ color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</p>}
      {notConfigured && <AdminEnvNotConfigured env={env} />}
      {!notConfigured && error && <p style={{ color: '#D44040', fontSize: 'var(--fs-sm)' }}>Error: {error}</p>}

      {data && !loading && data.events.length === 0 && (
        <div style={{
          padding: '32px', textAlign: 'center',
          background: 'var(--ink2)', border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-lg)', color: 'var(--mist)', fontSize: 'var(--fs-sm)',
        }}>
          No safety events for this filter.
        </div>
      )}

      {data && !loading && data.events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.events.map(ev => {
            const meta = ev.flag_type ? (FLAG_LABELS[ev.flag_type] ?? { label: ev.flag_type, color: '#D44040' }) : { label: 'Unknown', color: 'var(--mist)' }
            return (
              <div key={ev.id} style={{
                background: ev.reviewed ? 'var(--ink2)' : 'rgba(212,64,64,.05)',
                border: `1px solid ${ev.reviewed ? 'var(--hairline)' : 'rgba(212,64,64,.25)'}`,
                borderRadius: 'var(--r-lg)', padding: '16px 18px',
                display: 'flex', gap: '16px', alignItems: 'flex-start',
              }}>
                {/* Left: flag info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700,
                      color: meta.color, background: `${meta.color}18`, letterSpacing: '0.06em',
                    }}>
                      ⚑ {meta.label}
                    </span>
                    {ev.branch && (
                      <span style={{ fontSize: '10px', color: 'var(--gold)', background: 'rgba(201,168,76,.12)', padding: '2px 8px', borderRadius: '4px' }}>
                        Branch {ev.branch}
                      </span>
                    )}
                    {ev.season_suppressed && (
                      <span style={{ fontSize: '10px', color: 'var(--mist)', background: 'rgba(139,167,184,.08)', padding: '2px 8px', borderRadius: '4px' }}>
                        Season suppressed
                      </span>
                    )}
                    {ev.reviewed && (
                      <span style={{ fontSize: '10px', color: '#3DAF96', background: 'rgba(42,140,122,.1)', padding: '2px 8px', borderRadius: '4px' }}>
                        ✓ Reviewed
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', lineHeight: 1.7 }}>
                    <span style={{ color: 'var(--sand)', marginRight: '4px' }}>ID:</span>
                    <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{ev.id.slice(0, 12)}…</code>
                    {ev.session_id && (
                      <>
                        <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                        <span style={{ color: 'var(--sand)', marginRight: '4px' }}>Session:</span>
                        <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{ev.session_id.slice(0, 12)}…</code>
                      </>
                    )}
                    <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                    <span style={{ color: 'var(--sand)', marginRight: '4px' }}>Action:</span>
                    {ev.action}
                    <br />
                    <span style={{ color: 'var(--sand)', marginRight: '4px' }}>Flagged:</span>
                    {new Date(ev.timestamp).toLocaleString()}
                    {ev.reviewed_at && (
                      <>
                        <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                        <span style={{ color: 'var(--sand)', marginRight: '4px' }}>Reviewed:</span>
                        {new Date(ev.reviewed_at).toLocaleString()}
                      </>
                    )}
                  </div>
                </div>

                {/* Right: review button */}
                {!ev.reviewed && (
                  <button
                    onClick={() => markReviewed(ev.id)}
                    disabled={reviewing === ev.id}
                    style={{
                      flexShrink: 0, padding: '8px 14px', fontSize: '12px',
                      fontFamily: 'var(--font-sans)', fontWeight: 500,
                      background: 'rgba(42,140,122,.12)', border: '1px solid rgba(42,140,122,.35)',
                      borderRadius: 'var(--r-md)', color: '#3DAF96',
                      cursor: reviewing === ev.id ? 'default' : 'pointer',
                      opacity: reviewing === ev.id ? 0.6 : 1,
                    }}
                  >
                    {reviewing === ev.id ? 'Saving…' : 'Mark reviewed'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
          <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} style={pageBtn(page <= 1)}>← Prev</button>
          <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)' }}>{page} / {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setParam('page', String(page + 1))} style={pageBtn(page >= data.pages)}>Next →</button>
        </div>
      )}
    </div>
  )
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

export default function SafetyPage() {
  return <Suspense fallback={<LoadingShell />}><SafetyInner /></Suspense>
}
