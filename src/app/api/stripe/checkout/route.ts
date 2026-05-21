import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { getStripe } from '@/lib/stripe'

const CheckoutSchema = z.object({
  planTier: z.enum(['essentials', 'insights']),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    // Bearer token first (implicit flow), cookie fallback (PKCE flow)
    const user = await getAuthUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Sign in required to subscribe' }, { status: 401 })
    }

    const body = await req.json()
    const { planTier } = CheckoutSchema.parse(body)

    const priceId = planTier === 'essentials'
      ? process.env.STRIPE_ESSENTIALS_PRICE_ID
      : process.env.STRIPE_INSIGHTS_PRICE_ID

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price ID for ${planTier} is not configured` },
        { status: 500 }
      )
    }

    const stripe = getStripe()
    const serviceClient = createServiceClient()

    // Get or create Stripe customer
    const { data: userData } = await serviceClient
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    let customerId = userData?.stripe_customer_id as string | undefined

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? userData?.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Persist customer ID
      await serviceClient
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Build absolute URLs from the request
    const origin = req.headers.get('origin') ?? `https://${req.headers.get('host')}`

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        supabase_user_id: user.id,
        plan_tier: planTier,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_tier: planTier,
        },
      },
      custom_text: {
        submit: {
          message: 'Your session content is encrypted end-to-end. Soul Space never reads it.',
        },
      },
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/${planTier}`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    const detail = err instanceof Error ? err.message : String(err)
    console.error('Stripe checkout error:', detail)
    return NextResponse.json({ error: 'Failed to create checkout session', detail }, { status: 500 })
  }
}
