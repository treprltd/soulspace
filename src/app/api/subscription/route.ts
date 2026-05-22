import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)

    if (!user) {
      return NextResponse.json({
        planTier: 'free',
        sessionsThisMonth: null,
        limit: FREE_SESSIONS_PER_MONTH,
        authenticated: false,
      })
    }

    // Service client — user verified above; cookie client returns wrong/empty
    // data for implicit-flow users because auth.uid() is null → RLS blocks reads
    const db = createServiceClient()

    // Get user's plan tier
    const { data: userData } = await db
      .from('users')
      .select('plan_tier')
      .eq('id', user.id)
      .single()

    const planTier = userData?.plan_tier ?? 'free'

    // Count sessions this calendar month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await db
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString())

    // Get active subscription details
    const { data: subscription } = await db
      .from('subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      planTier,
      sessionsThisMonth: count ?? 0,
      limit: planTier === 'free' ? FREE_SESSIONS_PER_MONTH : null,
      authenticated: true,
      subscription: subscription ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
