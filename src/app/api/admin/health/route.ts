import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClient, getAdminClientSafe, AdminEnv } from '@/lib/admin/db'
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
  const start24h = new Date(now - 24 * 60 * 60 * 1000)
  const start7d  = new Date(now - 7 * 24 * 60 * 60 * 1000)

  // ── DB connectivity + query timing ──────────────────────────────────────────
  let dbPingMs: number | null = null
  let dbStatus: 'ok' | 'degraded' | 'down' = 'down'
  try {
    const t0 = Date.now()
    const { error } = await db.from('users').select('id').limit(1)
    dbPingMs = Date.now() - t0
    dbStatus = error ? 'degraded' : dbPingMs > 2000 ? 'degraded' : 'ok'
  } catch {
    dbStatus = 'down'
  }

  // ── Mirror response times (last 500 events) ──────────────────────────────────
  const [
    { data: mirrorEvents },
    { data: mirrorEvents24h },
    { count: sessions24h },
    { count: sessions7d },
    { count: safetyFlags24h },
    { count: safetyFlagsTotal },
    { count: completedSessions24h },
    { data: errorEvents },
    { data: hourlySessionsRaw },
    { data: lastMirrorEvent },
  ] = await Promise.all([
    db.from('events')
      .select('properties, timestamp')
      .eq('event_name', 'mirror_rendered')
      .order('timestamp', { ascending: false })
      .limit(500),

    db.from('events')
      .select('properties')
      .eq('event_name', 'mirror_rendered')
      .gte('timestamp', start24h.toISOString()),

    db.from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start24h.toISOString()),

    db.from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start7d.toISOString()),

    db.from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('safety_flagged', true)
      .gte('created_at', start24h.toISOString()),

    db.from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('safety_flagged', true),

    db.from('sessions')
      .select('*', { count: 'exact', head: true })
      .not('completed_at', 'is', null)
      .gte('created_at', start24h.toISOString()),

    db.from('events')
      .select('event_name, timestamp, properties')
      .eq('event_name', 'error')
      .gte('timestamp', start24h.toISOString())
      .order('timestamp', { ascending: false })
      .limit(50),

    // Hourly sessions last 24h
    db.from('sessions')
      .select('created_at')
      .gte('created_at', start24h.toISOString())
      .order('created_at', { ascending: true }),

    db.from('events')
      .select('timestamp')
      .eq('event_name', 'mirror_rendered')
      .order('timestamp', { ascending: false })
      .limit(1),
  ])

  // ── Mirror response time stats ───────────────────────────────────────────────
  function computeStats(events: Array<{ properties: unknown }>) {
    const times: number[] = []
    for (const ev of events ?? []) {
      const ms = (ev.properties as Record<string, unknown>)?.response_ms
      if (typeof ms === 'number' && ms > 0 && ms < 120000) times.push(ms)
    }
    if (times.length === 0) return { avg: null, p50: null, p95: null, p99: null, count: 0 }
    times.sort((a, b) => a - b)
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    const p50 = times[Math.floor(times.length * 0.50)]
    const p95 = times[Math.floor(times.length * 0.95)]
    const p99 = times[Math.floor(times.length * 0.99)]
    return { avg, p50, p95, p99, count: times.length }
  }

  const mirrorStats     = computeStats(mirrorEvents ?? [])
  const mirrorStats24h  = computeStats(mirrorEvents24h ?? [])

  // ── Hourly session distribution (last 24h) ────────────────────────────────────
  const hourlyBuckets: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hourlyBuckets[h] = 0
  for (const s of hourlySessionsRaw ?? []) {
    const h = new Date(s.created_at).getUTCHours()
    hourlyBuckets[h] = (hourlyBuckets[h] ?? 0) + 1
  }
  const hourlySessions = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourlyBuckets[h],
  }))

  // ── Completion rate 24h ───────────────────────────────────────────────────────
  const completionRate24h = (sessions24h ?? 0) > 0
    ? Math.round(((completedSessions24h ?? 0) / (sessions24h ?? 1)) * 100)
    : null

  // ── Safety flag rate ──────────────────────────────────────────────────────────
  const safetyFlagRate24h = (sessions24h ?? 0) > 0
    ? Math.round(((safetyFlags24h ?? 0) / (sessions24h ?? 1)) * 100)
    : 0

  // ── Overall system status ─────────────────────────────────────────────────────
  const mirrorStatus: 'ok' | 'degraded' | 'down' =
    mirrorStats24h.p95 === null ? 'ok' :
    mirrorStats24h.p95 > 15000 ? 'degraded' :
    mirrorStats24h.p95 > 8000  ? 'degraded' : 'ok'

  const overallStatus: 'ok' | 'degraded' | 'down' =
    dbStatus === 'down' ? 'down' :
    dbStatus === 'degraded' || mirrorStatus === 'degraded' ? 'degraded' : 'ok'

  return NextResponse.json({
    overallStatus,
    checkedAt: new Date().toISOString(),
    db: {
      status: dbStatus,
      pingMs: dbPingMs,
    },
    mirror: {
      status: mirrorStatus,
      lastEventAt: lastMirrorEvent?.[0]?.timestamp ?? null,
      allTime: mirrorStats,
      last24h: mirrorStats24h,
    },
    sessions: {
      last24h: sessions24h ?? 0,
      last7d: sessions7d ?? 0,
      completedLast24h: completedSessions24h ?? 0,
      completionRate24h,
      hourlySessions,
    },
    safety: {
      flagsLast24h: safetyFlags24h ?? 0,
      flagRateLast24h: safetyFlagRate24h,
      totalFlagsAllTime: safetyFlagsTotal ?? 0,
    },
    errors: {
      last24hCount: (errorEvents ?? []).length,
      recent: (errorEvents ?? []).slice(0, 10).map(e => ({
        timestamp: e.timestamp,
        detail: (e.properties as Record<string, unknown>)?.message ?? 'unknown',
      })),
    },
  })
}
