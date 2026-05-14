import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClient, AdminEnv } from '@/lib/admin/db'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const env = (req.nextUrl.searchParams.get('env') ?? 'dev') as AdminEnv
  const db = getAdminClient(env)

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    { count: totalUsers },
    { count: newUsersToday },
    { count: newUsers7d },
    { count: totalSessions },
    { count: sessionsToday },
    { count: sessions7d },
    { count: completedSessions },
    { count: safetyTotal },
    { count: safetyUnreviewed },
    { data: resonanceData },
    { data: planData },
    { data: branchData },
  ] = await Promise.all([
    db.from('users').select('*', { count: 'exact', head: true }),
    db.from('users').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday.toISOString()),
    db.from('users').select('*', { count: 'exact', head: true }).gte('created_at', startOf7Days.toISOString()),
    db.from('sessions').select('*', { count: 'exact', head: true }),
    db.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday.toISOString()),
    db.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', startOf7Days.toISOString()),
    db.from('sessions').select('*', { count: 'exact', head: true }).not('completed_at', 'is', null),
    db.from('safety_events').select('*', { count: 'exact', head: true }),
    db.from('safety_events').select('*', { count: 'exact', head: true }).eq('reviewed', false),
    db.from('sessions').select('resonance_tap').not('resonance_tap', 'is', null).gte('created_at', startOf30Days.toISOString()),
    db.from('users').select('plan_tier'),
    db.from('sessions').select('branch').not('branch', 'is', null).gte('created_at', startOf30Days.toISOString()),
  ])

  // Resonance accuracy rate
  const accurate = (resonanceData ?? []).filter(r => r.resonance_tap === 'accurate').length
  const totalTapped = (resonanceData ?? []).length
  const resonanceRate = totalTapped > 0 ? Math.round((accurate / totalTapped) * 100) : null

  // Plan tier breakdown
  const planBreakdown = { free: 0, essentials: 0, insights: 0 }
  for (const u of planData ?? []) {
    if (u.plan_tier in planBreakdown) planBreakdown[u.plan_tier as keyof typeof planBreakdown]++
  }

  // Branch breakdown (last 30d)
  const branchBreakdown: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const s of branchData ?? []) {
    if (s.branch) branchBreakdown[s.branch] = (branchBreakdown[s.branch] ?? 0) + 1
  }

  const completionRate = (totalSessions ?? 0) > 0
    ? Math.round(((completedSessions ?? 0) / (totalSessions ?? 1)) * 100)
    : null

  return NextResponse.json({
    users: {
      total: totalUsers ?? 0,
      newToday: newUsersToday ?? 0,
      new7d: newUsers7d ?? 0,
      planBreakdown,
    },
    sessions: {
      total: totalSessions ?? 0,
      today: sessionsToday ?? 0,
      last7d: sessions7d ?? 0,
      completed: completedSessions ?? 0,
      completionRate,
      branchBreakdown,
    },
    mirror: {
      resonanceRate,
      accurateCount: accurate,
      totalTapped,
      targetMet: resonanceRate !== null ? resonanceRate >= 60 : null,
    },
    safety: {
      total: safetyTotal ?? 0,
      unreviewed: safetyUnreviewed ?? 0,
    },
  })
}
