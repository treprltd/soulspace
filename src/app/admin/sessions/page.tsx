'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

type AdminEnv = 'dev' | 'qa' | 'prod'

interface Session {
  id: string
  user_id: string
  branch: string | null
  created_at: string
  completed_at: string | null
  intensity: number | null
  safety_flagged: boolean
  season_assigned: string | null
  resonance_tap: string | null
  char_count: number | null
}

interface SessionsResponse {
  sessions: Session[]
  total: number
  page: number
  pages: number
  byBranch: Record<string, { total: number; accurate: number; avgIntensity: number; avgChars: number }>
}

const BRANCH_LABELS: Record<string, string> = {
  A: 'Decision Pressure', B: 'Something Unnamed',
  C: 'Pattern Repeating', D: 'Carrying Alone',
}

const SEASON_LABELS: Record<string, string> = {
  W: 'Winter', Sp: 'Spring', Su: 'Summer', Au: 'Autumn',
}

function badge(text: string, color: string, bg: string) {
  return (
    <span style={{
      fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
      color, background: bg, fontWeight: 600, letterSpacing: '0.06em',
    }}>
      {text}
    </span>
  )
}

function SessionsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const env = (searchParams.get('env') ?? 'dev') as AdminEnv
  const page = parseInt(searchParams.get('page') ?? '1')
  const branch = searchParams.get('branch') ?? ''
  const safety = searchParams.get('safety') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''

  const [data, setData] = useState<SessionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (val) p.set(key, val); else p.delete(key)
    p.set('page', '1')
    router.push(`${pathname}?${p.toString()}`)
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    const q = new URLSearchParams({ env, page: String(page) })
    if (branch) q.set('branch', branch)
    if (safety) q.set('safety', safety)
    if (from) q.set('from', from)
    if (to) q.set('to', to)

    fetch(`/api/admin/sessions?${q}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [env, page, branch, safety, from, to])

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Sessions · {env.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
          Session Analytics
        </h1>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <select
          value={branch}
          onChange={e => setParam('branch', e.target.value)}
          style={selectStyle}
        >
          <option value="">All Branches</option>
          {(['A', 'B', 'C', 'D'] as const).map(b => (
            <option key={b} value={b}>{b} — {BRANCH_LABELS[b]}</option>
          ))}
        </select>

        <select
          value={safety}
          onChange={e => setParam('safety', e.target.value)}
          style={selectStyle}
        >
          <option value="">All Sessions</option>
          <option value="flagged">Safety Flagged Only</option>
        </select>

        <input
          type="date"
          value={from}
          onChange={e => setParam('from', e.target.value)}
          style={{ ...selectStyle, color: from ? 'var(--sand)' : 'var(--mist)' }}
          placeholder="From date"
        />
        <input
          type="date"
          value={to}
          onChange={e => setParam('to', e.target.value)}
          style={{ ...selectStyle, color: to ? 'var(--sand)' : 'var(--mist)' }}
        />

        {(branch || safety || from || to) && (
          <button
            onClick={() => {
              const p = new URLSearchParams({ env })
              router.push(`${pathname}?${p.toString()}`)
            }}
            style={{ ...selectStyle, cursor: 'pointer', color: 'var(--gold)' }}
          >
            Clear filters ✕
          </button>
        )}
      </div>

      {/* Branch summary cards */}
      {data && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {(['A', 'B', 'C', 'D'] as const).map((b, i) => {
            const bv = data.byBranch[b]
            if (!bv) return null
            const colors = ['#6B8CAE', '#3DAF96', '#C9A84C', '#C4784A']
            const rate = bv.total > 0 ? Math.round((bv.accurate / bv.total) * 100) : null
            return (
              <div key={b} style={{
                background: 'var(--ink2)', border: '1px solid var(--hairline)',
                borderRadius: 'var(--r-lg)', padding: '14px 16px',
              }}>
                <div style={{ fontSize: '10px', color: colors[i], letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Branch {b}
                </div>
                <div style={{ fontSize: '22px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', marginBottom: '4px' }}>
                  {bv.total}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--mist)', lineHeight: 1.6 }}>
                  {rate !== null ? `${rate}% resonance` : 'No resonance data'}<br />
                  Avg intensity: {bv.avgIntensity || '—'}<br />
                  Avg chars: {bv.avgChars || '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      {loading && <p style={{ color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</p>}
      {error && <p style={{ color: '#D44040', fontSize: 'var(--fs-sm)' }}>Error: {error}</p>}

      {data && !loading && (
        <>
          <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', marginBottom: '10px' }}>
            {data.total.toLocaleString()} sessions · page {data.page} of {data.pages}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-3xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                  {['Session ID', 'Branch', 'Created', 'Intensity', 'Season', 'Resonance', 'Chars', 'Completed', 'Flags'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--gold)', fontWeight: 500, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--hairline)', transition: 'background .1s' }}>
                    <td style={{ padding: '9px 10px', color: 'var(--mist)', fontFamily: 'monospace', fontSize: '11px' }}>
                      {s.id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {s.branch ? badge(s.branch, '#C9A84C', 'rgba(201,168,76,.12)') : '—'}
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--mist)', whiteSpace: 'nowrap' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--sand)', textAlign: 'center' }}>
                      {s.intensity ?? '—'}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {s.season_assigned ? badge(SEASON_LABELS[s.season_assigned] ?? s.season_assigned, '#6B8CAE', 'rgba(107,140,174,.12)') : '—'}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {s.resonance_tap === 'accurate'
                        ? badge('Accurate', '#3DAF96', 'rgba(42,140,122,.12)')
                        : s.resonance_tap === 'not_quite'
                          ? badge('Not quite', 'var(--mist)', 'rgba(139,167,184,.08)')
                          : <span style={{ color: 'var(--mist)' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--mist)', textAlign: 'center' }}>
                      {s.char_count ?? '—'}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {s.completed_at
                        ? badge('Done', '#3DAF96', 'rgba(42,140,122,.10)')
                        : badge('Incomplete', 'var(--mist)', 'rgba(139,167,184,.08)')}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {s.safety_flagged ? badge('⚑ Flagged', '#D44040', 'rgba(212,64,64,.12)') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
              <button
                disabled={page <= 1}
                onClick={() => setParam('page', String(page - 1))}
                style={pageBtn(page <= 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)' }}>
                {page} / {data.pages}
              </span>
              <button
                disabled={page >= data.pages}
                onClick={() => setParam('page', String(page + 1))}
                style={pageBtn(page >= data.pages)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

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

export default function SessionsPage() {
  return <Suspense fallback={<LoadingShell />}><SessionsInner /></Suspense>
}
