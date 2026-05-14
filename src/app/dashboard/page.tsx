'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
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
  W: 'Winter',
  Sp: 'Spring',
  Su: 'Summer',
  Au: 'Autumn',
}

const SEASON_COLORS: Record<string, string> = {
  W: 'var(--W)',
  Sp: 'var(--Sp)',
  Su: 'var(--Su)',
  Au: 'var(--Au)',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  essentials: 'Essentials',
  insights: 'Insights',
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
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`
  return formatDate(iso)
}

export default function Dashboard() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [emailPrefix, setEmailPrefix] = useState('')
  const [joinedDate, setJoinedDate] = useState<string | null>(null)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/signin?next=/dashboard')
        return
      }

      setEmail(user.email ?? '')
      setEmailPrefix(user.email?.split('@')[0] ?? '')
      setJoinedDate(user.created_at ? formatDate(user.created_at) : null)

      const [subRes, histRes] = await Promise.all([
        fetch('/api/subscription').then(r => r.json()).catch(() => null),
        fetch('/api/sessions/history?limit=50').then(r => r.json()).catch(() => ({ sessions: [] })),
      ])

      if (subRes) setSubStatus(subRes as SubStatus)
      setSessions((histRes as { sessions: Session[] }).sessions ?? [])
      setLoading(false)
    }

    load()
  }, [router])

  const isPaid = subStatus && subStatus.planTier !== 'free'
  const completedSessions = sessions.filter(s => s.completed_at)
  const visibleSessions = showAll ? sessions : sessions.slice(0, 5)
  const accurateCount = sessions.filter(s => s.resonance_tap === 'accurate').length
  const tappedCount = sessions.filter(s => s.resonance_tap !== null).length

  const periodEnd = subStatus?.subscription?.current_period_end
    ? new Date(subStatus.subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  if (loading && !emailPrefix) {
    return (
      <main style={{ background: '#060E18', minHeight: '100vh' }}>
        <NavBar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 rounded-full animate-spin-slow" style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }} />
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />
      <div className="px-6 py-6 max-w-xl mx-auto animate-fade-in">

        {/* ── Greeting ── */}
        <div className="mb-6">
          <p className="text-[9px] tracking-[.12em] uppercase text-mist mb-1">{greetingWord()}</p>
          <h1 className="font-serif font-light text-sand2 leading-tight" style={{ fontSize: '28px' }}>
            {emailPrefix || 'Welcome back'}.
          </h1>
          {joinedDate && (
            <p className="text-[10px] text-mist mt-1">Member since {joinedDate}</p>
          )}
        </div>

        {/* ── Quick start ── */}
        <Link
          href="/age-gate"
          className="btn-primary w-full block text-center py-3.5 text-sm mb-5"
        >
          Begin a new session →
        </Link>

        {/* ── Stats row ── */}
        {!loading && sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
            >
              <div className="font-serif text-2xl font-light text-sand2">{completedSessions.length}</div>
              <div className="text-[9px] text-mist mt-0.5">sessions</div>
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
            >
              <div className="font-serif text-2xl font-light text-sand2">
                {subStatus?.sessionsThisMonth ?? 0}
              </div>
              <div className="text-[9px] text-mist mt-0.5">this month</div>
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
            >
              <div className="font-serif text-2xl font-light" style={{ color: 'var(--teal2)' }}>
                {tappedCount > 0 ? `${Math.round((accurateCount / tappedCount) * 100)}%` : '—'}
              </div>
              <div className="text-[9px] text-mist mt-0.5">resonance</div>
            </div>
          </div>
        )}

        {/* ── Session history ── */}
        <div
          className="rounded-xl mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="px-4 pt-4 pb-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            <div className="text-[7px] tracking-[.11em] uppercase text-mist">Session history</div>
            {sessions.length > 0 && (
              <div className="text-[9px] text-mist">{sessions.length} total</div>
            )}
          </div>

          {loading ? (
            <div className="py-8 flex justify-center">
              <div className="w-5 h-5 rounded-full animate-spin-slow" style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }} />
            </div>

          ) : sessions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="font-serif italic text-mist text-sm mb-1">No sessions yet.</p>
              <p className="text-[10px] text-mist leading-relaxed" style={{ color: 'rgba(139,167,184,.5)' }}>
                Your sessions will appear here once you complete one while signed in.
              </p>
            </div>

          ) : (
            <div>
              {visibleSessions.map((s, i) => (
                <div
                  key={s.id}
                  className="px-4 py-3.5 flex items-start justify-between gap-3"
                  style={{ borderBottom: i < visibleSessions.length - 1 ? '1px solid rgba(245,237,216,.04)' : 'none' }}
                >
                  {/* Left: branch + date */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {/* Season dot */}
                      {s.season_assigned && (
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                          style={{ background: SEASON_COLORS[s.season_assigned] ?? 'var(--mist)' }}
                        />
                      )}
                      <span className="text-[11px] text-sand font-medium">
                        {BRANCH_LABELS[s.branch] ?? s.branch}
                      </span>
                    </div>
                    <div className="text-[9px] leading-relaxed" style={{ color: 'rgba(139,167,184,.5)' }}>
                      {BRANCH_DESC[s.branch]}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-mist">{formatRelative(s.created_at)}</span>
                      {s.season_assigned && (
                        <>
                          <span className="text-[9px]" style={{ color: 'rgba(139,167,184,.25)' }}>·</span>
                          <span
                            className="text-[9px]"
                            style={{ color: SEASON_COLORS[s.season_assigned] ?? 'var(--mist)' }}
                          >
                            {SEASON_LABELS[s.season_assigned]}
                          </span>
                        </>
                      )}
                      {!s.completed_at && (
                        <>
                          <span className="text-[9px]" style={{ color: 'rgba(139,167,184,.25)' }}>·</span>
                          <span className="text-[9px]" style={{ color: 'rgba(212,64,64,.5)' }}>incomplete</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: resonance tap */}
                  {s.resonance_tap && (
                    <div
                      className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{
                        background: s.resonance_tap === 'accurate' ? 'rgba(42,140,122,.1)' : 'rgba(139,167,184,.08)',
                        color: s.resonance_tap === 'accurate' ? 'var(--teal2)' : 'var(--mist)',
                        border: s.resonance_tap === 'accurate' ? '1px solid rgba(42,140,122,.2)' : '1px solid rgba(139,167,184,.12)',
                      }}
                    >
                      {s.resonance_tap === 'accurate' ? 'Felt accurate' : 'Not quite'}
                    </div>
                  )}
                </div>
              ))}

              {/* Show more / less */}
              {sessions.length > 5 && (
                <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(245,237,216,.04)' }}>
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="text-[10px] text-mist hover:text-sand transition-colors"
                  >
                    {showAll ? 'Show fewer ↑' : `Show all ${sessions.length} sessions ↓`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Plan card ── */}
        {subStatus && (
          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
          >
            <div
              className="text-[7px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
              style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
            >
              Your plan
            </div>

            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-sm text-sand">{PLAN_LABELS[subStatus.planTier] ?? 'Free'}</div>
                <div className="text-[9px] text-mist mt-0.5">
                  {isPaid ? 'Unlimited sessions' : `${subStatus.sessionsThisMonth ?? 0} of ${FREE_SESSIONS_PER_MONTH} sessions used this month`}
                </div>
              </div>
              <div
                className="px-2.5 py-1 rounded-full text-[9px] font-medium"
                style={{
                  background: isPaid ? 'rgba(201,168,76,.1)' : 'rgba(139,167,184,.08)',
                  color: isPaid ? 'var(--gold2)' : 'var(--mist)',
                  border: isPaid ? '1px solid rgba(201,168,76,.2)' : '1px solid rgba(139,167,184,.15)',
                }}
              >
                {PLAN_LABELS[subStatus.planTier] ?? 'Free'}
              </div>
            </div>

            {isPaid && periodEnd && (
              <div className="flex justify-between items-center mb-3 text-xs">
                <span className="text-mist">
                  {subStatus.subscription?.cancel_at_period_end ? 'Cancels on' : 'Renews on'}
                </span>
                <span className="text-sand">{periodEnd}</span>
              </div>
            )}

            {isPaid ? (
              <Link href="/settings" className="btn-outline text-xs w-full block text-center py-2">
                Manage subscription →
              </Link>
            ) : (
              <Link href="/pricing" className="btn-primary text-xs w-full block text-center py-2">
                Upgrade for unlimited sessions →
              </Link>
            )}
          </div>
        )}

        {/* ── Account links ── */}
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'rgba(15,30,46,.4)', border: '1px solid rgba(245,237,216,.04)' }}
        >
          <div className="text-[10px] text-mist truncate mr-3">{email}</div>
          <Link href="/settings" className="text-[10px] text-mist hover:text-sand transition-colors flex-shrink-0">
            Account settings →
          </Link>
        </div>

      </div>
    </main>
  )
}
