'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { NotificationBanner } from '@/components/ui/NotificationBanner'
import { createClient } from '@/lib/supabase/client'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'

interface SubStatus {
  planTier: 'free' | 'essentials' | 'insights'
  sessionsThisMonth: number | null
  limit: number | null
  subscription?: {
    status: string
    current_period_end: string
    cancel_at_period_end: boolean
  } | null
}

interface Session {
  id: string
  branch: 'A' | 'B' | 'C' | 'D'
  created_at: string
  completed_at: string | null
  season_assigned: 'W' | 'Sp' | 'Su' | 'Au' | null
  resonance_tap: 'accurate' | 'not_quite' | null
  intensity: number | null
  safety_flagged?: boolean
}

interface SessionDetail extends Session {
  contextText: string | null
  mirrorOutput: string | null
}

const BRANCH_LABELS: Record<string, string> = {
  A: 'Decision pressure',
  B: 'Something unnamed',
  C: 'Pattern repeating',
  D: 'Carrying alone',
}

const BRANCH_DESC: Record<string, string> = {
  A: 'A decision kept pulling you back.',
  B: "You felt something you couldn't name.",
  C: "A pattern that wouldn't shift.",
  D: 'Something you were carrying alone.',
}

const SEASON_LABELS: Record<string, string> = {
  W: 'Winter', Sp: 'Spring', Su: 'Summer', Au: 'Autumn',
}

const SEASON_COLORS: Record<string, string> = {
  W: 'var(--W)', Sp: 'var(--Sp)', Su: 'var(--Su)', Au: 'var(--Au)',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', essentials: 'Essentials', insights: 'Insights',
}

function greetingWord() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) {
    const h = Math.floor(diff / 3600000)
    if (h === 0) return 'Just now'
    return `${h}h ago`
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return formatDate(iso)
}

