import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClient, AdminEnv } from '@/lib/admin/db'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const env = (params.get('env') ?? 'dev') as AdminEnv
  const days = Math.min(parseInt(params.get('days') ?? '30', 10), 90)
  const db = getAdminClient(env)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // ── Parallel data fetches ─────────────────────────────────────────────────
  const [
    { data: sessionRows },
    { data: userRows },
    { data: eventRows },
    { data: intensityRows },
    { data: allUsers },
    { data: subscriptionRows },
    { data: mirrorEvents },
  ] = await Promise.all([
    // Sessions in window with timestamps, branch, season, resonance, completion
    db.from('sessions')
      .select('id, user_id, created_at, completed_at, branch, season_assigned, resonance_tap, intensity, char_count')
      .gte('created_at', since)
      .order('created_at', { ascending: true }),

    // New users in window
    db.from('users')
      .select('id, created_at, plan_tier')
      .gte('created_at', since)
      .order('created_at', { ascending: true }),

    // Events in window — for funnel
    db.from('events')
      .select('event_name, session_id, timestamp, properties')
      .gte('timestamp', since)
      .in('event_name', [
        'session_start', 'branch_selected', 'emotions_submitted',
        'intensity_submitted', 'context_submitted', 'mirror_rendered',
        'resonance_tapped', 'session_complete',
      ]),

    // Intensity distribution across all time
    db.from('sessions')
      .select('intensity')
      .not('intensity', 'is', null),

    // All users for retention calc
    db.from('users').select('id, plan_tier'),

    // Subscriptions for conversion
    db.from('subscriptions').select('user_id, plan_tier, created_at').gte('created_at', since90),

    // Mirror events with response_ms for performance
    db.from('events')
      .select('properties, timestamp')
      .eq('event_name', 'mirror_rendered')
      .gte('timestamp', since)
      .limit(500),
  ])

  const sessions = sessionRows ?? []
  const users = userRows ?? []
  const events = eventRows ?? []
  const allUsersList = allUsers ?? []
  const subs = subscriptionRows ?? []

  // ── Session funnel ────────────────────────────────────────────────────────
  const funnelSteps = [
    'session_start', 'branch_selected', 'emotions_submitted',
    'intensity_submitted', 'context_submitted', 'mirror_rendered',
    'resonance_tapped', 'session_complete',
  ]
  const funnelCounts: Record<string, number> = {}
  for (const step of funnelSteps) funnelCounts[step] = 0
  // Count unique sessions per step
  const stepSessions: Record<string, Set<string>> = {}
  for (const step of funnelSteps) stepSessions[step] = new Set()
  for (const ev of events) {
    if (ev.session_id && funnelSteps.includes(ev.event_name)) {
      stepSessions[ev.event_name].add(ev.session_id)
    }
  }
  for (const step of funnelSteps) funnelCounts[step] = stepSessions[step].size

  // ── Daily sessions (date → { total, completed }) ──────────────────────────
  const dailySessionMap: Record<string, { total: number; completed: number }> = {}
  for (const s of sessions) {
    const d = s.created_at.slice(0, 10)
    if (!dailySessionMap[d]) dailySessionMap[d] = { total: 0, completed: 0 }
    dailySessionMap[d].total++
    if (s.completed_at) dailySessionMap[d].completed++
  }
  const dailySessions = Object.entries(dailySessionMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))

  // ── Daily new users ───────────────────────────────────────────────────────
  const dailyUserMap: Record<string, number> = {}
  for (const u of users) {
    const d = u.created_at.slice(0, 10)
    dailyUserMap[d] = (dailyUserMap[d] ?? 0) + 1
  }
  const dailyUsers = Object.entries(dailyUserMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // ── Hourly distribution (0–23) ────────────────────────────────────────────
  const hourCounts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
  for (const s of sessions) {
    const h = new Date(s.created_at).getUTCHours()
    hourCounts[h].count++
  }

  // ── Day-of-week distribution (0=Sun … 6=Sat) ─────────────────────────────
  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowCounts = Array.from({ length: 7 }, (_, i) => ({ day: dowLabels[i], count: 0 }))
  for (const s of sessions) {
    const d = new Date(s.created_at).getUTCDay()
    dowCounts[d].count++
  }

  // ── Branch breakdown ──────────────────────────────────────────────────────
  const branchMap: Record<string, { total: number; accurate: number; intensity: number; chars: number }> = {}
  for (const s of sessions) {
    if (!s.branch) continue
    if (!branchMap[s.branch]) branchMap[s.branch] = { total: 0, accurate: 0, intensity: 0, chars: 0 }
    branchMap[s.branch].total++
    if (s.resonance_tap === 'accurate') branchMap[s.branch].accurate++
    branchMap[s.branch].intensity += s.intensity ?? 0
    branchMap[s.branch].chars += s.char_count ?? 0
  }
  const branchDistribution = (['A', 'B', 'C', 'D'] as const).map(b => {
    const v = branchMap[b] ?? { total: 0, accurate: 0, intensity: 0, chars: 0 }
    return {
      branch: b,
      total: v.total,
      resonanceRate: v.total > 0 ? Math.round((v.accurate / v.total) * 100) : null,
      avgIntensity: v.total > 0 ? Math.round((v.intensity / v.total) * 10) / 10 : null,
      avgChars: v.total > 0 ? Math.round(v.chars / v.total) : null,
    }
  })

  // ── Season distribution ───────────────────────────────────────────────────
  const seasonMap: Record<string, { total: number; accurate: number }> = {}
  for (const s of sessions) {
    if (!s.season_assigned) continue
    if (!seasonMap[s.season_assigned]) seasonMap[s.season_assigned] = { total: 0, accurate: 0 }
    seasonMap[s.season_assigned].total++
    if (s.resonance_tap === 'accurate') seasonMap[s.season_assigned].accurate++
  }
  const seasonDistribution = (['W', 'Sp', 'Su', 'Au'] as const).map(s => ({
    season: s,
    total: seasonMap[s]?.total ?? 0,
    resonanceRate: (seasonMap[s]?.total ?? 0) > 0
      ? Math.round(((seasonMap[s]?.accurate ?? 0) / seasonMap[s].total) * 100)
      : null,
  }))

  // ── Intensity histogram (1–10) ────────────────────────────────────────────
  const intensityHist = Array.from({ length: 10 }, (_, i) => ({ intensity: i + 1, count: 0 }))
  for (const r of intensityRows ?? []) {
    if (r.intensity >= 1 && r.intensity <= 10) intensityHist[r.intensity - 1].count++
  }

  // ── Retention ─────────────────────────────────────────────────────────────
  const sessionCountPerUser: Record<string, number> = {}
  for (const s of sessions) {
    sessionCountPerUser[s.user_id] = (sessionCountPerUser[s.user_id] ?? 0) + 1
  }
  const uniqueUsers = Object.keys(sessionCountPerUser).length
  const returningUsers = Object.values(sessionCountPerUser).filter(c => c > 1).length
  const returningRate = uniqueUsers > 0 ? Math.round((returningUsers / uniqueUsers) * 100) : null
  const avgSessionsPerUser = uniqueUsers > 0
    ? Math.round((sessions.length / uniqueUsers) * 10) / 10
    : null

  // ── Conversion ────────────────────────────────────────────────────────────
  const totalUsers = allUsersList.length
  const paidUsers = allUsersList.filter(u => u.plan_tier !== 'free').length
  const conversionRate = totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : null
  const planBreakdown = {
    free: allUsersList.filter(u => u.plan_tier === 'free').length,
    essentials: allUsersList.filter(u => u.plan_tier === 'essentials').length,
    insights: allUsersList.filter(u => u.plan_tier === 'insights').length,
  }
  // New paid conversions in window
  const newConversions = subs.length

  // ── Mirror response time ──────────────────────────────────────────────────
  const responseTimes: number[] = []
  for (const ev of mirrorEvents ?? []) {
    const ms = (ev.properties as Record<string, unknown>)?.response_ms
    if (typeof ms === 'number' && ms > 0 && ms < 60000) responseTimes.push(ms)
  }
  const avgResponseMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null
  const p95ResponseMs = responseTimes.length > 0
    ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
    : null

  // ── Overall resonance rate ────────────────────────────────────────────────
  const tapped = sessions.filter(s => s.resonance_tap !== null)
  const accurate = tapped.filter(s => s.resonance_tap === 'accurate')
  const resonanceRate = tapped.length > 0 ? Math.round((accurate.length / tapped.length) * 100) : null

  // ── Completion rate ───────────────────────────────────────────────────────
  const completedCount = sessions.filter(s => s.completed_at).length
  const completionRate = sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : null

  return NextResponse.json({
    windowDays: days,
    totals: {
      sessions: sessions.length,
      completedSessions: completedCount,
      completionRate,
      newUsers: users.length,
      resonanceRate,
      avgResponseMs,
      p95ResponseMs,
      returningRate,
      avgSessionsPerUser,
      conversionRate,
      newConversions,
    },
    planBreakdown,
    funnel: funnelSteps.map(step => ({ step, count: funnelCounts[step] })),
    dailySessions,
    dailyUsers,
    hourlyDistribution: hourCounts,
    dowDistribution: dowCounts,
    branchDistribution,
    seasonDistribution,
    intensityHistogram: intensityHist,
  })
}
