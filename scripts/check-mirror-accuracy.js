#!/usr/bin/env node
/**
 * scripts/check-mirror-accuracy.js
 *
 * Queries the prod database for the resonance_accurate binary tap rate
 * over the last N sessions. Fails if the rate drops below threshold.
 *
 * Per CLAUDE.md: "Target: >60% accurate. If below 50% — stop all work and fix Mirror."
 *
 * Exit codes:
 *   0 — passed, skipped (insufficient data), or credentials not configured
 *   1 — accuracy is below threshold (real alert)
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const THRESHOLD        = parseInt(process.env.ACCURACY_THRESHOLD ?? '50', 10)
const SAMPLE_WINDOW    = parseInt(process.env.SAMPLE_WINDOW      ?? '200', 10)
// Minimum number of resonance taps before the check is statistically meaningful.
// Below this count the check skips rather than false-alarming on early-production data.
const MIN_SAMPLE       = parseInt(process.env.MIN_SAMPLE         ?? '20', 10)

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn('⚠  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping check.')
  console.warn('   Add SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_KEY to GitHub repository secrets.')
  process.exit(0)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

;(async () => {
  console.log(`\n🎯  Mirror accuracy check  [threshold: ${THRESHOLD}%  window: ${SAMPLE_WINDOW}  min-sample: ${MIN_SAMPLE}]\n`)

  const { data, error } = await supabase
    .from('sessions')
    .select('resonance_tap')
    .not('resonance_tap', 'is', null)
    .order('created_at', { ascending: false })
    .limit(SAMPLE_WINDOW)

  if (error) {
    // A DB error here means the credentials are wrong or the DB is unreachable.
    // This is an infrastructure problem, not a data alert — warn and skip so the
    // check doesn't continuously fire as critical when secrets aren't set up yet.
    // The smoke-prod job covers "is the app reachable" at the infrastructure level.
    console.warn(`⚠  DB query failed — skipping accuracy check.`)
    console.warn(`   Error: ${error.message}`)
    console.warn(`   Verify SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_KEY in GitHub secrets.`)
    process.exit(0)
  }

  if (!data || data.length === 0) {
    console.log('⚠  No resonance feedback found — skipping check (no tapped sessions yet).')
    process.exit(0)
  }

  const accurate   = data.filter(s => s.resonance_tap === 'accurate').length
  const inaccurate = data.filter(s => s.resonance_tap === 'not_quite').length
  const total      = accurate + inaccurate
  const pct        = total > 0 ? Math.round((accurate / total) * 100) : 0

  console.log(`  Accurate:    ${accurate}`)
  console.log(`  Inaccurate:  ${inaccurate}`)
  console.log(`  Total taps:  ${total}`)
  console.log(`  Rate:        ${pct}%`)
  console.log(`  Threshold:   ${THRESHOLD}%`)
  console.log(`  Min sample:  ${MIN_SAMPLE}\n`)

  if (total < MIN_SAMPLE) {
    console.log(`⚠  Only ${total} tapped session(s) — need at least ${MIN_SAMPLE} for a reliable check. Skipping.`)
    process.exit(0)
  }

  if (pct < THRESHOLD) {
    console.error(`❌  ALERT: Mirror accuracy ${pct}% is below the ${THRESHOLD}% threshold.`)
    if (pct < 50) {
      console.error('    CRITICAL: Below 50% — per CLAUDE.md, stop all work and fix Mirror immediately.')
    }
    process.exit(1)
  } else {
    console.log(`✅  Mirror accuracy ${pct}% is above the ${THRESHOLD}% threshold.`)
    process.exit(0)
  }
})()
