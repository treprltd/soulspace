import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import {
  sendEmail,
  subscriptionConfirmationEmail,
  subscriptionCancellationEmail,
  subscriptionExpiredEmail,
  paymentFailedEmail,
  paymentRecoveredEmail,
} from '@/lib/email'

// Must read raw body for Stripe signature verification
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Stripe webhook signature failed:', msg)
    return NextResponse.json({ error: `Webhook signature error: ${msg}` }, { status: 400 })
  }

  const db = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.supabase_user_id
        const planTier = session.metadata?.plan_tier as 'essentials' | 'insights' | undefined
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        if (!userId || !planTier || !subscriptionId) {
          console.error('checkout.session.completed: missing metadata', session.metadata)
          break
        }

        // Fetch full subscription to get period dates
        const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId)

        // Upsert subscription record
        await db.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          plan_tier: planTier,
          status: stripeSub.status,
          current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' })

        // Upgrade user plan tier
        await db.from('users').update({ plan_tier: planTier }).eq('id', userId)

        // Send subscription confirmation email (best-effort)
        try {
          const { data: userData } = await db
            .from('users')
            .select('email')
            .eq('id', userId)
            .single()
          if (userData?.email) {
            const planLabel = planTier === 'insights' ? 'Insights' : 'Essentials'
            const template = subscriptionConfirmationEmail(planLabel)
            await sendEmail({ to: userData.email, ...template })
          }
        } catch (emailErr) {
          console.error('Subscription confirmation email failed (non-fatal):', emailErr)
        }

        console.log(`Subscription activated: user=${userId} plan=${planTier}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const prevSub = event.data.previous_attributes as Partial<Stripe.Subscription> | undefined
        const userId = sub.metadata?.supabase_user_id
        const planTier = sub.metadata?.plan_tier as 'essentials' | 'insights' | undefined

        if (!userId) break

        await db.from('subscriptions').update({
          status: sub.status,
          plan_tier: planTier ?? undefined,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)

        // If subscription is active, keep plan tier updated; if not active → revert to free
        if (sub.status === 'active' && planTier) {
          await db.from('users').update({ plan_tier: planTier }).eq('id', userId)
        } else if (['canceled', 'unpaid', 'past_due'].includes(sub.status)) {
          await db.from('users').update({ plan_tier: 'free' }).eq('id', userId)
        }

        // Send cancellation email when cancel_at_period_end flips to true
        const justScheduledCancel =
          sub.cancel_at_period_end === true &&
          prevSub?.cancel_at_period_end === false
        if (justScheduledCancel) {
          try {
            const { data: userData } = await db.from('users').select('email').eq('id', userId).single()
            if (userData?.email && planTier) {
              const planLabel = planTier === 'insights' ? 'Insights' : 'Essentials'
              const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
              const template = subscriptionCancellationEmail(planLabel, periodEnd)
              await sendEmail({ to: userData.email, ...template })
            }
          } catch (emailErr) {
            console.error('Cancellation email failed (non-fatal):', emailErr)
          }
        }

        console.log(`Subscription updated: user=${userId} status=${sub.status} cancel_at_period_end=${sub.cancel_at_period_end}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id

        await db.from('subscriptions').update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)

        if (userId) {
          await db.from('users').update({ plan_tier: 'free' }).eq('id', userId)

          // Notify user that access has ended
          try {
            const { data: userData } = await db.from('users').select('email').eq('id', userId).single()
            if (userData?.email) {
              const template = subscriptionExpiredEmail()
              await sendEmail({ to: userData.email, ...template })
            }
          } catch (emailErr) {
            console.error('Subscription expired email failed (non-fatal):', emailErr)
          }

          console.log(`Subscription canceled: user=${userId} → free tier`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        if (!customerId) break

        try {
          const { data: userData } = await db
            .from('users')
            .select('email, plan_tier')
            .eq('stripe_customer_id', customerId)
            .single()

          if (userData?.email) {
            const planLabel = userData.plan_tier === 'insights' ? 'Insights' : 'Essentials'
            const nextRetry = invoice.next_payment_attempt
            const template = paymentFailedEmail(
              planLabel,
              nextRetry ? new Date(nextRetry * 1000).toISOString() : undefined
            )
            await sendEmail({ to: userData.email, ...template })
          }
        } catch (emailErr) {
          console.error('Payment failed email failed (non-fatal):', emailErr)
        }

        console.log(`Payment failed: customer=${customerId}`)
        break
      }

      case 'invoice.payment_succeeded': {
        // Only send recovery email if this invoice follows a previous failure.
        // billing_reason='subscription_cycle' is a normal renewal — don't email.
        // billing_reason='subscription_update' or attempt_count > 1 = recovery.
        const invoice = event.data.object as Stripe.Invoice
        const isRecovery = (invoice.attempt_count ?? 0) > 1
        if (!isRecovery) break

        const customerId = invoice.customer as string
        if (!customerId) break

        try {
          const { data: userData } = await db
            .from('users')
            .select('email, plan_tier')
            .eq('stripe_customer_id', customerId)
            .single()

          if (userData?.email) {
            const planLabel = userData.plan_tier === 'insights' ? 'Insights' : 'Essentials'
            const template = paymentRecoveredEmail(planLabel)
            await sendEmail({ to: userData.email, ...template })
          }
        } catch (emailErr) {
          console.error('Payment recovered email failed (non-fatal):', emailErr)
        }

        console.log(`Payment recovered: customer=${customerId}`)
        break
      }

      default:
        // Ignore other event types
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`Webhook handler error for ${event.type}:`, detail)
    // Return 200 to prevent Stripe from retrying on our internal errors
    return NextResponse.json({ received: true, error: detail })
  }
}
