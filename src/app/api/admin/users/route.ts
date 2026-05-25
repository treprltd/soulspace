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
  const plan = params.get('plan') // free|essentials|insights|null
  const search = params.get('q')   // email search

  const db = getAdminClient(env)

  let query = db
    .from('users')
    .select('id, email, first_name, last_name, phone, created_at, plan_tier, age_bracket, stripe_customer_id, profile_complete', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (plan) query = query.eq('plan_tier', plan)
  if (search) query = query.ilike('email', `%${search}%`)

  const { data: users, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch session count per user for this page
  const userIds = (users ?? []).map(u => u.id)
  let sessionCounts: Record<string, number> = {}

  if (userIds.length > 0) {
    const { data: sessionData } = await db
      .from('sessions')
      .select('user_id')
      .in('user_id', userIds)

    for (const s of sessionData ?? []) {
      sessionCounts[s.user_id] = (sessionCounts[s.user_id] ?? 0) + 1
    }
  }

  const enriched = (users ?? []).map(u => ({
    ...u,
    session_count: sessionCounts[u.id] ?? 0,
  }))

  return NextResponse.json({
    users: enriched,
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

// PATCH: update user plan tier
export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, plan_tier, env } = await req.json() as { id?: string; plan_tier?: string; env?: AdminEnv }
  if (!id || !plan_tier || !env) {
    return NextResponse.json({ error: 'id, plan_tier, env required' }, { status: 400 })
  }

  const validTiers = ['free', 'essentials', 'insights']
  if (!validTiers.includes(plan_tier)) {
    return NextResponse.json({ error: 'Invalid plan_tier' }, { status: 400 })
  }

  const db = getAdminClient(env)
  const { error } = await db
    .from('users')
    .update({ plan_tier })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
