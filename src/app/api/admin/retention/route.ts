import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClientSafe, AdminEnv } from '@/lib/admin/db'
import { getDefaultAdminEnv } from '@/lib/admin/env'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const env = (req.nextUrl.searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const _result = getAdminClientSafe(env)
  if (!_result.ok) return NextResponse.json({ error: _result.error, not_configured: true }, { status: 503 })
  const { db } = _result

  const now = Date.now()
  const start90d = new Date(now - 90 * 24 * 60 * 60 * 1000)
  const start30d = new Date(now - 30 * 24 * 60 * 60 * 1000)
  const start7d  = new Date(now - 7  * 24 * 60 * 60 * 1000)
  const start1d  = new Date(now - 1  * 24 * 60 * 60 * 1000)

  const [
    // All sessions with user and date (last 90d)
    { data: allSessions },
    // All users with created_at
    { data: allUsers },
    // Daily session counts (last 30d) for DAU chart
    { data: dailySessionsRaw },
    // Resonance tap data for returning vs. new
    { data: resonanceReturning },
    { data: resonanceNew },
    // Avg sessions per user distribution
    { data: sessionCountsRaw },
  ] = await Promise.all([
    db.from('sessions')
      .select('user_id, created_at, completed_at, resonance_tap')
      .gte('created_at', start90d.toISOString())
      .order('created_at', { ascending: true }),

    db.from('users')
      .select('id, created_at, plan_tier')
      .order('created_at', { ascending: true }),

    db.from('sessions')
      .select('created_at, user_id')
      .gte('created_at', start30d.toISOString())
      .order('created_at', { ascending: true }),

    // Resonance for users who have 2+ sessions (returning)
    db.from('sessions')
      .select('resonance_tap, user_id')
      .not('resonance_tap', 'is', null)
      .gte('created_at', start90d.toISOString()),

    // Resonance for first session of each user
    db.from('sessions')
      .select('resonance_tap, user_id, created_at')
      .not('resonance_tap', 'is', null),

    // Sessions per user (for distribution)
    db.from('sessions')
      .select('user_id'),
  ])

  // ── Returning user rate ────────────────────────────────────────────────────
  // A "returning" user has > 1 session in the last 90 days
  const userSessionMap: Record<string, string[]> = {}
  for (const s of allSessions ?? []) {
    if (!userSessionMap[s.user_id]) userSessionMap[s.user_id] = []
    userSessionMap[s.user_id].push(s.created_at)
  }
  const usersWithSessions = Object.keys(userSessionMap).length
  const returningUsers = Object.values(userSessionMap).filter(dates => dates.length > 1).length
  const returningRate = usersWithSessions > 0
    ? Math.round((returningUsers / usersWithSessions) * 100)
    : 0

  // ── Active users (DAU / WAU / MAU) ────────────────────────────────────────
  const uniqueUsers1d  = new Set((allSessions ?? []).filter(s => new Date(s.created_at) >= start1d).map(s => s.user_id)).size
  const uniqueUsers7d  = new Set((allSessions ?? []).filter(s => new Date(s.created_at) >= start7d).map(s => s.user_id)).size
  const uniqueUsers30d = new Set((allSessions ?? []).filter(s => new Date(s.created_at) >= start30d).map(s => s.user_id)).size

  // ── Avg sessions per user ─────────────────────────────────────────────────
  const sessionCountByUser: Record<string, number> = {}
  for (const s of sessionCountsRaw ?? []) {
    sessionCountByUser[s.user_id] = (sessionCountByUser[s.user_id] ?? 0) + 1
  }
  const sessionCounts = Object.values(sessionCountByUser)
  const avgSessionsPerUser = sessionCounts.length > 0
    ? Math.round((sessionCounts.reduce((a, b) => a + b, 0) / sessionCounts.length) * 10) / 10
    : 0

  // Distribution: 1 session, 2-3, 4-5, 6-10, 10+
  const sessionDist = [
    { label: '1 session',   count: sessionCounts.filter(n => n === 1).length },
    { label: '2–3',         count: sessionCounts.filter(n => n >= 2 && n <= 3).length },
    { label: '4–5',         count: sessionCounts.filter(n => n >= 4 && n <= 5).length },
    { label: '6–10',        count: sessionCounts.filter(n => n >= 6 && n <= 10).length },
    { label: '10+',         count: sessionCounts.filter(n => n > 10).length },
  ]

  // ── Daily active users last 30d ───────────────────────────────────────────
  const dauMap: Record<string, Set<string>> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(start30d.getTime() + i * 24 * 60 * 60 * 1000)
    dauMap[d.toISOString().slice(0, 10)] = new Set()
  }
  for (const s of dailySessionsRaw ?? []) {
    const key = s.created_at.slice(0, 10)
    if (dauMap[key]) dauMap[key].add(s.user_id)
  }
  const dailyActiveUsers = Object.entries(dauMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, users]) => ({ date, count: users.size }))

  // ── Weekly cohort retention (last 8 weeks) ─────────────────────────────────
  // For each signup cohort week, what % came back the following week?
  const cohorts: Array<{
    week: string
    cohortSize: number
    returnedWeek1: number
    returnedWeek2: number
    week1Rate: number | null
    week2Rate: number | null
  }> = []

  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(now - (w + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd   = new Date(now - w * 7 * 24 * 60 * 60 * 1000)
    const week1Start = weekEnd
    const week1End   = new Date(weekEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
    const week2End   = new Date(weekEnd.getTime() + 14 * 24 * 60 * 60 * 1000)

    // Users who signed up in this cohort week
    const cohortUsers = new Set(
      (allUsers ?? [])
        .filter(u => {
          const t = new Date(u.created_at).getTime()
          return t >= weekStart.getTime() && t < weekEnd.getTime()
        })
        .map(u => u.id)
    )

    if (cohortUsers.size === 0) {
      cohorts.push({
        week: weekStart.toISOString().slice(0, 10),
        cohortSize: 0,
        returnedWeek1: 0,
        returnedWeek2: 0,
        week1Rate: null,
        week2Rate: null,
      })
      continue
    }

    // Which of those users had a session in week 1 post-signup?
    const returnedW1 = new Set(
      (allSessions ?? [])
        .filter(s => {
          const t = new Date(s.created_at).getTime()
          return cohortUsers.has(s.user_id) &&
            t >= week1Start.getTime() && t < week1End.getTime()
        })
        .map(s => s.user_id)
    )

    const returnedW2 = new Set(
      (allSessions ?? [])
        .filter(s => {
          const t = new Date(s.created_at).getTime()
          return cohortUsers.has(s.user_id) &&
            t >= week1End.getTime() && t < week2End.getTime()
        })
        .map(s => s.user_id)
    )

    cohorts.push({
      week: weekStart.toISOString().slice(0, 10),
      cohortSize: cohortUsers.size,
      returnedWeek1: returnedW1.size,
      returnedWeek2: returnedW2.size,
      week1Rate: Math.round((returnedW1.size / cohortUsers.size) * 100),
      week2Rate: w > 1 ? Math.round((returnedW2.size / cohortUsers.size) * 100) : null,
    })
  }

  // ── Resonance by user type (returning vs. new) ────────────────────────────
  // Count sessions per user to identify returning users
  const firstSessionByUser: Record<string, string> = {}
  for (const s of (resonanceNew ?? []).sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )) {
    if (!firstSessionByUser[s.user_id]) firstSessionByUser[s.user_id] = s.created_at
  }

  let returningAccurate = 0, returningTotal = 0
  let newAccurate = 0, newTotal = 0
  for (const s of resonanceReturning ?? []) {
    const isFirst = firstSessionByUser[s.user_id] !== undefined &&
      // If this user only has 1 tracked session they're "new"
      (resonanceReturning ?? []).filter(x => x.user_id === s.user_id).length === 1
    if (isFirst) {
      newTotal++
      if (s.resonance_tap === 'accurate') newAccurate++
    } else {
      returningTotal++
      if (s.resonance_tap === 'accurate') returningAccurate++
    }
  }

  return NextResponse.json({
    activeUsers: {
      dau: uniqueUsers1d,
      wau: uniqueUsers7d,
      mau: uniqueUsers30d,
      stickinessWAU: uniqueUsers30d > 0 ? Math.round((uniqueUsers7d / uniqueUsers30d) * 100) : null,
    },
    retention: {
      returningUsers,
      usersWithSessions,
      returningRate,
      avgSessionsPerUser,
      sessionDistribution: sessionDist,
    },
    dailyActiveUsers,
    cohorts,
    resonanceByUserType: {
      returning: {
        total: returningTotal,
        accurate: returningAccurate,
        rate: returningTotal > 0 ? Math.round((returningAccurate / returningTotal) * 100) : null,
      },
      new: {
        total: newTotal,
        accurate: newAccurate,
        rate: newTotal > 0 ? Math.round((newAccurate / newTotal) * 100) : null,
      },
    },
  })
}