export default function Dashboard() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')  // first_name if set, else email prefix
  const [joinedDate, setJoinedDate] = useState<string | null>(null)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, SessionDetail>>({})
  const [detailLoading, setDetailLoading] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/signin?next=/dashboard')
        return
      }

      setEmail(user.email ?? '')
      setJoinedDate(user.created_at ? formatDate(user.created_at) : null)

      // Pass JWT so server-side routes can authenticate (implicit-flow client)
      const { data: { session } } = await supabase.auth.getSession()
      const authHeaders: Record<string, string> = {}
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`

      const [subRes, histRes, profileRes] = await Promise.all([
        fetch('/api/subscription', { headers: authHeaders }).then(r => r.json()).catch(() => null),
        fetch('/api/sessions/history?limit=50', { headers: authHeaders }).then(r => r.json()).catch(() => ({ sessions: [] })),
        fetch('/api/user/profile', { headers: authHeaders }).then(r => r.json()).catch(() => null),
      ])

      // Use first name if available, else fall back to email prefix
      const firstName = (profileRes as { first_name?: string } | null)?.first_name
      setDisplayName(firstName?.trim() ? firstName.trim() : (user.email?.split('@')[0] ?? ''))

      if (subRes) setSubStatus(subRes as SubStatus)
      setSessions((histRes as { sessions: Session[] }).sessions ?? [])
      setLoading(false)
    }

    load()
  }, [router])

  async function toggleDetail(session: Session) {
    const id = session.id
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (detailCache[id]) return            // already fetched

    setDetailLoading(id)
    try {
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (authSession?.access_token) headers['Authorization'] = `Bearer ${authSession.access_token}`

      const res = await fetch(`/api/sessions/${id}`, { headers })
      if (res.ok) {
        const detail = await res.json() as SessionDetail
        setDetailCache(prev => ({ ...prev, [id]: detail }))
      }
    } catch { /* noop */ } finally {
      setDetailLoading(null)
    }
  }

  const isPaid = subStatus?.planTier !== 'free'
  const sessionsThisMonth = subStatus?.sessionsThisMonth ?? 0
  const completedSessions = sessions.filter(s => s.completed_at)
  const visibleSessions = showAll ? sessions : sessions.slice(0, 6)
  const accurateCount = sessions.filter(s => s.resonance_tap === 'accurate').length
  const tappedCount = sessions.filter(s => s.resonance_tap !== null).length
  const resonancePct = tappedCount > 0 ? Math.round((accurateCount / tappedCount) * 100) : null

  const periodEnd = subStatus?.subscription?.current_period_end
    ? new Date(subStatus.subscription.current_period_end).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  const usageBarPct = isPaid ? 0 : Math.min((sessionsThisMonth / FREE_SESSIONS_PER_MONTH) * 100, 100)
  const remaining = FREE_SESSIONS_PER_MONTH - sessionsThisMonth

  if (loading && !displayName) {
    return (
      <main style={{ background: '#060E18', minHeight: '100vh' }}>
        <NavBar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div
            className="w-8 h-8 rounded-full"
            style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }}
          />
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />

      <div className="px-5 py-6 max-w-xl mx-auto animate-fade-in">

        {/* ── Notification banners ─────────────────────────────── */}
        {subStatus?.subscription?.status === 'past_due' && (
          <NotificationBanner type="payment_past_due" />
        )}
        {subStatus?.planTier === 'free' && sessionsThisMonth >= FREE_SESSIONS_PER_MONTH && (
          <NotificationBanner type="session_limit_reached" />
        )}
        {/* Warning only makes sense when limit > 1 — with 1/month there's no "approaching" state */}
        {subStatus?.planTier === 'free' && FREE_SESSIONS_PER_MONTH > 1 && sessionsThisMonth >= Math.floor(FREE_SESSIONS_PER_MONTH * 0.7) && sessionsThisMonth < FREE_SESSIONS_PER_MONTH && (
          <NotificationBanner type="session_limit_warning" detail={`${sessionsThisMonth}/${FREE_SESSIONS_PER_MONTH}`} />
        )}
        {subStatus?.subscription?.cancel_at_period_end && subStatus.subscription.current_period_end && (() => {
          const daysLeft = Math.ceil((new Date(subStatus.subscription.current_period_end).getTime() - Date.now()) / 86400000)
          return daysLeft <= 7 ? <NotificationBanner type="subscription_expiring" detail={daysLeft} /> : null
        })()}

        {/* ── Greeting ─────────────────────────────────────────── */}
        <div className="mb-5">
          <p className="text-[9px] tracking-[.12em] uppercase text-mist mb-0.5">{greetingWord()}</p>
          <h1 className="font-serif font-light text-sand2 leading-tight" style={{ fontSize: '26px' }}>
            {displayName || 'Welcome back'}.
          </h1>
          {joinedDate && (
            <p className="text-[9px] mt-1" style={{ color: 'rgba(139,167,184,.45)' }}>
              Member since {joinedDate}
            </p>
          )}
        </div>

        {/* ── Quick start ──────────────────────────────────────── */}
        <Link
          href="/age-gate"
          className="btn-primary w-full block text-center py-3 text-sm mb-5"
        >
          Begin a new session →
        </Link>

        {/* ── Plan & Usage card ────────────────────────────────── */}
        {subStatus && (
          <div
            className="rounded-xl p-4 mb-4"
            style={{
              background: isPaid ? 'rgba(201,168,76,.04)' : 'rgba(15,30,46,.6)',
              border: isPaid ? '1px solid rgba(201,168,76,.15)' : '1px solid rgba(245,237,216,.06)',
            }}
          >
            {/* Plan header */}
            <div className="flex items-center justify-between mb-3">
              <div
                className="text-[7px] tracking-[.11em] uppercase"
                style={{ color: 'rgba(139,167,184,.5)' }}
              >
                Your plan
              </div>
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-medium"
                style={{
                  background: isPaid ? 'rgba(201,168,76,.12)' : 'rgba(139,167,184,.08)',
                  color: isPaid ? 'var(--gold2)' : 'var(--mist)',
                  border: isPaid ? '1px solid rgba(201,168,76,.22)' : '1px solid rgba(139,167,184,.12)',
                }}
              >
                {PLAN_LABELS[subStatus.planTier]}
              </span>
            </div>

            {/* Usage display */}
            {!isPaid ? (
              /* Free tier — progress bar */
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sand text-sm font-medium">
                    {sessionsThisMonth}
                    <span className="text-mist text-[11px] font-normal"> of {FREE_SESSIONS_PER_MONTH} sessions this month</span>
                  </span>
                  <span
                    className="text-[9px]"
                    style={{ color: remaining === 0 ? 'var(--danger)' : remaining === 1 ? 'rgba(201,168,76,.8)' : 'rgba(139,167,184,.5)' }}
                  >
                    {remaining === 0 ? 'None left' : `${remaining} remaining`}
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className="w-full rounded-full overflow-hidden mb-3"
                  style={{ height: '4px', background: 'rgba(139,167,184,.1)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${usageBarPct}%`,
                      background: remaining === 0
                        ? 'var(--danger)'
                        : remaining === 1
                        ? 'var(--gold)'
                        : 'var(--teal2)',
                    }}
                  />
                </div>

                {/* Pip markers */}
                <div className="flex items-center justify-between mb-3 px-0.5">
                  {Array.from({ length: FREE_SESSIONS_PER_MONTH }).map((_, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: i < sessionsThisMonth
                          ? remaining === 0 ? 'var(--danger)' : 'var(--teal2)'
                          : 'rgba(139,167,184,.15)',
                      }}
                    />
                  ))}
                  <span className="text-[8px]" style={{ color: 'rgba(139,167,184,.3)' }}>resets monthly</span>
                </div>

                <Link href="/pricing" className="btn-primary text-[11px] w-full block text-center py-2">
                  Upgrade for unlimited sessions →
                </Link>
              </div>
            ) : (
              /* Paid tier */
              <div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="font-serif font-light text-sand2 text-2xl">{sessionsThisMonth}</span>
                  <span className="text-[11px] text-mist">sessions this month</span>
                </div>
                <p className="text-[9px] mb-3" style={{ color: 'rgba(139,167,184,.45)' }}>
                  Unlimited · {completedSessions.length} total across all time
                  {periodEnd && ` · ${subStatus?.subscription?.cancel_at_period_end ? 'Cancels' : 'Renews'} ${periodEnd}`}
                </p>
                <Link href="/settings" className="btn-outline text-[11px] w-full block text-center py-2">
                  Manage subscription →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Stats row ────────────────────────────────────────── */}
        {!loading && sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {[
              { value: completedSessions.length.toString(), label: 'total sessions' },
              { value: sessionsThisMonth.toString(), label: 'this month' },
              {
                value: resonancePct !== null ? `${resonancePct}%` : '—',
                label: 'felt accurate',
                color: resonancePct !== null && resonancePct >= 60 ? 'var(--teal2)' : undefined,
              },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(15,30,46,.5)', border: '1px solid rgba(245,237,216,.04)' }}
              >
                <div
                  className="font-serif text-xl font-light"
                  style={{ color: stat.color ?? 'var(--sand2)' }}
                >
                  {stat.value}
                </div>
                <div className="text-[8px] text-mist mt-0.5 leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Session history ───────────────────────────────────── */}
        <div
          className="rounded-xl mb-4"
          style={{ background: 'rgba(15,30,46,.55)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          {/* Header */}
          <div
            className="px-4 pt-4 pb-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            <div className="text-[7px] tracking-[.11em] uppercase text-mist">Session history</div>
            {sessions.length > 0 && (
              <div className="text-[9px]" style={{ color: 'rgba(139,167,184,.4)' }}>
                {sessions.length} total
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-10 flex justify-center">
              <div
                className="w-5 h-5 rounded-full"
                style={{ border: '1.5px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }}
              />
            </div>

          ) : sessions.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="font-serif italic text-mist text-sm mb-1.5">No sessions yet.</p>
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(139,167,184,.4)' }}>
                Complete a session while signed in<br />and it will appear here.
              </p>
            </div>

          ) : (
            <>
              {visibleSessions.map((s, i) => {
                const isExpanded = expandedId === s.id
                const isLoadingDetail = detailLoading === s.id
                const detail = detailCache[s.id]
                return (
                  <div key={s.id}>
                    {/* ── Session row (clickable) ── */}
                    <div
                      className="px-4 py-3.5"
                      onClick={() => toggleDetail(s)}
                      style={{
                        borderBottom: (!isExpanded && i < visibleSessions.length - 1)
                          ? '1px solid rgba(245,237,216,.04)'
                          : 'none',
                        cursor: 'pointer',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,237,216,.018)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="flex items-start justify-between gap-3">

                        {/* Left block */}
                        <div className="flex-1 min-w-0">
                          {/* Branch + season dot */}
                          <div className="flex items-center gap-2 mb-0.5">
                            {s.season_assigned && (
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: SEASON_COLORS[s.season_assigned] ?? 'var(--mist)' }}
                              />
                            )}
                            <span className="text-[11px] text-sand font-medium leading-tight">
                              {BRANCH_LABELS[s.branch] ?? s.branch}
                            </span>
                          </div>

                          {/* Branch description */}
                          <p className="text-[9px] leading-relaxed mb-1.5" style={{ color: 'rgba(139,167,184,.5)' }}>
                            {BRANCH_DESC[s.branch]}
                          </p>

                          {/* Meta row */}
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                            <span className="text-[9px] text-mist">{formatRelative(s.created_at)}</span>

                            {s.season_assigned && (
                              <>
                                <span style={{ color: 'rgba(139,167,184,.2)', fontSize: '9px' }}>·</span>
                                <span className="text-[9px]" style={{ color: SEASON_COLORS[s.season_assigned] ?? 'var(--mist)' }}>
                                  {SEASON_LABELS[s.season_assigned]}
                                </span>
                              </>
                            )}

                            {s.intensity !== null && (
                              <>
                                <span style={{ color: 'rgba(139,167,184,.2)', fontSize: '9px' }}>·</span>
                                <span className="text-[9px]" style={{ color: 'rgba(139,167,184,.45)' }}>
                                  intensity {s.intensity}/10
                                </span>
                              </>
                            )}

                            {!s.completed_at && (
                              <>
                                <span style={{ color: 'rgba(139,167,184,.2)', fontSize: '9px' }}>·</span>
                                <span className="text-[9px]" style={{ color: 'rgba(212,64,64,.45)' }}>incomplete</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right: resonance badge + chevron */}
                        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                          {s.resonance_tap ? (
                            <div
                              className="text-[8px] px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{
                                background: s.resonance_tap === 'accurate'
                                  ? 'rgba(42,140,122,.1)'
                                  : 'rgba(139,167,184,.07)',
                                color: s.resonance_tap === 'accurate' ? 'var(--teal2)' : 'var(--mist)',
                                border: s.resonance_tap === 'accurate'
                                  ? '1px solid rgba(42,140,122,.2)'
                                  : '1px solid rgba(139,167,184,.1)',
                              }}
                            >
                              {s.resonance_tap === 'accurate' ? '✓ Felt accurate' : 'Not quite'}
                            </div>
                          ) : s.completed_at ? (
                            <div
                              className="text-[8px] px-2 py-0.5 rounded-full"
                              style={{
                                color: 'rgba(139,167,184,.3)',
                                border: '1px solid rgba(139,167,184,.08)',
                              }}
                            >
                              No tap
                            </div>
                          ) : null}

                          {/* Chevron indicator */}
                          <span
                            style={{
                              color: 'rgba(139,167,184,.3)',
                              fontSize: '9px',
                              transition: 'transform .2s',
                              display: 'inline-block',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                          >
                            ▾
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ── Expanded detail panel ── */}
                    {isExpanded && (
                      <div
                        className="px-4 pb-4"
                        style={{
                          borderBottom: i < visibleSessions.length - 1
                            ? '1px solid rgba(245,237,216,.04)'
                            : 'none',
                          borderTop: '1px solid rgba(245,237,216,.04)',
                          background: 'rgba(6,14,24,.4)',
                        }}
                      >
                        {isLoadingDetail ? (
                          <div className="py-5 flex justify-center">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ border: '1.5px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }}
                            />
                          </div>
                        ) : (
                          <div className="pt-3 space-y-3">

                            {/* Full timestamp */}
                            <div className="text-[9px]" style={{ color: 'rgba(139,167,184,.35)' }}>
                              {new Date(s.created_at).toLocaleString('en-US', {
                                weekday: 'long', month: 'long', day: 'numeric',
                                year: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </div>

                            {/* Safety suppressed */}
                            {(detail?.safety_flagged || s.safety_flagged) && (
                              <div
                                className="rounded-lg px-3 py-2.5 text-[10px] leading-relaxed"
                                style={{
                                  background: 'rgba(212,64,64,.06)',
                                  border: '1px solid rgba(212,64,64,.15)',
                                  color: 'rgba(212,64,64,.7)',
                                }}
                              >
                                This session was routed to support resources. Mirror output was not generated.
                              </div>
                            )}

                            {/* What you shared */}
                            {detail?.contextText && (
                              <div>
                                <div
                                  className="text-[7px] tracking-[.11em] uppercase mb-1.5"
                                  style={{ color: 'rgba(139,167,184,.4)' }}
                                >
                                  What you shared
                                </div>
                                <p
                                  className="text-[11px] leading-relaxed"
                                  style={{
                                    color: 'rgba(245,237,216,.55)',
                                    fontStyle: 'italic',
                                    borderLeft: '2px solid rgba(245,237,216,.08)',
                                    paddingLeft: '10px',
                                  }}
                                >
                                  {detail.contextText}
                                </p>
                              </div>
                            )}

                            {/* Mirror reflection */}
                            {detail?.mirrorOutput && !(detail?.safety_flagged) && (
                              <div>
                                <div
                                  className="text-[7px] tracking-[.11em] uppercase mb-1.5"
                                  style={{ color: 'rgba(201,168,76,.5)' }}
                                >
                                  Mirror reflection
                                </div>
                                <p
                                  className="text-[9px] leading-relaxed mb-2"
                                  style={{ color: 'rgba(201,168,76,.4)', fontStyle: 'italic' }}
                                >
                                  This is not a diagnosis. It is what seemed to be here, from what you shared.
                                </p>
                                <p
                                  className="text-[11px] leading-relaxed"
                                  style={{ color: 'rgba(245,237,216,.7)' }}
                                >
                                  {detail.mirrorOutput}
                                </p>
                              </div>
                            )}

                            {/* Incomplete / no content */}
                            {!detail?.contextText && !detail?.mirrorOutput && !isLoadingDetail && !detail?.safety_flagged && (
                              <p className="text-[10px] text-mist italic">
                                {!s.completed_at
                                  ? 'This session was not completed.'
                                  : 'No content stored for this session.'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Show more */}
              {sessions.length > 6 && (
                <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(245,237,216,.04)' }}>
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="text-[10px] text-mist hover:text-sand transition-colors"
                  >
                    {showAll ? '↑ Show fewer' : `↓ Show all ${sessions.length} sessions`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Account footer ────────────────────────────────────── */}
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'rgba(15,30,46,.4)', border: '1px solid rgba(245,237,216,.04)' }}
        >
          <div className="text-[9px] text-mist truncate mr-3">{email}</div>
          <Link href="/settings" className="text-[9px] text-mist hover:text-sand transition-colors flex-shrink-0">
            Account settings →
          </Link>
        </div>

      </div>
    </main>
  )
}
