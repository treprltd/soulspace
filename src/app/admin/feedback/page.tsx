'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'
import { AdminEnvNotConfigured } from '@/components/ui/AdminEnvNotConfigured'

// ── Label maps ────────────────────────────────────────────────────────────────

const RECOMMEND_LABELS: Record<string, string> = {
  yes_already: 'Already recommended',
  yes_likely:  'Would recommend',
  maybe:       'Maybe',
  not_yet:     'Not yet',
}

const RECOMMEND_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  yes_already: { color: '#3DAF96', bg: 'rgba(42,140,122,.12)',  border: 'rgba(42,140,122,.25)'  },
  yes_likely:  { color: '#3DAF96', bg: 'rgba(42,140,122,.10)',  border: 'rgba(42,140,122,.20)'  },
  maybe:       { color: '#C9A84C', bg: 'rgba(201,168,76,.12)',  border: 'rgba(201,168,76,.25)'  },
  not_yet:     { color: '#D44040', bg: 'rgba(212,64,64,.10)',   border: 'rgba(212,64,64,.22)'   },
}

const FREQUENCY_LABELS: Record<string, string> = {
  first_time:    'First time',
  few_times:     'A few times',
  weekly:        'Weekly',
  daily_or_more: 'Daily+',
}

const EASE_LABELS: Record<string, string> = {
  very_difficult: 'Very difficult',
  difficult:      'Difficult',
  neutral:        'Neutral',
  easy:           'Easy',
  very_easy:      'Very easy',
}

const VALUABLE_LABELS: Record<string, string> = {
  mirror_reflection: 'Mirror reflection',
  calming_design:    'Calming design',
  emotional_clarity: 'Emotional clarity',
  being_heard:       'Feeling heard',
  season_guidance:   'Season guidance',
  no_judgment:       'No judgment',
}

const IMPROVEMENT_LABELS: Record<string, string> = {
  more_sessions:    'More sessions',
  session_insights: 'Session insights',
  guided_prompts:   'Guided prompts',
  voice_input:      'Voice input',
  reminders:        'Reminders',
  mobile_app:       'Mobile app',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedbackRow {
  id:               string
  user_id:          string | null
  user_email:       string | null
  guest_email:      string | null
  overall_rating:   number | null
  use_frequency:    string | null
  most_valuable:    string[]
  ease_of_use:      string | null
  improvements:     string[]
  would_recommend:  string | null
  comments:         string | null
  created_at:       string
}

interface Stats {
  avg_rating:       number | null
  total_responses:  number
  rating_counts:    Record<number, number>
  recommend_counts: Record<string, number>
}

interface FeedbackResponse {
  feedback: FeedbackRow[]
  total:    number
  page:     number
  pages:    number
  stats:    Stats
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stars({ rating, size = 'sm' }: { rating: number | null; size?: 'sm' | 'lg' }) {
  if (rating === null) return <span style={{ color: 'var(--mist)' }}>—</span>
  const px = size === 'lg' ? 18 : 13
  return (
    <span>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#C9A84C' : 'rgba(201,168,76,.22)', fontSize: `${px}px` }}>★</span>
      ))}
    </span>
  )
}

function RecommendChip({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: 'rgba(213,226,235,.60)', fontSize: '11px' }}>—</span>
  const c = RECOMMEND_COLORS[value] ?? RECOMMEND_COLORS.maybe
  return (
    <span style={{
      fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {RECOMMEND_LABELS[value] ?? value}
    </span>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: '10px', padding: '2px 7px',
      borderRadius: '4px', background: 'rgba(245,237,216,.06)',
      border: '1px solid rgba(245,237,216,.76)', color: 'var(--sand)',
      marginRight: '4px', marginBottom: '3px',
    }}>
      {label}
    </span>
  )
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div style={{
      background: 'var(--ink2)', border: '1px solid var(--hairline)',
      borderRadius: 'var(--r-lg)', padding: '18px 20px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: accent ?? 'var(--sand2)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', marginTop: '6px' }}>{sub}</div>}
    </div>
  )
}

const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', fontSize: '11px', fontFamily: 'var(--font-sans)',
  background: active ? 'rgba(201,168,76,.12)' : 'var(--ink2)',
  border: `1px solid ${active ? 'rgba(201,168,76,.45)' : 'var(--hairline)'}`,
  borderRadius: 'var(--r-md)', color: active ? 'var(--gold2)' : 'var(--mist)',
  cursor: 'pointer', transition: 'all .12s',
})

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '7px 14px', fontSize: '11px', fontFamily: 'var(--font-sans)',
  background: 'var(--ink2)', border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)', color: disabled ? 'var(--mist)' : 'var(--sand)',
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
})

