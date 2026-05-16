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
  const reviewed = params.get('reviewed') // 'true'|'false'|null

  const db = getAdminClient(env)

  let query = db
    .from('safety_events')
    .select('id, session_id, flag_type, branch, action, season_suppressed, reviewed, reviewed_at, timestamp', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1)

  if (reviewed === 'false') query = query.eq('reviewed', false)
  if (reviewed === 'true')  query = query.eq('reviewed', true)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Flag type breakdown
  const flagBreakdown: Record<string, number> = {}
  for (const e of data ?? []) {
    const ft = e.flag_type ?? 'unknown'
    flagBreakdown[ft] = (flagBreakdown[ft] ?? 0) + 1
  }

  return NextResponse.json({
    events: data ?? [],
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
    flagBreakdown,
  })
}

// PATCH: mark a safety event as reviewed
export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, env } = await req.json() as { id?: string; env?: AdminEnv }
  if (!id || !env) {
    return NextResponse.json({ error: 'id and env required' }, { status: 400 })
  }

  const db = getAdminClient(env)
  const { error } = await db
    .from('safety_events')
    .update({ reviewed: true, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
