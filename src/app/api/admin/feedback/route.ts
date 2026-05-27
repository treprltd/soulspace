import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClientSafe, AdminEnv } from '@/lib/admin/db'
import { getDefaultAdminEnv } from '@/lib/admin/env'

// ── GET /api/admin/feedback ───────────────────────────────────────────────────
// Returns all beta feedback submissions, paginated, with aggregate stats.
// Supports ?rating=1-5 and ?recommend=<enum> filters.
// Requires admin cookie auth.

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params    = req.nextUrl.searchParams
  const env       = (params.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const page      = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const rating    = params.get('rating')    // '1'–'5' or null
  const recommend = params.get('recommend') // would_recommend enum or null
  const limit     = 50
  const offset    = (page - 1) * limit

  const _result = getAdminClientSafe(env)
  if (!_result.ok) return NextResponse.json({ error: _result.error, not_configured: true }, { status: 503 })
  const { db } = _result

  // ── Paginated data query ──────────────────────────────────────────────────
  let dataQuery = db
    .from('feedback')
    .select(
      'id, user_id, guest_email, overall_rating, use_frequency, most_valuable, ease_of_use, improvements, would_recommend, comments, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (rating)    dataQuery = dataQuery.eq('overall_rating', parseInt(rating, 10))
  if (recommend) dataQuery = dataQuery.eq('would_recommend', recommend)

  const { data, error, count } = await dataQuery

  if (error) {
    console.error('Admin feedback GET error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // ── Aggregate stats (across ALL matching rows, not just current page) ─────
  let statsQuery = db
    .from('feedback')
    .select('overall_rating, would_recommend')
  if (rating)    statsQuery = statsQuery.eq('overall_rating', parseInt(rating, 10))
  if (recommend) statsQuery = statsQuery.eq('would_recommend', recommend)

  const { data: statsRows } = await statsQuery

  const allRatings = (statsRows ?? []).map((r: { overall_rating: number | null }) => r.overall_rating).filter(Boolean) as number[]
  const avgRating  = allRatings.length
    ? Math.round((allRatings.reduce((s, r) => s + r, 0) / allRatings.length) * 10) / 10
    : null

  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of allRatings) {
    if (r >= 1 && r <= 5) ratingCounts[r] = (ratingCounts[r] ?? 0) + 1
  }

  const recommendCounts = (statsRows ?? []).reduce<Record<string, number>>((acc: Record<string, number>, r: { would_recommend: string | null }) => {
    if (r.would_recommend) acc[r.would_recommend] = (acc[r.would_recommend] ?? 0) + 1
    return acc
  }, {})

  // ── User email lookup (batch, current page only) ──────────────────────────
  // For authenticated rows look up email from users table; guests already carry guest_email.
  const userIds = Array.from(new Set(
    (data ?? [])
      .map((r: { user_id: string | null }) => r.user_id)
      .filter((id): id is string => !!id)
  ))
  const emailMap: Record<string, string | null> = {}
  if (userIds.length > 0) {
    const { data: usersData } = await db
      .from('users')
      .select('id, email')
      .in('id', userIds)
    for (const u of (usersData ?? []) as { id: string; email: string | null }[]) {
      emailMap[u.id] = u.email ?? null
    }
  }

  const feedbackWithEmails = (data ?? []).map((r: { user_id: string | null; guest_email?: string | null; [key: string]: unknown }) => ({
    ...r,
    user_email: r.user_id ? (emailMap[r.user_id] ?? null) : null,
    guest_email: r.guest_email ?? null,
  }))

  return NextResponse.json({
    feedback: feedbackWithEmails,
    total:    count ?? 0,
    page,
    pages:    Math.ceil((count ?? 0) / limit),
    stats: {
      avg_rating:       avgRating,
      total_responses:  (statsRows ?? []).length,
      rating_counts:    ratingCounts,
      recommend_counts: recommendCounts,
    },
  })
}
