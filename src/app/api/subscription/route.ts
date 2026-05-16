import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Implicit-flow clients pass the JWT via Authorization header
    const authHeader = req.headers.get('authorization')
    let user = null
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(authHeader.slice(7))
      user = data.user
    }
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({
        planTier: 'free',
        sessionsThisMonth: null,
        limit: FREE_SESSIONS_PER_MONTH,
        authenticated: false,
      })
    }

    // Get user's plan tier
    const { data: userData } = await supabase
      .from('users')
      .select('plan_tier')
      .eq('id', user.id)
      .single()

    const planTier = userData?.plan_tier ?? 'free'

    // Count sessions this calendar month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString())

    // Get active subscription details
    const { data: subscription } = await supabase
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
