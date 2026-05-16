import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClient, AdminEnv } from '@/lib/admin/db'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const env = (params.get('env') ?? 'dev') as AdminEnv
  const days = parseInt(params.get('days') ?? '30', 10)
  const db = getAdminClient(env)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Pull all sessions with resonance data in window
  const { data: sessions, error } = await db
    .from('sessions')
    .select('branch, resonance_tap, intensity, season_assigned, created_at')
    .not('resonance_tap', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = sessions ?? []

  // Overall accuracy
  const accurate = rows.filter(r => r.resonance_tap === 'accurate').length
  const total = rows.length
  const overallRate = total > 0 ? Math.round((accurate / total) * 100) : null

  // Per-branch breakdown
  const byBranch: Record<string, { accurate: number; total: number; rate: number | null }> = {}
  for (const r of rows) {
    const b = r.branch ?? 'unknown'
    if (!byBranch[b]) byBranch[b] = { accurate: 0, total: 0, rate: null }
    byBranch[b].total++
    if (r.resonance_tap === 'accurate') byBranch[b].accurate++
  }
  for (const b of Object.keys(byBranch)) {
    const bv = byBranch[b]
    bv.rate = bv.total > 0 ? Math.round((bv.accurate / bv.total) * 100) : null
  }

  // Per-season breakdown
  const bySeason: Record<string, { accurate: number; total: number; rate: number | null }> = {}
  for (const r of rows) {
    const s = r.season_assigned ?? 'unknown'
    if (!bySeason[s]) bySeason[s] = { accurate: 0, total: 0, rate: null }
    bySeason[s].total++
    if (r.resonance_tap === 'accurate') bySeason[s].accurate++
  }
  for (const s of Object.keys(bySeason)) {
    const sv = bySeason[s]
    sv.rate = sv.total > 0 ? Math.round((sv.accurate / sv.total) * 100) : null
  }

  // Daily trend (group by date)
  const dailyMap: Record<string, { accurate: number; total: number }> = {}
  for (const r of rows) {
    const date = r.created_at.slice(0, 10)
    if (!dailyMap[date]) dailyMap[date] = { accurate: 0, total: 0 }
    dailyMap[date].total++
    if (r.resonance_tap === 'accurate') dailyMap[date].accurate++
  }
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      rate: v.total > 0 ? Math.round((v.accurate / v.total) * 100) : null,
      total: v.total,
    }))

  // Intensity correlation
  const byIntensity: Record<number, { accurate: number; total: number }> = {}
  for (const r of rows) {
    if (r.intensity == null) continue
    if (!byIntensity[r.intensity]) byIntensity[r.intensity] = { accurate: 0, total: 0 }
    byIntensity[r.intensity].total++
    if (r.resonance_tap === 'accurate') byIntensity[r.intensity].accurate++
  }

  return NextResponse.json({
    overall: { rate: overallRate, accurate, total, targetMet: overallRate !== null ? overallRate >= 60 : null },
    byBranch,
    bySeason,
    daily,
    byIntensity,
    windowDays: days,
  })
}
