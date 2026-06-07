import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { patternCardCopy, PATTERN_CARD_FALLBACK } from '@/lib/copy/patterns'

// Mirrors the SITUATION_LABELS map in dashboard/page.tsx and session/next-step —
// kept in sync manually since it's small and stable (situation ids come from
// a fixed enum set in the Context screen).
const SITUATION_LABELS: Record<string, string> = {
  'work-career':  'work or career',
  'relationship': 'relationships',
  'family':       'family',
  'money':        'money',
  'big-decision': 'a big decision',
  'my-health':    'your health',
  'who-i-am':     'who you are',
  'loss-grief':   'loss or grief',
  'anxiety':      'anxiety',
  'life-change':  'a life change',
  'friendship':   'friendship',
  'not-sure':     'something undefined',
}

const LOOKBACK_LIMIT = 8        // how many recent completed sessions to consider
const MIN_SESSIONS   = 3        // need at least this many before showing anything
const MIN_RECURRENCE = 2        // a situation must show up at least this often to be "a pattern"

export interface PatternsResponse {
  available: boolean
  insight:   string | null
  label:     string | null
  sessionsConsidered: number
}

// ── GET /api/user/patterns ────────────────────────────────────────────────────
//
// Returns a single, gentle, non-diagnostic observation about what's been
// recurring across the user's recent sessions — the "what you've been
// carrying" surface named repeatedly in user research as the reason people
// say they'd return (CLAUDE.md-adjacent: same crisis-gate and non-diagnostic-
// language rules as memory).
//
// Crisis gate: safety-flagged sessions are excluded entirely from the
// aggregation — the same hard rule that suppresses Season and memory notes
// for those sessions (CLAUDE.md rule #5). A flagged session never contributes
// to, nor is counted toward, a pattern.
//
// This is intentionally server-side and read-only/aggregate-only: it never
// returns free text from any single session, only a categorical rollup
// (situation recurrence) translated through the same human-readable label
// map used elsewhere in the product. No new encrypted storage is introduced —
// this reads fields the Mirror pipeline already writes.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) return NextResponse.json({ available: false, insight: null, label: null, sessionsConsidered: 0 })

    const db = createServiceClient()

    const { data: sessions } = await db
      .from('sessions')
      .select('situation, completed_at')
      .eq('user_id', user.id)
      .eq('safety_flagged', false)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(LOOKBACK_LIMIT)

    const completed = sessions ?? []

    if (completed.length < MIN_SESSIONS) {
      return NextResponse.json({
        available: false, insight: null, label: null, sessionsConsidered: completed.length,
      } satisfies PatternsResponse)
    }

    // Tally situation recurrence (only sessions with a stored situation count)
    const counts: Record<string, number> = {}
    for (const s of completed) {
      if (s.situation) counts[s.situation] = (counts[s.situation] ?? 0) + 1
    }

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const top = ranked[0]

    if (top && top[1] >= MIN_RECURRENCE) {
      const label = SITUATION_LABELS[top[0]] ?? top[0]
      return NextResponse.json({
        available: true,
        insight:   patternCardCopy(label, top[1], completed.length),
        label,
        sessionsConsidered: completed.length,
      } satisfies PatternsResponse)
    }

    // Enough history, nothing recurs clearly — show the fallback rather than
    // nothing, so the surface doesn't feel broken or inconsistent.
    return NextResponse.json({
      available: true,
      insight:   PATTERN_CARD_FALLBACK,
      label:     null,
      sessionsConsidered: completed.length,
    } satisfies PatternsResponse)
  } catch {
    // This is an enhancement, never a blocker — fail closed and silent,
    // same contract as /api/user/memory-greeting.
    return NextResponse.json({ available: false, insight: null, label: null, sessionsConsidered: 0 })
  }
}
