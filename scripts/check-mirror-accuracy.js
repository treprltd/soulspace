#!/usr/bin/env node
/**
 * scripts/check-mirror-accuracy.js
 *
 * Queries the prod database for the resonance_accurate binary tap rate
 * over the last N sessions. Fails if the rate drops below threshold.
 *
 * Per CLAUDE.md: "Target: >60% accurate. If below 50% — stop all work and fix Mirror."
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const THRESHOLD        = parseInt(process.env.ACCURACY_THRESHOLD ?? '50', 10)
const SAMPLE_WINDOW    = parseInt(process.env.SAMPLE_WINDOW ?? '200', 10)

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn('⚠  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping check.')
  process.exit(0)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

;(async () => {
  console.log(`\n🎯  Mirror accuracy check (last ${SAMPLE_WINDOW} tapped sessions, threshold: ${THRESHOLD}%)\n`)

  // resonance_tap is stored directly in sessions as 'accurate' | 'not_quite'.
  // Querying the sessions table directly is more reliable than the events table
  // because the resonance tap is always written here, regardless of event logging.
  const { data, error } = await supabase
    .from('sessions')
    .select('resonance_tap')
    .not('resonance_tap', 'is', null)
    .order('created_at', { ascending: false })
    .limit(SAMPLE_WINDOW)

  if (error) {
    console.error(`❌  DB query failed: ${error.message}`)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log('⚠  No resonance feedback found — skipping check (insufficient data)')
    process.exit(0)
  }

  const accurate   = data.filter(s => s.resonance_tap === 'accurate').length
  const inaccurate = data.filter(s => s.resonance_tap === 'not_quite').length
  const total      = accurate + inaccurate
  const pct        = total > 0 ? Math.round((accurate / total) * 100) : 0

  console.log(`  Accurate:   ${accurate}`)
  console.log(`  Inaccurate: ${inaccurate}`)
  console.log(`  Total:      ${total}`)
  console.log(`  Rate:       ${pct}%`)
  console.log(`  Threshold:  ${THRESHOLD}%\n`)

  if (pct < THRESHOLD) {
    console.error(`❌  ALERT: Mirror accuracy ${pct}% is below ${THRESHOLD}% threshold.`)
    if (pct < 50) {
      console.error('    CRITICAL: Below 50% — per CLAUDE.md, stop all work and fix Mirror immediately.')
    }
    process.exit(1)
  } else {
    console.log(`✅  Mirror accuracy ${pct}% is above ${THRESHOLD}% threshold.`)
    process.exit(0)
  }
})()
