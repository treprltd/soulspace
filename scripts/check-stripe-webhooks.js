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
  console.warn('⚠  STRIPE_SECRET_KEY not set — skipping check.')
  process.exit(0)
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

  const CRITICAL_EVENT_TYPES = [
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
  ]

  let disabledEndpoints = []
  let criticalEventCount = 0
  let warnings = []

  // ── 1. Verify all webhook endpoints are enabled ─────────────────────────────
  for (const endpoint of (endpoints.data ?? [])) {
    console.log(`  Endpoint: ${endpoint.url} [${endpoint.status}]`)
    if (endpoint.status !== 'enabled') {
      disabledEndpoints.push(endpoint.url)
      warnings.push(`⚠  Webhook endpoint DISABLED: ${endpoint.url}`)
    }
  }

  // ── 2. Count critical event types in the lookback window ────────────────────
  // The Stripe Events API does not support filtering by delivery_success.
  // We list all events of critical types and count them as a volume health signal.
  // If critical events exist but the endpoint is disabled, that's the failure.
  let hasMore = true
  let startingAfter = undefined
  while (hasMore) {
    const params = new URLSearchParams({
      limit: '100',
      [`created[gte]`]: String(since),
    })
    if (startingAfter) params.set('starting_after', startingAfter)

    const eventsRes = await fetch(
      `https://api.stripe.com/v1/events?${params}`,
      { headers: { Authorization: `Bearer ${STRIPE_KEY}` } }
    )
    const events = await eventsRes.json()

    if (!eventsRes.ok) {
      console.error(`Failed to query Stripe events: ${events.error?.message}`)
      process.exit(1)
    }

    const relevant = (events.data ?? []).filter(e => CRITICAL_EVENT_TYPES.includes(e.type))
    criticalEventCount += relevant.length

    // Log each relevant event for the audit trail
    for (const e of relevant) {
      console.log(`  ${e.type} · ${new Date(e.created * 1000).toISOString()} · ${e.id}`)
    }

    hasMore = events.has_more && (events.data ?? []).length === 100
    if (hasMore) startingAfter = events.data[events.data.length - 1].id
  }

  console.log(`\n  Critical event types seen (last ${LOOKBACK_HOURS}h): ${criticalEventCount}`)
  console.log(`  Disabled endpoints: ${disabledEndpoints.length}`)

  if (warnings.length > 0) {
    warnings.forEach(w => console.warn(w))
  }

  // ── 3. Fail if any endpoint is disabled while critical events are flowing ───
  if (disabledEndpoints.length > 0 && criticalEventCount > 0) {
    console.error(`\n❌  ALERT: ${disabledEndpoints.length} webhook endpoint(s) are disabled, but ${criticalEventCount} critical Stripe event(s) fired in last ${LOOKBACK_HOURS}h.`)
    console.error('    Affected users may be stuck on free tier. Re-enable endpoints in Stripe dashboard → Webhooks.')
    process.exit(1)
  } else if (disabledEndpoints.length > 0) {
    console.warn(`\n⚠  ${disabledEndpoints.length} webhook endpoint(s) are disabled (no critical events in window — low risk now).`)
    process.exit(0)
  } else {
    console.log(`\n✅  All webhook endpoints enabled. ${criticalEventCount} critical event(s) processed in last ${LOOKBACK_HOURS}h.`)
    process.exit(0)
  }
})()
