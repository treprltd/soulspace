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
    // Funnel — 4 key steps over the last 7 days (unique sessions per step)
    { data: funnelEvents },
    // System health — most recent session + mirror response times
    { data: lastSessionRow },
    { data: mirrorPerfRows },
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
    db.from('events')
      .select('event_name, session_id')
      .in('event_name', ['session_start', 'branch_selected', 'mirror_rendered', 'session_complete'])
      .gte('timestamp', startOf7Days.toISOString()),
    db.from('sessions')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1),
    db.from('events')
      .select('properties')
      .eq('event_name', 'mirror_rendered')
      .order('timestamp', { ascending: false })
      .limit(100),
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

  // ── 7-day session funnel ──────────────────────────────────────────────────
  const funnelSteps = ['session_start', 'branch_selected', 'mirror_rendered', 'session_complete'] as const
  const funnelSets: Record<string, Set<string>> = {}
  for (const step of funnelSteps) funnelSets[step] = new Set()
  for (const ev of funnelEvents ?? []) {
    if (ev.session_id && funnelSets[ev.event_name]) {
      funnelSets[ev.event_name].add(ev.session_id)
    }
  }
  const funnel = {
    sessionStart:    funnelSets['session_start'].size,
    branchSelected:  funnelSets['branch_selected'].size,
    mirrorRendered:  funnelSets['mirror_rendered'].size,
    sessionComplete: funnelSets['session_complete'].size,
    window: '7d',
  }

  // ── System health ─────────────────────────────────────────────────────────
  const lastSessionAt = lastSessionRow?.[0]?.created_at ?? null

  const responseTimes: number[] = []
  for (const ev of mirrorPerfRows ?? []) {
    const ms = (ev.properties as Record<string, unknown>)?.response_ms
    if (typeof ms === 'number' && ms > 0 && ms < 60000) responseTimes.push(ms)
  }
  const avgMirrorMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
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
    funnel,
    system: {
      lastSessionAt,
      avgMirrorMs,
      mirrorSampleSize: responseTimes.length,
    },
  })
}
