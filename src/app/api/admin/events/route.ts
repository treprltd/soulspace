import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClient, getAdminClientSafe, AdminEnv } from '@/lib/admin/db'
import { getDefaultAdminEnv } from '@/lib/admin/env'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const env = (params.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = 100
  const offset = (page - 1) * limit
  const eventName = params.get('event')
  const sessionId = params.get('session')
  const from = params.get('from')
  const to = params.get('to')

  const _result = getAdminClientSafe(env)
  if (!_result.ok) return NextResponse.json({ error: _result.error, not_configured: true }, { status: 503 })
  const { db } = _result

  let query = db
    .from('events')
    .select('id, session_id, user_hash, event_name, properties, timestamp', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1)

  if (eventName) query = query.eq('event_name', eventName)
  if (sessionId) query = query.eq('session_id', sessionId)
  if (from) query = query.gte('timestamp', from)
  if (to) query = query.lte('timestamp', to)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Event name breakdown (for the whole filter set, capped to page)
  const breakdown: Record<string, number> = {}
  for (const e of data ?? []) {
    breakdown[e.event_name] = (breakdown[e.event_name] ?? 0) + 1
  }

  return NextResponse.json({
    events: data ?? [],
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
    breakdown,
  })
}
