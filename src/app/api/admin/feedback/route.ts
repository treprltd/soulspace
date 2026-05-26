import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClientSafe, AdminEnv } from '@/lib/admin/db'
import { getDefaultAdminEnv } from '@/lib/admin/env'

// ── GET /api/admin/feedback ───────────────────────────────────────────────────
// Returns all beta feedback submissions, paginated.
// Requires admin cookie auth.

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const env    = (params.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const page   = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit  = 50
  const offset = (page - 1) * limit

  const _result = getAdminClientSafe(env)
  if (!_result.ok) return NextResponse.json({ error: _result.error, not_configured: true }, { status: 503 })
  const { db } = _result

  const { data, error, count } = await db
    .from('feedback')
    .select(
      'id, user_id, overall_rating, use_frequency, most_valuable, ease_of_use, improvements, would_recommend, comments, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Admin feedback GET error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Aggregate quick stats
  const allRatings   = (data ?? []).map(r => r.overall_rating).filter(Boolean) as number[]
  const avgRating    = allRatings.length
    ? Math.round((allRatings.reduce((s, r) => s + r, 0) / allRatings.length) * 10) / 10
    : null
  const recommendMap = (data ?? []).reduce<Record<string, number>>((acc, r) => {
    if (r.would_recommend) acc[r.would_recommend] = (acc[r.would_recommend] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    feedback:   data ?? [],
    total:      count ?? 0,
    page,
    pages:      Math.ceil((count ?? 0) / limit),
    stats: {
      avg_rating:       avgRating,
      total_responses:  count ?? 0,
      recommend_counts: recommendMap,
    },
  })
}
