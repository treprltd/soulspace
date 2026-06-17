import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClientSafe, AdminEnv } from '@/lib/admin/db'
import { getDefaultAdminEnv } from '@/lib/admin/env'

const ESSENTIALS_PRICE = 9.99
const INSIGHTS_PRICE = 19.99

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const env = (req.nextUrl.searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const _result = getAdminClientSafe(env)
  if (!_result.ok) return NextResponse.json({ error: _result.error, not_configured: true }, { status: 503 })
  const { db } = _result

  const startOfWindow = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const start30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const start7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    { data: activeSubs },
    { data: newSubsInWindow },
    { count: totalUsers },
    { count: paidUsers },
    { data: recentSubs },
    { data: dailySubsRaw },
  ] = await Promise.all([
    // All active subscriptions
    db.from('subscriptions')
      .select('plan_tier, status, cancel_at_period_end, created_at, current_period_end')
      .eq('status', 'active'),

    // New subscriptions in selected window
    db.from('subscriptions')
      .select('plan_tier, created_at')
      .gte('created_at', startOfWindow.toISOString()),

    // Total users
    db.from('users').select('*', { count: 'exact', head: true }),

    // Paid users (non-free)
    db.from('users')
      .select('*', { count: 'exact', head: true })
      .in('plan_tier', ['essentials', 'insights']),

    // Recent subscriptions (last 20) for the table
    db.from('subscriptions')
      .select('id, plan_tier, status, cancel_at_period_end, created_at, current_period_end, stripe_customer_id')
      .order('created_at', { ascending: false })
      .limit(20),

    // Daily new subscriptions (last 30d) for sparkline
    db.from('subscriptions')
      .select('created_at, plan_tier')
      .gte('created_at', start30d.toISOString())
      .order('created_at', { ascending: true }),
  ])

  // ── MRR calculation ──────────────────────────────────────────────────────────
  const activeEssentials = (activeSubs ?? []).filter(s => s.plan_tier === 'essentials').length
  const activeInsights   = (activeSubs ?? []).filter(s => s.plan_tier === 'insights').length
  const mrr = activeEssentials * ESSENTIALS_PRICE + activeInsights * INSIGHTS_PRICE
  const arr = mrr * 12

  // ── Churn / cancelling ───────────────────────────────────────────────────────
  const cancellingCount = (activeSubs ?? []).filter(s => s.cancel_at_period_end).length
  const churnRate = (activeSubs ?? []).length > 0
    ? Math.round((cancellingCount / (activeSubs ?? []).length) * 100)
    : 0

  // ── New subs in window ───────────────────────────────────────────────────────
  const newEssentials = (newSubsInWindow ?? []).filter(s => s.plan_tier === 'essentials').length
  const newInsights   = (newSubsInWindow ?? []).filter(s => s.plan_tier === 'insights').length
  const newRevenue    = newEssentials * ESSENTIALS_PRICE + newInsights * INSIGHTS_PRICE

  // ── Conversion rate ──────────────────────────────────────────────────────────
  const conversionRate = (totalUsers ?? 0) > 0
    ? Math.round(((paidUsers ?? 0) / (totalUsers ?? 1)) * 100)
    : 0

  // ── Daily new subs (last 30d) ─────────────────────────────────────────────────
  const dailyMap: Record<string, { essentials: number; insights: number }> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(start30d.getTime() + i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = { essentials: 0, insights: 0 }
  }
  for (const s of dailySubsRaw ?? []) {
    const key = s.created_at.slice(0, 10)
    if (dailyMap[key]) {
      if (s.plan_tier === 'essentials') dailyMap[key].essentials++
      else if (s.plan_tier === 'insights') dailyMap[key].insights++
    }
  }
  const dailyNewSubs = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts, total: counts.essentials + counts.insights }))

  // ── 7-day new subs ───────────────────────────────────────────────────────────
  const newSubs7d = (newSubsInWindow ?? [])
    .filter(s => new Date(s.created_at) >= start7d).length

  return NextResponse.json({
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    activeSubscriptions: {
      total: (activeSubs ?? []).length,
      essentials: activeEssentials,
      insights: activeInsights,
    },
    churn: {
      cancellingCount,
      churnRate,
    },
    newInWindow: {
      days,
      total: (newSubsInWindow ?? []).length,
      essentials: newEssentials,
      insights: newInsights,
      revenue: Math.round(newRevenue * 100) / 100,
    },
    newSubs7d,
    conversion: {
      totalUsers: totalUsers ?? 0,
      paidUsers: paidUsers ?? 0,
      conversionRate,
    },
    dailyNewSubs,
    recentSubscriptions: (recentSubs ?? []).map(s => ({
      id: s.id,
      planTier: s.plan_tier,
      status: s.status,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      createdAt: s.created_at,
      currentPeriodEnd: s.current_period_end,
      customerId: s.stripe_customer_id?.slice(0, 14) + '…',
    })),
  })
}
