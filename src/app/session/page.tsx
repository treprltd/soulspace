'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Branch, SituationId } from '@/types'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/analytics'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'

interface Situation {
  id: SituationId
  label: string
  symbol: string
  branch: Branch
}

// Each situation maps internally to one of the four resonance branches.
// A = decision_pressure  B = something_unnamed
// C = pattern_repeating  D = carrying_alone
const SITUATIONS: Situation[] = [
  { id: 'work-career',  label: 'Work or career',   symbol: '◈', branch: 'A' },
  { id: 'relationship', label: 'A relationship',    symbol: '◡', branch: 'D' },
  { id: 'family',       label: 'Family',            symbol: '△', branch: 'D' },
  { id: 'money',        label: 'Money',             symbol: '◎', branch: 'A' },
  { id: 'big-decision', label: 'A big decision',    symbol: '⊙', branch: 'A' },
  { id: 'my-health',    label: 'My health',         symbol: '○', branch: 'B' },
  { id: 'who-i-am',     label: 'Who I am',          symbol: '◇', branch: 'B' },
  { id: 'loss-grief',   label: 'Loss or grief',     symbol: '▽', branch: 'D' },
  { id: 'anxiety',      label: 'Anxiety',           symbol: '≈', branch: 'C' },
  { id: 'life-change',  label: 'A life change',     symbol: '→', branch: 'C' },
  { id: 'friendship',   label: 'Friendship',        symbol: '∞', branch: 'D' },
  { id: 'not-sure',     label: 'Not sure yet',      symbol: '···', branch: 'B' },
]

// Creates the sessions row now (authenticated users only) so a real
// session_id exists for every funnel event from this point on, instead of
// only from the context-submit page onward. Anonymous users get no row —
// unchanged behavior, they still get the mirror output, just unpersisted.
async function createSessionAndGetId(branch: Branch, situation: SituationId): Promise<string | undefined> {
  try {
    const supabase = createClient()
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession?.access_token) return undefined

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({ branch, situation }),
    })
    if (!res.ok) return undefined
    const { session: dbSession } = await res.json() as { session: { id: string } }
    return dbSession.id
  } catch {
    return undefined
  }
}

export default function SituationEntry() {
  const router = useRouter()
  const [selected, setSelected] = useState<SituationId | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [blocked, setBlocked] = useState(false)

  // ── Early free-tier check — before any emotional investment ──────────────
  // Previously the monthly cap was only enforced at the Mirror loading screen,
  // after the user had already picked a situation and walked through
  // emotions/intensity/context. Checking here means an authenticated free
  // user who's used their session this month sees the upgrade prompt before
  // doing any of that work, not after.
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const supabase = createClient()
        const { data: { session: authSession } } = await supabase.auth.getSession()
        if (!authSession?.access_token) { setCheckingAccess(false); return }

        const res = await fetch('/api/subscription', {
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        })
        if (res.ok) {
          const data = await res.json() as { planTier: string; sessionsThisMonth: number | null; limit: number | null }
          if (data.planTier === 'free' && data.limit !== null && (data.sessionsThisMonth ?? 0) >= data.limit) {
            setBlocked(true)
          }
        }
      } catch {
        // Fail open — same philosophy as the voice-input subscription check:
        // an access-check failure should never itself block the session.
      } finally {
        setCheckingAccess(false)
      }
    }
    checkAccess()
  }, [])

  const handleSelect = async (s: Situation) => {
    setSelected(s.id)
    sessionStorage.setItem('ss_branch', s.branch)
    sessionStorage.setItem('ss_situation', s.id)

    // Run session creation and the minimum visible-selection delay concurrently
    // so slow networks don't add to the existing 280ms pause.
    const [sessionId] = await Promise.all([
      createSessionAndGetId(s.branch, s.id),
      new Promise(resolve => setTimeout(resolve, 280)),
    ])

    if (sessionId) sessionStorage.setItem('ss_session_id', sessionId)
    logEvent({ sessionId, eventName: 'session_start' })
    logEvent({ sessionId, eventName: 'branch_selected', properties: { branch: s.branch, situation: s.id } })

    router.push('/session/emotions')
  }

  if (checkingAccess) {
    return (
      <main style={{ background: '#060E18', minHeight: '100vh' }} className="flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full"
          style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }}
        />
      </main>
    )
  }

  if (blocked) {
    return (
      <main style={{ background: '#060E18', minHeight: '100vh' }}>
        <NavBar right={<span style={{ color: 'rgba(213,226,235,.65)', fontSize: '11px' }}>Your session</span>} />
        <div className="flex items-center justify-center px-4 sm:px-5 py-8 sm:py-10">
          <div className="w-full max-w-sm animate-fade-in text-center">
            <h1 className="font-serif font-light text-sand2 leading-tight mb-3" style={{ fontSize: '24px' }}>
              You&rsquo;ve used your free session{FREE_SESSIONS_PER_MONTH === 1 ? '' : 's'} this month.
            </h1>
            <p className="text-sm text-mist mb-6 leading-relaxed">
              Your next free session is available next month. Unlimited sessions start at $9.99/month.
            </p>
            <Link href="/pricing" className="btn-primary inline-block py-3 px-6 mb-3">
              See plans →
            </Link>
            <div>
              <Link href="/dashboard" className="text-xs underline underline-offset-4" style={{ color: 'rgba(213,226,235,.65)' }}>
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: 'rgba(213,226,235,.65)', fontSize: '11px' }}>Your session</span>} />
      <div className="flex items-center justify-center px-4 sm:px-5 py-8 sm:py-10">
        <div className="w-full max-w-lg animate-fade-in">

          <div className="text-center mb-8">
            {/* AFFIRMATION MOMENT 1 — frozen copy */}
            <div className="affirm-copy mb-5">
              You do not need to explain everything right away.<br />
              Let&rsquo;s begin with what feels closest.
            </div>
            <h1
              className="font-serif font-light text-sand2 leading-tight mb-2"
              style={{ fontSize: '26px' }}
            >
              What is this <em className="text-gold2">mostly about?</em>
            </h1>
            <p className="text-sm text-mist">
              You may be carrying more than one thing. Choose what feels most present.
            </p>
          </div>

          {/* 3-column grid — 12 situations incl. escape hatch */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            {SITUATIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className={`situation-card${selected === s.id ? ' selected' : ''}`}
              >
                <span className="situation-symbol">{s.symbol}</span>
                <span className="situation-label">{s.label}</span>
              </button>
            ))}
          </div>

          <p
            className="text-center leading-relaxed text-xs"
            style={{ color: 'rgba(213,226,235,.60)' }}
          >
            No wrong answer. Everything that follows adapts to what you choose.
          </p>

        </div>
      </div>
    </main>
  )
}
