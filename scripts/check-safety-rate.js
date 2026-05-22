#!/usr/bin/env node
/**
 * scripts/check-safety-rate.js
 *
 * Checks the safety flag rate over the last 24 hours.
 * Alerts if the rate exceeds SAFETY_FLAG_THRESHOLD %.
 *
 * A spike in safety flags could indicate:
 *   - A prompt injection attack in the wild
 *   - An unusual influx of genuine crisis users
 *   - A classifier false-positive regression
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const THRESHOLD        = parseFloat(process.env.SAFETY_FLAG_THRESHOLD ?? '5')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn('⚠  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping check.')
  process.exit(0)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

;(async () => {
  console.log(`\n🛡  Safety flag rate check (last 24h, threshold: ${THRESHOLD}%)\n`)

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Total mirror renders in last 24h.
  // events table uses 'timestamp' column (not 'created_at').
  // Event name is 'mirror_rendered' (not 'mirror_requested').
  const { count: totalCount, error: totalErr } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'mirror_rendered')
    .gte('timestamp', since)

  // Safety-flagged calls in last 24h.
  // safety_events table uses 'timestamp' column (not 'created_at').
  const { count: flaggedCount, error: flaggedErr } = await supabase
    .from('safety_events')
    .select('id', { count: 'exact', head: true })
    .gte('timestamp', since)

  if (totalErr || flaggedErr) {
    console.error(`DB error: ${totalErr?.message ?? flaggedErr?.message}`)
    process.exit(1)
  }

  const total   = totalCount ?? 0
  const flagged = flaggedCount ?? 0
  const rate    = total > 0 ? ((flagged / total) * 100).toFixed(1) : '0.0'

  console.log(`  Mirror requests (24h): ${total}`)
  console.log(`  Safety flagged (24h):  ${flagged}`)
  console.log(`  Flag rate:             ${rate}%`)
  console.log(`  Threshold:             ${THRESHOLD}%\n`)

  if (total < 10) {
    console.log('⚠  Fewer than 10 sessions in window — skipping rate check (insufficient data)')
    process.exit(0)
  }

  if (parseFloat(rate) > THRESHOLD) {
    console.error(`❌  ALERT: Safety flag rate ${rate}% exceeds ${THRESHOLD}% threshold.`)
    console.error('    Investigate: possible prompt injection, classifier regression, or genuine crisis spike.')
    process.exit(1)
  } else {
    console.log(`✅  Safety flag rate ${rate}% is within normal range.`)
    process.exit(0)
  }
})()
