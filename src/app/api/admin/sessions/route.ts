import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClient, AdminEnv } from '@/lib/admin/db'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const env = (params.get('env') ?? 'dev') as AdminEnv
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = 50
  const offset = (page - 1) * limit
  const branch = params.get('branch') // A|B|C|D|null
  const safety = params.get('safety') // 'flagged'|null
  const from = params.get('from')
  const to = params.get('to')

  const db = getAdminClient(env)

  let query = db
    .from('sessions')
    .select('id, user_id, branch, created_at, completed_at, intensity, safety_flagged, season_assigned, resonance_tap, char_count', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (branch) query = query.eq('branch', branch)
  if (safety === 'flagged') query = query.eq('safety_flagged', true)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Compute per-branch resonance for filtered set
  const byBranch: Record<string, { total: number; accurate: number; avgIntensity: number; avgChars: number }> = {}
  for (const s of data ?? []) {
    const b = s.branch ?? 'unknown'
    if (!byBranch[b]) byBranch[b] = { total: 0, accurate: 0, avgIntensity: 0, avgChars: 0 }
    byBranch[b].total++
    if (s.resonance_tap === 'accurate') byBranch[b].accurate++
    byBranch[b].avgIntensity += s.intensity ?? 0
    byBranch[b].avgChars += s.char_count ?? 0
  }
  for (const b of Object.keys(byBranch)) {
    byBranch[b].avgIntensity = Math.round(byBranch[b].avgIntensity / byBranch[b].total * 10) / 10
    byBranch[b].avgChars = Math.round(byBranch[b].avgChars / byBranch[b].total)
  }

  return NextResponse.json({
    sessions: data ?? [],
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
    byBranch,
  })
}
