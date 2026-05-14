'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'

interface SubscriptionStatus {
  planTier: 'free' | 'essentials' | 'insights'
  sessionsThisMonth: number | null
  limit: number | null
  authenticated: boolean
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

const SEASON_LABELS: Record<string, string> = {
  W: 'Winter',
  Sp: 'Spring',
  Su: 'Summer',
  Au: 'Autumn',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  essentials: 'Essentials',
  insights: 'Insights',
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Dashboard() {
  const router = useRouter()
  const [emailPrefix, setEmailPrefix] = useState('')
  const [joinedDate, setJoinedDate] = useState<string | null>(null)
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/signin?next=/dashboard')
        return
      }

      setEmailPrefix(user.email?.split('@')[0] ?? '')
      setJoinedDate(user.created_at ? formatDate(user.created_at) : null)

      const [subRes, histRes] = await Promise.all([
        fetch('/api/subscription').then(r => r.json()).catch(() => null),
        fetch('/api/sessions/history?limit=10').then(r => r.json()).catch(() => ({ sessions: [] })),
      ])

      if (subRes) setSubStatus(subRes as SubscriptionStatus)
      setSessions((histRes as { sessions: Session[] }).sessions ?? [])
      setLoading(false)
    }

    load()
  }, [router])

  const isPaid = subStatus && subStatus.planTier !== 'free'

  const periodEnd = subStatus?.subscription?.current_period_end
    ? new Date(subStatus.subscription.current_period_end).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
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
      <div className="px-6 py-5 max-w-lg mx-auto animate-fade-in">

        {/* Greeting */}
        <div className="mb-5">
          <h2 className="font-serif font-light text-sand2 text-2xl leading-tight">
            {greeting()}{emailPrefix ? `, ${emailPrefix}.` : '.'}
          </h2>
          <p className="text-xs text-mist mt-0.5">Here&apos;s where you are.</p>
        </div>

        {/* Quick start */}
        <Link
          href="/age-gate"
          className="btn-primary w-full block text-center py-3.5 text-sm mb-4"
        >
          Begin a new session →
        </Link>

        {/* Plan + usage card */}
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

            <div className="flex justify-between items-center py-1.5 border-b border-white/[.03]">
              <div className="text-sm text-sand">Current plan</div>
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

            {subStatus.planTier === 'free' && (
              <div className="flex justify-between items-center py-1.5 border-b border-white/[.03]">
                <div className="text-sm text-mist">Sessions this month</div>
                <div className="text-sm text-mist">
                  {subStatus.sessionsThisMonth ?? 0} / {FREE_SESSIONS_PER_MONTH}
                </div>
              </div>
            )}

            {isPaid && periodEnd && (
              <div className="flex justify-between items-center py-1.5 border-b border-white/[.03]">
                <div className="text-sm text-sand">
                  {subStatus.subscription?.cancel_at_period_end ? 'Cancels on' : 'Renews on'}
                </div>
                <div className="text-sm text-mist">{periodEnd}</div>
              </div>
            )}

            <div className="pt-2.5">
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
          </div>
        )}

        {/* Session history */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[7px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Session history
          </div>

          {loading ? (
            <div className="py-4 text-center">
              <div
                className="w-5 h-5 rounded-full animate-spin-slow mx-auto"
                style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }}
              />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-5 text-center">
              <p className="text-xs text-mist leading-relaxed">
                No sessions saved yet.<br />
                Sessions save automatically once you&apos;re signed in.
              </p>
            </div>
          ) : (
            sessions.map((s, i) => (
              <div
                key={s.id}
                className="flex justify-between items-center py-2.5"
                style={{ borderBottom: i < sessions.length - 1 ? '1px solid rgba(245,237,216,.04)' : 'none' }}
              >
                <div>
                  <div className="text-[11px] text-sand">{BRANCH_LABELS[s.branch] ?? s.branch}</div>
                  <div className="text-[9px] text-mist mt-0.5">
                    {formatDate(s.created_at)}
                    {s.season_assigned ? ` · ${SEASON_LABELS[s.season_assigned] ?? s.season_assigned}` : ''}
                    {!s.completed_at ? ' · incomplete' : ''}
                  </div>
                </div>
                {s.resonance_tap && (
                  <div
                    className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: s.resonance_tap === 'accurate'
                        ? 'rgba(42,140,122,.1)'
                        : 'rgba(139,167,184,.08)',
                      color: s.resonance_tap === 'accurate' ? 'var(--teal2)' : 'var(--mist)',
                      border: s.resonance_tap === 'accurate'
                        ? '1px solid rgba(42,140,122,.2)'
                        : '1px solid rgba(139,167,184,.12)',
                    }}
                  >
                    {s.resonance_tap === 'accurate' ? 'Felt accurate' : 'Not quite'}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Account info + link */}
        <div className="flex justify-between items-center">
          {joinedDate && (
            <p className="text-[9px]" style={{ color: 'rgba(139,167,184,.35)' }}>
              Member since {joinedDate}
            </p>
          )}
          <Link href="/settings" className="text-[9px] text-mist hover:text-sand transition-colors ml-auto">
            Account settings →
          </Link>
        </div>
      </div>
    </main>
  )
}
