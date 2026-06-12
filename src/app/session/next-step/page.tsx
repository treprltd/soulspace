'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'
import type { MirrorOutput } from '@/types'
import { IconBadge, CarryingIcon, MattersIcon, ConsiderWeekIcon, TodayIcon } from '@/components/session/SectionIcons'

// One reframe per resonance branch — a cognitive shift, not an action
const BRANCH_REFRAMES: Record<string, string> = {
  A: "The decision keeps returning not because you haven't thought about it enough — but because both options hold something real. That tension is information, not a failure to decide.",
  B: "Not being able to name what you're feeling doesn't mean something is wrong. Sometimes the feeling arrives before the words do.",
  C: "Patterns repeat not because you are stuck, but because something in you is still waiting to be noticed. Noticing it is already a change.",
  D: "Carrying something alone for a long time doesn't mean you were wrong to. It means you've been strong for a long time. You don't have to keep carrying it the same way.",
}

// One "this week" noticing prompt per resonance branch — observation only,
// never an instruction. Scoped to a week (vs. the "today" action picker)
// so the two cards don't feel redundant.
const CONSIDER_THIS_WEEK: Record<string, string> = {
  A: 'This week, notice if the decision feels different on different days. What seems to shift it?',
  B: "This week, notice when the feeling shows up most strongly — and what's happening around it.",
  C: 'This week, notice the next time this pattern appears. What seems to come right before it?',
  D: 'This week, notice if there\'s a moment you almost said something to someone — and what held you back.',
}

const NEXT_STEPS = [
  'Write down the two things that are in tension, side by side, without trying to resolve them yet.',
  'Give yourself permission to not decide anything today — just for the next 24 hours.',
  'Talk to one person you trust — not to get advice, just to say it out loud.',
  'Take a 10-minute walk without your phone. Notice what rises up when you\'re quiet.',
  'Write one sentence about what you actually want — not what you think you should want.',
  'Set aside 15 minutes tomorrow morning to sit with this — not to decide, just to notice.',
  'Notice where in your body this feels heaviest. Name it without trying to move it.',
  'Cancel or postpone one non-essential thing today to give yourself more space.',
  'Write a letter to yourself from six months from now — what might you understand then?',
  'Do one thing that has nothing to do with this — something that restores you.',
  'Ask yourself: what would I tell a close friend in exactly this situation?',
  'Name what you are most afraid of. Just saying it clearly sometimes changes its shape.',
  'Consider what staying with this would cost — and what leaving it would cost.',
  'Observe one moment today when this weight lifts, even slightly. Just notice it.',
  'Give yourself credit for simply recognising what you are carrying. That takes honesty.',
  'Rest without resolution. Some things clarify only after stillness.',
  'Reach out to one person — not for answers, just to feel less alone in this.',
  'Write the question you are actually asking — beneath the situation itself.',
  'Choose not to act today. Inaction is also a choice, and sometimes the right one.',
  'Return to Soul Space in a few days. Your season may already be shifting.',
]

interface SubStatus {
  planTier: string
  sessionsThisMonth: number | null
  limit: number | null
}

