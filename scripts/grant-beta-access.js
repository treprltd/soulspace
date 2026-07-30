#!/usr/bin/env node
/**
 * Soul Space — Grant (or revoke) beta full access
 *
 * Sets users.beta_full_access = true for the first N feedback participants so
 * they experience the COMPLETE Phase 1 product (unlimited reflections) without
 * a paid plan. The /api/mirror free-tier gate honours this flag (migration 022).
 *
 * Run migration 022_beta_full_access.sql FIRST (Supabase → SQL Editor).
 *
 * Usage (always dry-run first to see who it would touch):
 *   node --env-file=.env.local scripts/grant-beta-access.js --first 500 --dry-run
 *   node --env-file=.env.local scripts/grant-beta-access.js --first 500
 *   node --env-file=.env.local scripts/grant-beta-access.js --emails a@x.com,b@y.com
 *   node --env-file=.env.local scripts/grant-beta-access.js --first 500 --revoke
 *
 * Selection (choose one):
 *   --first N          the earliest N users by created_at (the "first 500")
 *   --emails a,b,c     an explicit comma-separated email list
 *
 * Flags:
 *   --dry-run          print who would change; write nothing
 *   --revoke           set beta_full_access = false instead of true
 *
 * Required env vars (in .env.local):
 *   SUPABASE_PROD_URL          (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_PROD_SERVICE_KEY  (or SUPABASE_SERVICE_ROLE_KEY)
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')

// ── Args ──────────────────────────────────────────────────────────────────────
const argv     = process.argv.slice(2)
const DRY_RUN  = argv.includes('--dry-run')
const REVOKE   = argv.includes('--revoke')
const GRANT    = !REVOKE

function argValue(flag) {
  const i = argv.indexOf(flag)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}

const firstN   = argValue('--first') ? parseInt(argValue('--first'), 10) : null
const emailArg = argValue('--emails')
const emails   = emailArg ? emailArg.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) : null

if (!firstN && !emails) {
  console.error('❌  Pick a selection: --first N  or  --emails a@x.com,b@y.com')
  console.error('    (add --dry-run to preview, --revoke to remove access)')
  process.exit(1)
}
if (firstN && (!Number.isInteger(firstN) || firstN <= 0)) {
  console.error('❌  --first must be a positive integer.')
  process.exit(1)
}

// ── Supabase service client ───────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_PROD_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY =
  process.env.SUPABASE_PROD_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing SUPABASE_PROD_URL / SUPABASE_PROD_SERVICE_KEY')
  console.error('    (or NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).\n')
  process.exit(1)
}

async function main() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`\n🎟️   Beta access — ${GRANT ? 'GRANT' : 'REVOKE'}${DRY_RUN ? '  (DRY RUN)' : ''}`)
  console.log(`    Target : ${SUPABASE_URL}`)

  // ── Resolve target rows ─────────────────────────────────────────────────────
  let targets = []
  if (firstN) {
    const { data, error } = await db
      .from('users')
      .select('id, email, created_at, beta_full_access')
      .order('created_at', { ascending: true })
      .limit(firstN)
    if (error) { console.error('❌  Query failed:', error.message); process.exit(1) }
    targets = data ?? []
    console.log(`    Select : first ${firstN} users by signup date (${targets.length} found)\n`)
  } else {
    const { data, error } = await db
      .from('users')
      .select('id, email, created_at, beta_full_access')
      .in('email', emails)
    if (error) { console.error('❌  Query failed:', error.message); process.exit(1) }
    targets = data ?? []
    const foundEmails = new Set((targets ?? []).map(u => (u.email ?? '').toLowerCase()))
    const missing = emails.filter(e => !foundEmails.has(e))
    console.log(`    Select : ${emails.length} emails (${targets.length} matched)`)
    if (missing.length) console.log(`    ⚠️   No account for: ${missing.join(', ')}`)
    console.log('')
  }

  // Only rows that actually need changing
  const toChange = targets.filter(u => u.beta_full_access !== GRANT)
  console.log(`    ${toChange.length} of ${targets.length} row(s) will change; ${targets.length - toChange.length} already ${GRANT ? 'granted' : 'revoked'}.\n`)

  if (toChange.length === 0) { console.log('✅  Nothing to do.\n'); return }

  if (DRY_RUN) {
    for (const u of toChange.slice(0, 20)) console.log(`    would ${GRANT ? 'grant' : 'revoke'}: ${u.email}`)
    if (toChange.length > 20) console.log(`    …and ${toChange.length - 20} more`)
    console.log(`\n🟡  Dry run — no changes written. Re-run without --dry-run to apply.\n`)
    return
  }

  // ── Apply in one batched update by id ───────────────────────────────────────
  const ids = toChange.map(u => u.id)
  const { error } = await db
    .from('users')
    .update({ beta_full_access: GRANT })
    .in('id', ids)

  if (error) { console.error('❌  Update failed:', error.message); process.exit(1) }
  console.log(`✅  ${GRANT ? 'Granted' : 'Revoked'} beta full access for ${ids.length} user(s).\n`)
}

main().catch(err => { console.error('❌  Unexpected error:', err); process.exit(1) })
