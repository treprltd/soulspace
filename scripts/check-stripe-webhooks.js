#!/usr/bin/env node
/**
 * scripts/check-stripe-webhooks.js
 *
 * Checks the Stripe webhook delivery log for failures in the last N hours.
 * A delivery failure means a subscription event was missed — potentially
 * leaving a paying user stuck on the free tier.
 */

const STRIPE_KEY      = process.env.STRIPE_SECRET_KEY
const LOOKBACK_HOURS  = parseInt(process.env.LOOKBACK_HOURS ?? '24', 10)

if (!STRIPE_KEY) {
  console.error('Missing STRIPE_SECRET_KEY')
  process.exit(1)
}

;(async () => {
  console.log(`\n💳  Stripe webhook health check (last ${LOOKBACK_HOURS}h)\n`)

  const since = Math.floor((Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000) / 1000)

  // List webhook endpoints
  const endpointsRes = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=10', {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  })
  const endpoints = await endpointsRes.json()

  if (!endpointsRes.ok) {
    console.error(`Failed to list webhook endpoints: ${endpoints.error?.message}`)
    process.exit(1)
  }

  let totalDeliveries = 0
  let failedDeliveries = 0
  let warnings = []

  for (const endpoint of (endpoints.data ?? [])) {
    console.log(`  Endpoint: ${endpoint.url} [${endpoint.status}]`)

    if (endpoint.status !== 'enabled') {
      warnings.push(`⚠  Webhook endpoint is ${endpoint.status}: ${endpoint.url}`)
      continue
    }

    // Fetch recent events delivered to this endpoint
    const eventsRes = await fetch(
      `https://api.stripe.com/v1/events?limit=100&created[gte]=${since}&delivery_success=false`,
      { headers: { Authorization: `Bearer ${STRIPE_KEY}` } }
    )
    const events = await eventsRes.json()

    if (!eventsRes.ok) {
      console.error(`  Failed to query events: ${events.error?.message}`)
      continue
    }

    const relevant = (events.data ?? []).filter(e =>
      ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(e.type)
    )

    totalDeliveries += (events.data ?? []).length
    failedDeliveries += relevant.length

    if (relevant.length > 0) {
      for (const e of relevant) {
        warnings.push(`  ✗ Failed delivery: ${e.type} (id: ${e.id}, created: ${new Date(e.created * 1000).toISOString()})`)
      }
    }
  }

  console.log(`\n  Total failed deliveries (critical event types): ${failedDeliveries}`)

  if (warnings.length > 0) {
    warnings.forEach(w => console.warn(w))
  }

  if (failedDeliveries > 0) {
    console.error(`\n❌  ALERT: ${failedDeliveries} critical Stripe webhook delivery failure(s) in last ${LOOKBACK_HOURS}h.`)
    console.error('    Affected users may be stuck on free tier. Check Stripe dashboard → Webhooks → Event deliveries.')
    process.exit(1)
  } else {
    console.log(`\n✅  No critical webhook delivery failures in last ${LOOKBACK_HOURS}h.`)
    process.exit(0)
  }
})()