// ── Main inner component ──────────────────────────────────────────────────────

function FeedbackInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const env       = (searchParams.get('env')       ?? getDefaultAdminEnv()) as AdminEnv
  const page      = parseInt(searchParams.get('page')      ?? '1', 10)
  const rating    = searchParams.get('rating')    ?? ''
  const recommend = searchParams.get('recommend') ?? ''

  const [data,          setData]          = useState<FeedbackResponse | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)

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
    if (rating)    q.set('rating',    rating)
    if (recommend) q.set('recommend', recommend)
    fetch(`/api/admin/feedback?${q}`)
      .then(r => r.json())
      .then(d => {
        if (d.not_configured) { setNotConfigured(true); return }
        if (d.error) throw new Error(d.error as string)
        setNotConfigured(false)
        setData(d as FeedbackResponse)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [env, page, rating, recommend])

  const stats    = data?.stats
  const totalRec = Object.values(stats?.recommend_counts ?? {}).reduce((a, b) => a + b, 0)
  const maxRatCt = Math.max(...Object.values(stats?.rating_counts ?? { 1: 0 }), 1)

  const RECOMMEND_ORDER: Array<[string, string]> = [
    ['yes_already', 'Already recommended'],
    ['yes_likely',  'Would recommend'],
    ['maybe',       'Maybe'],
    ['not_yet',     'Not yet'],
  ]

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Beta Feedback · {env.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
          User Feedback
        </h1>
      </div>

      {notConfigured && <AdminEnvNotConfigured env={env} />}
      {!notConfigured && error && (
        <div style={{ padding: '14px 16px', background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)', borderRadius: 'var(--r-lg)', color: '#D44040', fontSize: 'var(--fs-sm)', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      {!notConfigured && !error && (
        <>
          {/* ── Stats row ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {/* Avg rating card */}
            <div style={{
              background: 'var(--ink2)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-lg)', padding: '18px 20px', flex: 1, minWidth: '160px',
            }}>
              <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '8px' }}>
                Avg Rating
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '32px', fontFamily: 'var(--font-serif)', fontWeight: 300, lineHeight: 1,
                  color: stats?.avg_rating !== null && stats?.avg_rating !== undefined
                    ? stats.avg_rating >= 4 ? '#3DAF96' : stats.avg_rating >= 3 ? '#C9A84C' : '#D44040'
                    : 'var(--mist)',
                }}>
                  {stats?.avg_rating !== null && stats?.avg_rating !== undefined
                    ? stats.avg_rating.toFixed(1) : '—'}
                </span>
                <span style={{ color: 'var(--mist)', fontSize: '11px', paddingBottom: '4px' }}>/5</span>
              </div>
              <Stars rating={stats?.avg_rating !== null && stats?.avg_rating !== undefined ? Math.round(stats.avg_rating) : null} />
              <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', marginTop: '6px' }}>
                from {stats?.total_responses ?? 0} responses
              </div>
            </div>

            <StatCard
              label="Total Responses"
              value={(stats?.total_responses ?? 0).toLocaleString()}
              sub={`page ${data?.page ?? 1} of ${data?.pages ?? 1}`}
            />

            {/* Recommend breakdown */}
            <div style={{
              background: 'var(--ink2)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-lg)', padding: '18px 20px', flex: 2, minWidth: '260px',
            }}>
              <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '12px' }}>
                Would Recommend
              </div>
              {totalRec === 0 ? (
                <div style={{ color: 'var(--mist)', fontSize: '12px' }}>No responses yet</div>
              ) : (
                RECOMMEND_ORDER.map(([key, label]) => {
                  const ct  = stats?.recommend_counts?.[key] ?? 0
                  const pct = totalRec > 0 ? Math.round((ct / totalRec) * 100) : 0
                  const c   = RECOMMEND_COLORS[key] ?? RECOMMEND_COLORS.maybe
                  return (
                    <div key={key} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--sand)' }}>{label}</span>
                        <span style={{ color: 'var(--mist)' }}>{ct} ({pct}%)</span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(245,237,216,.06)' }}>
                        <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: c.color }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Rating distribution */}
            <div style={{
              background: 'var(--ink2)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-lg)', padding: '18px 20px', flex: 1, minWidth: '180px',
            }}>
              <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '12px' }}>
                Rating Distribution
              </div>
              {[5, 4, 3, 2, 1].map(n => {
                const ct  = stats?.rating_counts?.[n] ?? 0
                const pct = maxRatCt > 0 ? Math.round((ct / maxRatCt) * 100) : 0
                const col = n >= 4 ? '#C9A84C' : n === 3 ? 'rgba(201,168,76,.5)' : '#D44040'
                return (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: col, width: '14px', textAlign: 'right' }}>{n}★</span>
                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(245,237,216,.06)' }}>
                      <div style={{ height: '100%', borderRadius: '3px', width: `${pct}%`, background: col }} />
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--mist)', width: '24px', textAlign: 'right' }}>{ct}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Filters ────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mist)' }}>
              Rating:
            </span>
            {(['', '5', '4', '3', '2', '1'] as const).map(r => (
              <button key={r} onClick={() => setParam('rating', r)} style={filterBtn(rating === r)}>
                {r ? `${r} ★` : 'All'}
              </button>
            ))}

            <div style={{ width: '1px', height: '20px', background: 'var(--hairline)', margin: '0 8px' }} />

            <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mist)' }}>
              Recommend:
            </span>
            {([
              ['', 'All'],
              ['yes_already', 'Already'],
              ['yes_likely',  'Would'],
              ['maybe',       'Maybe'],
              ['not_yet',     'Not yet'],
            ] as const).map(([val, label]) => (
              <button key={val} onClick={() => setParam('recommend', val)} style={filterBtn(recommend === val)}>
                {label}
              </button>
            ))}

            <div style={{ flex: 1 }} />
            {data && (
              <span style={{ fontSize: '11px', color: 'var(--mist)' }}>
                {data.total.toLocaleString()} submission{data.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading && <p style={{ color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</p>}

          {/* Empty state */}
          {!loading && data && data.feedback.length === 0 && (
            <div style={{
              padding: '40px', textAlign: 'center', background: 'var(--ink2)',
              border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)',
              color: 'var(--mist)', fontSize: 'var(--fs-sm)',
            }}>
              {rating || recommend ? 'No feedback matches the current filters.' : 'No feedback submitted yet.'}
            </div>
          )}

          {/* ── Table ───────────────────────────────────────────────────────── */}
          {!loading && data && data.feedback.length > 0 && (
            <>
              <div style={{ overflowX: 'auto', background: 'var(--ink2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                      {['User', 'Date', 'Rating', 'Ease', 'Recommend', 'Comments', ''].map(h => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left',
                          color: 'var(--gold)', fontWeight: 500,
                          fontSize: '10px', letterSpacing: '0.09em',
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.feedback.map((row) => {
                      const isExpanded = expandedId === row.id
                      return (
                        <>
                          <tr
                            key={row.id}
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid var(--hairline)',
                              cursor: 'pointer', transition: 'background .1s',
                            }}
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(245,237,216,.018)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                          >
                            {/* User */}
                            <td style={{ padding: '11px 14px', maxWidth: '200px' }}>
                              {row.user_email ? (
                                <div style={{ color: 'var(--sand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
                                  {row.user_email}
                                </div>
                              ) : row.guest_email ? (
                                <div>
                                  <span style={{
                                    display: 'inline-block', fontSize: '8px', padding: '1px 5px',
                                    borderRadius: '3px', background: 'rgba(201,168,76,.08)',
                                    border: '1px solid rgba(201,168,76,.22)', color: 'var(--gold)',
                                    letterSpacing: '0.08em', textTransform: 'uppercase',
                                    marginBottom: '2px', marginRight: '4px',
                                  }}>
                                    Guest
                                  </span>
                                  <div style={{ color: 'rgba(245,237,216,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
                                    {row.guest_email}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'rgba(213,226,235,.60)', fontSize: '11px' }}>—</span>
                              )}
                            </td>
                            {/* Date */}
                            <td style={{ padding: '11px 14px', color: 'var(--mist)', whiteSpace: 'nowrap', fontSize: '11px' }}>
                              {formatDate(row.created_at)}
                            </td>
                            {/* Rating */}
                            <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                              <Stars rating={row.overall_rating} />
                            </td>
                            {/* Ease */}
                            <td style={{ padding: '11px 14px', color: 'var(--mist)', whiteSpace: 'nowrap', fontSize: '11px' }}>
                              {row.ease_of_use ? (EASE_LABELS[row.ease_of_use] ?? row.ease_of_use) : <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}
                            </td>
                            {/* Recommend */}
                            <td style={{ padding: '11px 14px' }}>
                              <RecommendChip value={row.would_recommend} />
                            </td>
                            {/* Comments */}
                            <td style={{ padding: '11px 14px', maxWidth: '280px' }}>
                              {row.comments ? (
                                <span style={{
                                  color: 'var(--sand)', fontSize: '11px',
                                  display: '-webkit-box',
                                  overflow: 'hidden',
                                } as React.CSSProperties}>
                                  {row.comments.length > 100 ? row.comments.slice(0, 100) + '…' : row.comments}
                                </span>
                              ) : <span style={{ color: 'rgba(213,226,235,.60)', fontSize: '11px' }}>—</span>}
                            </td>
                            {/* Expand */}
                            <td style={{ padding: '11px 14px', textAlign: 'center', width: '32px' }}>
                              <span style={{
                                color: 'rgba(213,226,235,.65)', fontSize: '10px',
                                display: 'inline-block',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform .15s',
                              }}>
                                ▾
                              </span>
                            </td>
                          </tr>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <tr key={`${row.id}-detail`} style={{ borderBottom: '1px solid var(--hairline)' }}>
                              <td colSpan={7} style={{ padding: '0 14px 16px', background: 'rgba(6,14,24,.5)' }}>
                                <div style={{
                                  borderTop: '1px solid var(--hairline)', paddingTop: '14px',
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                  gap: '16px',
                                }}>

                                  {/* Use frequency */}
                                  <div>
                                    <div style={{ fontSize: '9px', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(213,226,235,.72)', marginBottom: '5px' }}>
                                      Use Frequency
                                    </div>
                                    <span style={{ color: 'var(--sand)', fontSize: '12px' }}>
                                      {row.use_frequency ? (FREQUENCY_LABELS[row.use_frequency] ?? row.use_frequency) : '—'}
                                    </span>
                                  </div>

                                  {/* Most valuable */}
                                  {row.most_valuable && row.most_valuable.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '9px', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(213,226,235,.72)', marginBottom: '6px' }}>
                                        Most Valuable
                                      </div>
                                      <div>
                                        {row.most_valuable.map(v => (
                                          <Tag key={v} label={VALUABLE_LABELS[v] ?? v} />
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Improvements */}
                                  {row.improvements && row.improvements.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '9px', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(213,226,235,.72)', marginBottom: '6px' }}>
                                        Would Improve
                                      </div>
                                      <div>
                                        {row.improvements.map(v => (
                                          <Tag key={v} label={IMPROVEMENT_LABELS[v] ?? v} />
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Full comments */}
                                  {row.comments && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                      <div style={{ fontSize: '9px', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(213,226,235,.72)', marginBottom: '6px' }}>
                                        Full Comment
                                      </div>
                                      <p style={{
                                        color: 'rgba(245,237,216,.65)', fontSize: '12px',
                                        lineHeight: 1.65, fontStyle: 'italic',
                                        borderLeft: '2px solid rgba(245,237,216,.1)',
                                        paddingLeft: '10px', margin: 0,
                                      }}>
                                        {row.comments}
                                      </p>
                                    </div>
                                  )}

                                  {/* Identifier — user UUID or guest email */}
                                  <div>
                                    {row.user_id ? (
                                      <>
                                        <div style={{ fontSize: '9px', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(213,226,235,.72)', marginBottom: '5px' }}>
                                          User ID
                                        </div>
                                        <span style={{ color: 'rgba(213,226,235,.65)', fontSize: '10px', fontFamily: 'monospace' }}>
                                          {row.user_id}
                                        </span>
                                      </>
                                    ) : row.guest_email ? (
                                      <>
                                        <div style={{ fontSize: '9px', letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(213,226,235,.72)', marginBottom: '5px' }}>
                                          Guest Email
                                        </div>
                                        <span style={{ color: 'var(--sand)', fontSize: '11px' }}>
                                          {row.guest_email}
                                        </span>
                                      </>
                                    ) : (
                                      <span style={{ color: 'rgba(213,226,235,.60)', fontSize: '11px' }}>—</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
                  <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} style={pageBtn(page <= 1)}>
                    ← Prev
                  </button>
                  <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{page} / {data.pages}</span>
                  <button disabled={page >= data.pages} onClick={() => setParam('page', String(page + 1))} style={pageBtn(page >= data.pages)}>
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function LoadingShell() {
  return <div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
}

export default function FeedbackPage() {
  return <Suspense fallback={<LoadingShell />}><FeedbackInner /></Suspense>
}