export default function NextStep() {
  const router = useRouter()
  const [selected, setSelected] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [done, setDone] = useState(false)
  const [reframe, setReframe] = useState<string | null>(null)

  // Auth state — checked directly via browser client (not subscription API)
  // to avoid server-side cookie sync timing issues
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)
  const [patternInsight, setPatternInsight] = useState<string | null>(null)
  const [carrying, setCarrying] = useState<string | null>(null)
  const [considerThisWeek, setConsiderThisWeek] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Check auth via browser client — reliable regardless of cookie state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user)
    })

    // Read branch from sessionStorage and pick the matching reframe
    const branch = sessionStorage.getItem('ss_branch')
    if (branch && BRANCH_REFRAMES[branch]) {
      setReframe(BRANCH_REFRAMES[branch])
    }
    if (branch && CONSIDER_THIS_WEEK[branch]) {
      setConsiderThisWeek(CONSIDER_THIS_WEEK[branch])
    }

    // Echo back "what you're carrying" from the Mirror — closes the loop
    // between reflection and action without generating anything new.
    const storedMirror = sessionStorage.getItem('ss_mirror')
    if (storedMirror) {
      try {
        const m = JSON.parse(storedMirror) as MirrorOutput
        if (m.carrying) setCarrying(m.carrying)
      } catch { /* malformed — skip the carrying recap */ }
    }

    // Keep in sync if auth changes mid-page
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session?.user)
    })

    // Fetch plan/usage + session history (for pattern micro-insight)
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      const headers: Record<string, string> = {}
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`
      }

      const [subData, histData] = await Promise.all([
        fetch('/api/subscription', { headers }).then(r => r.json()).catch(() => null),
        fetch('/api/sessions/history?limit=50', { headers }).then(r => r.json()).catch(() => null),
      ])

      if (subData) setSubStatus(subData as SubStatus)

      // Compute pattern insight from completed past sessions (not the current one)
      const currentSessionId = sessionStorage.getItem('ss_session_id')
      const pastSessions: Array<{ situation?: string | null; emotion_tags?: string[] | null; completed_at: string | null }> =
        ((histData as { sessions?: Array<{ id: string; situation?: string | null; emotion_tags?: string[] | null; completed_at: string | null }> })?.sessions ?? [])
          .filter((s: { id: string; completed_at: string | null }) => s.completed_at && s.id !== currentSessionId)

      if (pastSessions.length >= 2) {
        // Top situation across past completed sessions
        const sitCount: Record<string, number> = {}
        for (const s of pastSessions) {
          if (s.situation) sitCount[s.situation] = (sitCount[s.situation] ?? 0) + 1
        }
        const topSit = Object.entries(sitCount).sort((a, b) => b[1] - a[1])[0]

        const SITUATION_LABELS: Record<string, string> = {
          'work-career': 'work or career', 'relationship': 'relationships',
          'family': 'family', 'money': 'money', 'big-decision': 'a big decision',
          'my-health': 'your health', 'who-i-am': 'who you are',
          'loss-grief': 'loss or grief', 'anxiety': 'anxiety',
          'life-change': 'a life change', 'friendship': 'friendship',
          'not-sure': 'something undefined',
        }

        if (topSit && topSit[1] >= 2) {
          setPatternInsight(
            `You've now completed ${pastSessions.length + 1} sessions. You keep returning with something about ${SITUATION_LABELS[topSit[0]] ?? topSit[0]}.`
          )
        } else {
          setPatternInsight(
            `You've now completed ${pastSessions.length + 1} sessions. The pattern is building.`
          )
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleDone = async () => {
    setDone(true)
    const sessionId = sessionStorage.getItem('ss_session_id')
    if (sessionId) {
      // Pass Bearer token so server can authenticate implicit-flow JWT
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`
      }
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST', headers }).catch(() => {})
    }
    // Clear session state
    ;['ss_branch', 'ss_situation', 'ss_emotions', 'ss_intensity', 'ss_context', 'ss_mirror', 'ss_resonance', 'ss_session_id']
      .forEach(k => sessionStorage.removeItem(k))

    // All users land on the sign-up/sign-in page with the feedback panel pre-opened.
    // Authenticated users go to their dashboard (still with feedback open).
    if (isAuthenticated) {
      router.push('/dashboard?feedback=1')
    } else {
      router.push('/auth/register?feedback=1')
    }
  }

  // Show nudge when the user has reached (or exceeded) the monthly limit.
  // With limit=1 the old threshold of FREE_SESSIONS_PER_MONTH - 1 = 0 would
  // always fire (even before any session), so we use the limit itself.
  const nudgeThreshold = FREE_SESSIONS_PER_MONTH > 1
    ? FREE_SESSIONS_PER_MONTH - 1   // show when on last session (3/month → at 2)
    : FREE_SESSIONS_PER_MONTH       // show only when limit reached (1/month → at 1)

  const showUpgradeNudge = isAuthenticated &&
    subStatus &&
    subStatus.planTier === 'free' &&
    (subStatus.sessionsThisMonth ?? 0) >= nudgeThreshold

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />
      <div className="session-outer-pad px-6 py-5 max-w-xl mx-auto animate-fade-in">
        {/* AFFIRMATION MOMENT 5 — frozen copy */}
        <div className="affirm-copy mb-3">
          You do not need to resolve anything today.<br />
          One small thing is enough.
        </div>

        <h2 className="font-serif font-light text-sand2 text-2xl mb-1.5 leading-tight">
          Bringing it <em className="text-gold2">together.</em>
        </h2>
        <p className="text-sm text-mist mb-4">A short recap before you go.</p>

        {/* ── What you're carrying — echoes the Mirror, no new generation ─── */}
        {carrying && (
          <div
            className="rounded-xl p-4 mb-3 animate-fade-in"
            style={{
              border: '1px solid rgba(201,168,76,.12)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <IconBadge background="rgba(201,168,76,.1)">
                <CarryingIcon color="var(--gold)" />
              </IconBadge>
              <div className="text-[11px] tracking-[.1em] uppercase" style={{ color: 'var(--gold)' }}>
                What you&apos;re carrying
              </div>
            </div>
            <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '15px', lineHeight: '1.8' }}>
              {carrying}
            </p>
          </div>
        )}

        {/* ── Reframe card — what seems to matter most ─────────────────────── */}
        {reframe && (
          <div
            className="rounded-xl p-4 mb-5 animate-fade-in"
            style={{
              background: 'rgba(42,140,122,.05)',
              border: '1px solid rgba(42,140,122,.15)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <IconBadge background="rgba(61,175,150,.1)">
                <MattersIcon color="var(--teal2)" />
              </IconBadge>
              <div className="text-[11px] tracking-[.1em] uppercase" style={{ color: 'rgba(42,140,122,.7)' }}>
                What seems to matter most
              </div>
            </div>
            <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '15px', lineHeight: '1.8' }}>
              {reframe}
            </p>
          </div>
        )}

        {/* ── One thing to consider this week ───────────────────────────────── */}
        {considerThisWeek && (
          <div
            className="rounded-xl p-4 mb-5 animate-fade-in"
            style={{
              border: '1px solid rgba(201,168,76,.12)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <IconBadge background="rgba(201,168,76,.1)">
                <ConsiderWeekIcon color="var(--gold)" />
              </IconBadge>
              <div className="text-[11px] tracking-[.1em] uppercase" style={{ color: 'var(--gold)' }}>
                One thing to consider this week
              </div>
            </div>
            <p className="font-serif text-sand leading-relaxed" style={{ fontSize: '15px', lineHeight: '1.8' }}>
              {considerThisWeek}
            </p>
          </div>
        )}

        {/* ── One action for today ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-2">
          <IconBadge background="rgba(201,168,76,.1)" size={22}>
            <TodayIcon color="var(--gold)" />
          </IconBadge>
          <div className="text-[11px] tracking-[.1em] uppercase" style={{ color: 'var(--gold)' }}>
            One action for today
          </div>
        </div>
        <p className="text-sm text-mist mb-3">No prescription. This is entirely yours.</p>

        <div className="mb-5">
          {NEXT_STEPS.slice(0, 6).map((step, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full text-left flex items-start gap-2.5 rounded-xl px-4 py-3.5 mb-2 text-sm leading-relaxed cursor-pointer transition-all ${
                selected === i ? 'text-gold2' : 'text-sand'
              }`}
              style={{
                border: selected === i ? '1px solid rgba(201,168,76,.45)' : '1px solid rgba(201,168,76,.1)',
                background: selected === i ? 'rgba(201,168,76,.06)' : 'transparent',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: selected === i ? 'var(--gold)' : 'rgba(201,168,76,.25)' }}
              />
              {step}
            </button>
          ))}

          {/* Custom field — write your own */}
          <div
            className="rounded-xl px-4 py-3.5 mb-2 transition-colors"
            style={{
              border: custom ? '1px solid rgba(201,168,76,.3)' : '1px dashed rgba(201,168,76,.18)',
              background: custom ? 'rgba(201,168,76,.03)' : 'transparent',
            }}
          >
            <div className="text-[11px] tracking-[.1em] uppercase mb-1.5" style={{ color: 'rgba(213,226,235,.65)' }}>
              Or write your own
            </div>
            <input
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="What would actually feel right for you today?"
              className="w-full bg-transparent text-sm text-sand2 placeholder:text-mist/80 focus:outline-none"
            />
          </div>
        </div>

        {/* Growth Map micro-moment — appears after 2+ past completed sessions */}
        {patternInsight && (
          <div
            className="rounded-xl px-4 py-3 mb-4 animate-fade-in"
            style={{
              background: 'rgba(201,168,76,.04)',
              border: '1px solid rgba(201,168,76,.12)',
            }}
          >
            <p className="font-serif text-sm leading-relaxed" style={{ color: 'rgba(232,201,122,.8)' }}>
              {patternInsight}
            </p>
          </div>
        )}

        <button
          onClick={handleDone}
          disabled={done}
          className="btn-primary w-full py-3.5 disabled:opacity-50"
        >
          {done ? 'Saving…' : "I'm done for now →"}
        </button>

        {/* ── Continuity line — the thread that connects sessions ── */}
        <p
          className="text-center font-serif mt-5 mb-1 leading-relaxed text-sm"
          style={{ color: 'rgba(213,226,235,.8)' }}
        >
          Come back in a few days.<br />
          Your season may already be shifting.
        </p>

        {/* Upgrade nudge — only for authenticated free users near their limit */}
        {showUpgradeNudge && (
          <div
            className="mt-5 rounded-xl p-4"
            style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.15)' }}
          >
            <div className="text-[8px] tracking-[.13em] uppercase text-gold mb-1.5">Upgrade</div>
            <p className="text-xs text-sand leading-relaxed mb-3">
              {(subStatus?.sessionsThisMonth ?? 0) >= FREE_SESSIONS_PER_MONTH
                ? FREE_SESSIONS_PER_MONTH === 1
                  ? "You've used your free session this month."
                  : "You've used all your free sessions this month."
                : `You have ${FREE_SESSIONS_PER_MONTH - (subStatus?.sessionsThisMonth ?? 0)} free session${FREE_SESSIONS_PER_MONTH - (subStatus?.sessionsThisMonth ?? 0) === 1 ? '' : 's'} left this month.`}
              {' '}Unlimited sessions from $9.99/month.
            </p>
            <Link href="/pricing" className="btn-primary text-xs py-2 px-4 inline-block">
              See plans →
            </Link>
          </div>
        )}

        {/* Sign-up nudge — only for definitively unauthenticated users */}
        {isAuthenticated === false && (
          <div
            className="mt-5 rounded-xl p-4"
            style={{ background: 'rgba(15,30,46,.7)', border: '1px solid rgba(245,237,216,.06)' }}
          >
            <div className="text-[8px] tracking-[.13em] uppercase text-mist mb-1.5">Save your sessions</div>
            <p className="text-xs text-mist leading-relaxed mb-3">
              Create a free account to save this session and track your return over time.
            </p>
            {/* Use a button — not a Link — so we can snapshot the session to
                localStorage BEFORE navigating. Magic-link emails open in a new
                tab, which destroys sessionStorage. localStorage survives. The
                auth/callback page reads ss_pending_session and calls the
                /api/sessions/recover endpoint to retroactively save the row. */}
            <button
              onClick={() => {
                try {
                  const mirror = sessionStorage.getItem('ss_mirror')
                  if (mirror) {
                    localStorage.setItem('ss_pending_session', JSON.stringify({
                      branch:       sessionStorage.getItem('ss_branch') ?? 'A',
                      situation:    sessionStorage.getItem('ss_situation') ?? undefined,
                      emotions:     sessionStorage.getItem('ss_emotions') ?? '[]',
                      intensity:    sessionStorage.getItem('ss_intensity') ?? '5',
                      contextText:  sessionStorage.getItem('ss_context') ?? '',
                      mirrorOutput: mirror,
                      resonanceTap: sessionStorage.getItem('ss_resonance'),
                      savedAt:      Date.now(),
                    }))
                  }
                } catch { /* non-fatal — if localStorage is blocked, session is lost */ }
                // /auth/register collects first name, last name, DOB, phone + email
                // before sending the magic link. Profile is stored in ss_pending_profile
                // and saved by auth/callback after the magic link is clicked.
                router.push('/auth/register')
              }}
              className="btn-outline text-xs py-2 px-4"
            >
              Create free account →
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
