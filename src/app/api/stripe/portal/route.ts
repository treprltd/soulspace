import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const { data: userData } = await serviceClient
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!userData?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const origin = req.headers.get('origin') ?? `https://${req.headers.get('host')}`

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: `${origin}/settings`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('Stripe portal error:', detail)
    return NextResponse.json({ error: 'Failed to create portal session', detail }, { status: 500 })
  }
}
