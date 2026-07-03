'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { NotificationBanner } from '@/components/ui/NotificationBanner'
import { createClient } from '@/lib/supabase/client'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'
import { PATTERN_CARD_LABEL } from '@/lib/copy/patterns'

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
  situation?: string | null   // human-readable label, stored from migration 008 onward
  created_at: string
  completed_at: string | null
  season_assigned: 'W' | 'Sp' | 'Su' | 'Au' | null
  resonance_tap: 'accurate' | 'not_quite' | null
  intensity: number | null
  emotion_tags?: string[] | null
  safety_flagged?: boolean
}

interface SessionDetail extends Session {
  contextText: string | null
  mirrorOutput: string | null
}

// Fallback labels used only when situation is not stored (sessions before migration 008).
// Newer sessions display the human-readable situation label directly.
const BRANCH_LABELS: Record<string, string> = {
  A: 'A decision',
  B: 'Hard to name',
  C: 'A pattern',
  D: 'Carrying it alone',
}

const BRANCH_DESC: Record<string, string> = {
  A: 'Something kept pulling you back to a decision.',
  B: "You felt something you couldn't quite explain.",
  C: "Something kept repeating — not crisis, but not right.",
  D: 'Something you had been carrying on your own.',
}

// Maps the stored situation id back to a display label
const SITUATION_LABELS: Record<string, string> = {
  'work-career':  'Work or career',
  'relationship': 'A relationship',
  'family':       'Family',
  'money':        'Money',
  'big-decision': 'A big decision',
  'my-health':    'My health',
  'who-i-am':     'Who I am',
  'loss-grief':   'Loss or grief',
  'anxiety':      'Anxiety',
  'life-change':  'A life change',
  'friendship':   'Friendship',
  'not-sure':     'Not sure yet',
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
  const [memoryGreeting, setMemoryGreeting] = useState<string | null>(null)
  const [patternInsight, setPatternInsight] = useState<string | null>(null)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)

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


      const [subRes, histRes, profileRes, memoryRes, patternsRes] = await Promise.all([
        fetch('/api/subscription', { headers: authHeaders }).then(r => r.json()).catch(() => null),
        fetch('/api/sessions/history?limit=50', { headers: authHeaders }).then(r => r.json()).catch(() => ({ sessions: [] })),
        fetch('/api/user/profile', { headers: authHeaders }).then(r => r.json()).catch(() => null),
        fetch('/api/user/memory-greeting', { headers: authHeaders }).then(r => r.json()).catch(() => null),
        fetch('/api/user/patterns', { headers: authHeaders }).then(r => r.json()).catch(() => null),
      ])

      // Memory is an enhancement, not a blocker — null/error simply means no
      // greeting renders (first-time visitor, or every prior session was
      // safety-flagged, in which case the crisis gate suppresses memory too).
      const greetingText = (memoryRes as { greeting?: string | null } | null)?.greeting
      if (greetingText) setMemoryGreeting(greetingText)

      // Pattern card — same "enhancement, never a blocker" contract. Renders
      // only when the server found enough non-flagged history to say
      // something meaningful (see /api/user/patterns).
      const patternsBody = patternsRes as { available?: boolean; insight?: string | null } | null
      if (patternsBody?.available && patternsBody.insight) setPatternInsight(patternsBody.insight)

      // Use first name if available, else fall back to email prefix
      const profileBody = profileRes as { first_name?: string; profile_complete?: boolean } | null
      const firstName = profileBody?.first_name
      setDisplayName(firstName?.trim() ? firstName.trim() : (user.email?.split('@')[0] ?? ''))
      // Track profile completeness — drives the incomplete-profile banner below
      setProfileComplete(profileBody?.profile_complete === true)

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

  // ── Growth Map: pattern computation ──────────────────────────────────────
  // Only compute when there are 3+ completed sessions
  const growthMapSessions = completedSessions.filter(s => !s.safety_flagged)

  const patternData = (() => {
    if (growthMapSessions.length < 3) return null

    // Top situations
    const sitCount: Record<string, number> = {}
    for (const s of growthMapSessions) {
      const label = s.situation
        ? (SITUATION_LABELS[s.situation] ?? s.situation)
        : null
      if (label) sitCount[label] = (sitCount[label] ?? 0) + 1
    }
    const topSituations = Object.entries(sitCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    // Top emotions across all sessions
    const emotionCount: Record<string, number> = {}
    for (const s of growthMapSessions) {
      for (const tag of s.emotion_tags ?? []) {
        emotionCount[tag] = (emotionCount[tag] ?? 0) + 1
      }
    }
    const topEmotions = Object.entries(emotionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag)

    // Intensity: first session vs recent average (last 3)
    const withIntensity = growthMapSessions.filter(s => s.intensity !== null)
    const firstIntensity = withIntensity.length > 0
      ? withIntensity[withIntensity.length - 1].intensity!
      : null
    const recentThree = withIntensity.slice(0, 3)
    const recentAvg = recentThree.length > 0
      ? Math.round(recentThree.reduce((a, s) => a + s.intensity!, 0) / recentThree.length)
      : null

    // Season journey (up to 6 most recent with a season)
    const seasonJourney = growthMapSessions
      .filter(s => s.season_assigned)
      .slice(0, 6)
      .map(s => s.season_assigned!)
      .reverse() // oldest first

    return { topSituations, topEmotions, firstIntensity, recentAvg, seasonJourney }
  })()

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
        {/* Profile incomplete — shown until the user fills in all required
            fields. Non-dismissable: profile data is required for the account
            to function properly (comms, verification, age compliance). */}
        {profileComplete === false && (
          <NotificationBanner type="profile_incomplete" />
        )}
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
          <p className="text-xs tracking-[.12em] uppercase text-mist mb-0.5">{greetingWord()}</p>
          <h1 className="font-serif font-light text-sand2 leading-tight" style={{ fontSize: '32px' }}>
            {displayName || 'Welcome back'}.
          </h1>
          {joinedDate && (
            <p className="text-xs mt-1" style={{ color: 'rgba(213,226,235,.65)' }}>
              Member since {joinedDate}
            </p>
          )}
        </div>

        {/* ── Memory greeting — shown only to returning users with a usable
             memory of their last visit (locked copy, see src/lib/copy/memory.ts).
             This is always-on / read-only here; the only opt-in piece is the
             check-in email toggle, configured in Settings. ── */}
        {memoryGreeting && (
          <div
            data-testid="memory-greeting"
            className="rounded-xl p-4 mb-5"
            style={{ background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.12)' }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,.7)' }}>
              {memoryGreeting}
            </p>
          </div>
        )}

        {/* ── Pattern card — "what you've been carrying" ───────────────────
             Lightweight, multi-session pattern surface (Phase 2 scoping,
             2026-06-07): the one remaining gap named repeatedly in user
             research after memory/check-ins shipped. Server computes a single
             gentle, non-diagnostic observation (src/lib/copy/patterns.ts —
             draft copy, not yet locked) from categorical session data only;
             never free text, never shown for safety-flagged history (same
             crisis gate as memory/Season). Appears only once there's enough
             history to say something meaningful — silent otherwise. ── */}
        {patternInsight && (
          <div
            data-testid="pattern-card"
            className="rounded-xl p-4 mb-5"
            style={{ background: 'rgba(139,167,184,.04)', border: '1px solid rgba(139,167,184,.12)' }}
          >
            <p className="text-xs tracking-[.1em] uppercase mb-1.5" style={{ color: 'rgba(213,226,235,.72)' }}>
              {PATTERN_CARD_LABEL}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,.7)' }}>
              {patternInsight}
            </p>
          </div>
        )}

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
                className="text-[17px] tracking-[.11em] uppercase"
                style={{ color: 'rgba(213,226,235,.72)' }}
              >
                Your plan
              </div>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-medium"
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
                    <span className="text-mist text-xs font-normal"> of {FREE_SESSIONS_PER_MONTH} sessions this month</span>
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: remaining === 0 ? 'var(--danger)' : remaining === 1 ? 'rgba(201,168,76,.8)' : 'rgba(213,226,235,.72)' }}
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
                  <span className="text-[17px]" style={{ color: 'rgba(213,226,235,.60)' }}>resets monthly</span>
                </div>

                <Link href="/pricing" className="btn-primary text-xs w-full block text-center py-2">
                  Upgrade for unlimited sessions →
                </Link>
              </div>
            ) : (
              /* Paid tier */
              <div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="font-serif font-light text-sand2 text-2xl">{sessionsThisMonth}</span>
                  <span className="text-xs text-mist">sessions this month</span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'rgba(213,226,235,.65)' }}>
                  Unlimited · {completedSessions.length} total across all time
                  {periodEnd && ` · ${subStatus?.subscription?.cancel_at_period_end ? 'Cancels' : 'Renews'} ${periodEnd}`}
                </p>
                <Link href="/settings" className="btn-outline text-xs w-full block text-center py-2">
                  Manage subscription →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Growth Map: teaser for 1–2 sessions ──────────────── */}
        {!loading && growthMapSessions.length >= 1 && growthMapSessions.length < 3 && (
          <div
            className="rounded-xl p-4 mb-4 animate-fade-in"
            style={{ background: 'rgba(15,30,46,.5)', border: '1px solid rgba(201,168,76,.08)' }}
          >
            <div className="flex items-start gap-3">
              {/* Progress dots */}
              <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: i < growthMapSessions.length
                        ? 'rgba(201,168,76,.6)'
                        : 'rgba(245,237,216,.08)',
                    }}
                  />
                ))}
              </div>
              <div>
                <div className="text-[18px] tracking-[.12em] uppercase mb-1" style={{ color: 'rgba(201,168,76,.55)' }}>
                  Your patterns
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,.76)' }}>
                  After {3 - growthMapSessions.length} more session{3 - growthMapSessions.length === 1 ? '' : 's'}, your patterns will start appearing here — what you keep bringing, how you tend to feel, how your season is shifting.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Growth Map: What keeps coming up ─────────────────── */}
        {patternData && (
          <div
            className="rounded-xl p-4 mb-4 animate-fade-in"
            style={{ background: 'rgba(15,30,46,.5)', border: '1px solid rgba(201,168,76,.1)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between mb-3 pb-2"
              style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
            >
              <div className="text-[18px] tracking-[.14em] uppercase" style={{ color: 'rgba(201,168,76,.7)' }}>
                What keeps coming up
              </div>
              <div className="text-[17px]" style={{ color: 'rgba(213,226,235,.60)' }}>
                {growthMapSessions.length} sessions
              </div>
            </div>

            {/* Top situations */}
            {patternData.topSituations.length > 0 && (
              <div className="mb-3">
                <div className="text-[17px] tracking-[.1em] uppercase mb-2" style={{ color: 'rgba(213,226,235,.65)' }}>
                  You keep bringing
                </div>
                {patternData.topSituations.map(([label, count]) => {
                  const pct = Math.round((count / growthMapSessions.length) * 100)
                  return (
                    <div key={label} className="flex items-center gap-2 mb-1.5">
                      <div className="text-xs text-sand flex-shrink-0 w-32 truncate">{label}</div>
                      <div className="flex-1 h-px rounded-full overflow-hidden" style={{ background: 'rgba(245,237,216,.06)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: 'rgba(201,168,76,.4)' }}
                        />
                      </div>
                      <div className="text-xs flex-shrink-0" style={{ color: 'rgba(213,226,235,.65)' }}>
                        {count}×
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Top emotions */}
            {patternData.topEmotions.length > 0 && (
              <div className="mb-3">
                <div className="text-[17px] tracking-[.1em] uppercase mb-2" style={{ color: 'rgba(213,226,235,.65)' }}>
                  How you tend to arrive
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {patternData.topEmotions.map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{
                        background: 'rgba(201,168,76,.06)',
                        border: '1px solid rgba(201,168,76,.18)',
                        color: 'rgba(232,201,122,.75)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Intensity shift + season journey */}
            <div className="grid grid-cols-2 gap-3">
              {/* Intensity */}
              {patternData.firstIntensity !== null && patternData.recentAvg !== null && (
                <div>
                  <div className="text-[17px] tracking-[.1em] uppercase mb-1.5" style={{ color: 'rgba(213,226,235,.65)' }}>
                    Intensity
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-serif text-lg font-light" style={{ color: 'var(--sand2)' }}>
                      {patternData.firstIntensity}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(213,226,235,.60)' }}>→</span>
                    <span
                      className="font-serif text-lg font-light"
                      style={{
                        color: patternData.recentAvg < patternData.firstIntensity
                          ? 'var(--teal2)'
                          : patternData.recentAvg > patternData.firstIntensity
                          ? 'rgba(212,64,64,.75)'
                          : 'var(--sand2)',
                      }}
                    >
                      {patternData.recentAvg}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(213,226,235,.60)' }}>/10</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(213,226,235,.60)' }}>
                    {patternData.recentAvg < patternData.firstIntensity
                      ? 'easing'
                      : patternData.recentAvg > patternData.firstIntensity
                      ? 'higher lately'
                      : 'holding steady'}
                  </div>
                </div>
              )}

              {/* Season journey */}
              {patternData.seasonJourney.length > 1 && (
                <div>
                  <div className="text-[17px] tracking-[.1em] uppercase mb-1.5" style={{ color: 'rgba(213,226,235,.65)' }}>
                    Your seasons
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {patternData.seasonJourney.map((s, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[17px] font-medium"
                          style={{
                            background: `${SEASON_COLORS[s] ?? 'var(--mist)'}18`,
                            color: SEASON_COLORS[s] ?? 'var(--mist)',
                            border: `1px solid ${SEASON_COLORS[s] ?? 'var(--mist)'}35`,
                          }}
                        >
                          {s}
                        </span>
                        {i < patternData!.seasonJourney.length - 1 && (
                          <span style={{ color: 'rgba(213,226,235,.56)', fontSize: '17px' }}>→</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(213,226,235,.60)' }}>
                    {patternData.seasonJourney[patternData.seasonJourney.length - 1] === patternData.seasonJourney[0]
                      ? 'same season throughout'
                      : 'your season is shifting'}
                  </div>
                </div>
              )}
            </div>
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
                  className="dash-stat-value font-serif text-xl font-light"
                  style={{ color: stat.color ?? 'var(--sand2)' }}
                >
                  {stat.value}
                </div>
                <div className="dash-stat-label text-[16px] text-mist mt-0.5 leading-tight">{stat.label}</div>
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
            <div className="text-[17px] tracking-[.11em] uppercase text-mist">Session history</div>
            {sessions.length > 0 && (
              <div className="text-xs" style={{ color: 'rgba(213,226,235,.65)' }}>
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
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(213,226,235,.65)' }}>
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
                          {/* Situation / branch + season dot */}
                          <div className="flex items-center gap-2 mb-0.5">
                            {s.season_assigned && (
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: SEASON_COLORS[s.season_assigned] ?? 'var(--mist)' }}
                              />
                            )}
                            <span className="text-sm text-sand font-medium leading-tight">
                              {s.situation
                                ? (SITUATION_LABELS[s.situation] ?? s.situation)
                                : (BRANCH_LABELS[s.branch] ?? s.branch)}
                            </span>
                          </div>

                          {/* Description — only shown when no situation stored (legacy sessions) */}
                          {!s.situation && (
                            <p className="text-xs leading-relaxed mb-1.5" style={{ color: 'rgba(213,226,235,.72)' }}>
                              {BRANCH_DESC[s.branch]}
                            </p>
                          )}

                          {/* Meta row */}
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                            <span className="text-xs text-mist">{formatRelative(s.created_at)}</span>

                            {s.season_assigned && (
                              <>
                                <span style={{ color: 'rgba(213,226,235,.56)', fontSize: '17px' }}>·</span>
                                <span className="text-xs" style={{ color: SEASON_COLORS[s.season_assigned] ?? 'var(--mist)' }}>
                                  {SEASON_LABELS[s.season_assigned]}
                                </span>
                              </>
                            )}

                            {s.intensity !== null && (
                              <>
                                <span style={{ color: 'rgba(213,226,235,.56)', fontSize: '17px' }}>·</span>
                                <span className="text-xs" style={{ color: 'rgba(213,226,235,.65)' }}>
                                  intensity {s.intensity}/10
                                </span>
                              </>
                            )}

                            {!s.completed_at && (
                              <>
                                <span style={{ color: 'rgba(213,226,235,.56)', fontSize: '17px' }}>·</span>
                                <span className="text-xs" style={{ color: 'rgba(212,64,64,.45)' }}>incomplete</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right: resonance badge + chevron */}
                        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                          {s.resonance_tap ? (
                            <div
                              className="session-badge text-[17px] px-2 py-0.5 rounded-full whitespace-nowrap"
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
                              className="text-[16px] px-2 py-0.5 rounded-full"
                              style={{
                                color: 'rgba(213,226,235,.60)',
                                border: '1px solid rgba(139,167,184,.08)',
                              }}
                            >
                              No tap
                            </div>
                          ) : null}

                          {/* Chevron indicator */}
                          <span
                            style={{
                              color: 'rgba(213,226,235,.60)',
                              fontSize: '17px',
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
                            <div className="text-xs" style={{ color: 'rgba(213,226,235,.60)' }}>
                              {new Date(s.created_at).toLocaleString('en-US', {
                                weekday: 'long', month: 'long', day: 'numeric',
                                year: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </div>

                            {/* Safety suppressed */}
                            {(detail?.safety_flagged || s.safety_flagged) && (
                              <div
                                className="rounded-lg px-3 py-2.5 text-xs leading-relaxed"
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
                                  className="text-[17px] tracking-[.11em] uppercase mb-1.5"
                                  style={{ color: 'rgba(213,226,235,.65)' }}
                                >
                                  What you shared
                                </div>
                                <p
                                  className="text-xs leading-relaxed"
                                  style={{
                                    color: 'rgba(245,237,216,.76)',
                                    fontStyle: 'italic',
                                    borderLeft: '2px solid rgba(245,237,216,.08)',
                                    paddingLeft: '10px',
                                  }}
                                >
                                  {detail.contextText}
                                </p>
                              </div>
                            )}

                            {/* Mirror reflection — parse stored JSON into readable sections */}
                            {detail?.mirrorOutput && !(detail?.safety_flagged) && (() => {
                              let parsed: { carrying?: string; underneath?: string; question?: string } | null = null
                              try { parsed = JSON.parse(detail.mirrorOutput) } catch { /* show nothing if unparseable */ }
                              if (!parsed) return null
                              return (
                                <div className="space-y-2.5">
                                  <div
                                    className="text-[17px] tracking-[.11em] uppercase"
                                    style={{ color: 'rgba(201,168,76,.5)' }}
                                  >
                                    Mirror reflection
                                  </div>
                                  {parsed.carrying && (
                                    <div>
                                      <div className="text-[17px] tracking-[.1em] uppercase mb-1" style={{ color: 'rgba(213,226,235,.65)' }}>
                                        What you were carrying
                                      </div>
                                      <p className="font-serif italic text-xs leading-relaxed" style={{ color: 'rgba(245,237,216,.65)', borderLeft: '2px solid rgba(201,168,76,.2)', paddingLeft: '10px' }}>
                                        {parsed.carrying}
                                      </p>
                                    </div>
                                  )}
                                  {parsed.underneath && (
                                    <div>
                                      <div className="text-[17px] tracking-[.1em] uppercase mb-1" style={{ color: 'rgba(213,226,235,.65)' }}>
                                        What appeared underneath
                                      </div>
                                      <p className="font-serif italic text-xs leading-relaxed" style={{ color: 'rgba(245,237,216,.65)', borderLeft: '2px solid rgba(201,168,76,.2)', paddingLeft: '10px' }}>
                                        {parsed.underneath}
                                      </p>
                                    </div>
                                  )}
                                  {parsed.question && (
                                    <div>
                                      <div className="text-[17px] tracking-[.1em] uppercase mb-1" style={{ color: 'rgba(61,175,150,.5)' }}>
                                        Question back to you
                                      </div>
                                      <p className="font-serif italic text-xs leading-relaxed" style={{ color: 'rgba(245,237,216,.65)', borderLeft: '2px solid rgba(42,140,122,.25)', paddingLeft: '10px' }}>
                                        {parsed.question}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* Incomplete / no content */}
                            {!detail?.contextText && !detail?.mirrorOutput && !isLoadingDetail && !detail?.safety_flagged && (
                              <p className="text-xs text-mist italic">
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
                    className="text-xs text-mist hover:text-sand transition-colors"
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
          <div className="text-xs text-mist truncate mr-3">{email}</div>
          <Link href="/settings" className="text-xs text-mist hover:text-sand transition-colors flex-shrink-0">
            Account settings →
          </Link>
        </div>

      </div>

      {/* FeedbackPanel is now rendered globally via FeedbackWrapper in root layout */}

    </main>
  )
}
