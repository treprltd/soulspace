#!/usr/bin/env node
/**
 * scripts/clean-contact-test-data.js
 *
 * Removes clearly-test rows from `contact_submissions`, keeping every real
 * customer submission. DRY RUN by default — deletes nothing unless you pass
 * --execute. Always writes a timestamped JSON backup of every row it deletes,
 * so the operation is recoverable (re-insert from the backup if needed).
 *
 * WHY email-only matching: a row is a delete candidate ONLY if its email
 * matches a reserved / non-deliverable test pattern (RFC 2606 example.com,
 * *.test, *.invalid, …) or an explicit test address listed below. Addresses at
 * real domains (gmail.com, a university address, …) are NEVER matched
 * automatically. Deleting a real person's outreach to a mental-health product
 * because their name looked like a placeholder is not a call a heuristic gets
 * to make. If you have test rows at a real domain, delete them explicitly with
 * EXTRA_TEST_EMAILS (see below) after eyeballing the kept list.
 *
 * Usage (run by whoever holds PROD credentials — nothing here has them):
 *
 *   # 1. Dry run — prints exactly what WOULD be deleted, deletes nothing:
 *   SUPABASE_PROD_URL=... SUPABASE_PROD_SERVICE_KEY=... \
 *     node scripts/clean-contact-test-data.js
 *
 *   # 2. Review the candidate list + the written backup file, THEN execute:
 *   SUPABASE_PROD_URL=... SUPABASE_PROD_SERVICE_KEY=... \
 *     node scripts/clean-contact-test-data.js --execute
 *
 * Required env (prod project; falls back to the same names the admin client
 * uses so it works from a prod .env.local too):
 *   SUPABASE_PROD_URL          (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_PROD_SERVICE_KEY  (or SUPABASE_SERVICE_ROLE_KEY)
 *
 * Optional env:
 *   EXTRA_TEST_EMAILS   Comma-separated exact emails to ALSO delete (for test
 *                       rows at real domains you have personally verified).
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

// ── Config ────────────────────────────────────────────────────────────────────
const EXECUTE = process.argv.includes('--execute')

const SUPABASE_URL =
  process.env.SUPABASE_PROD_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY =
  process.env.SUPABASE_PROD_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌  Missing credentials. Set SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_KEY')
  console.error('    (or NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).\n')
  process.exit(1)
}

const EXTRA_TEST_EMAILS = new Set(
  (process.env.EXTRA_TEST_EMAILS ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
)

// ── Test-data classifier (email-only, conservative) ─────────────────────────────
// Reserved / non-deliverable domains — RFC 2606 and common test TLDs. An
// address at any of these cannot belong to a real customer.
const RESERVED_DOMAIN =
  /@(?:example\.(?:com|org|net|edu)|(?:[^@]+\.)?(?:test|example|invalid|localhost))$/i

// Explicit exact test addresses (case-insensitive). Extend deliberately.
const KNOWN_TEST_EMAILS = new Set([
  'test@test.com',
  'demo@demo.com',
])

function classify(row) {
  const email = String(row.email ?? '').trim().toLowerCase()
  if (RESERVED_DOMAIN.test(email))   return { isTest: true, reason: 'reserved test domain' }
  if (KNOWN_TEST_EMAILS.has(email))  return { isTest: true, reason: 'known test address' }
  if (EXTRA_TEST_EMAILS.has(email))  return { isTest: true, reason: 'EXTRA_TEST_EMAILS' }
  return { isTest: false, reason: null }
}

// ── Main ────────────────────────────────────────────────────────────────────────
;(async () => {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`\n🧹  Contact test-data cleanup`)
  console.log(`    Target : ${SUPABASE_URL}`)
  console.log(`    Mode   : ${EXECUTE ? '⚠️  EXECUTE (rows will be deleted)' : 'DRY RUN (no deletes)'}\n`)

  // Fetch all rows (paged, ascending id-stable order).
  const all = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) { console.error('❌  Fetch failed:', error.message); process.exit(1) }
    all.push(...data)
    if (data.length < PAGE) break
  }

  const toDelete = []
  const toKeep   = []
  for (const row of all) {
    const c = classify(row)
    ;(c.isTest ? toDelete : toKeep).push({ ...row, _reason: c.reason })
  }

  console.log(`    Total rows      : ${all.length}`)
  console.log(`    Test (delete)   : ${toDelete.length}`)
  console.log(`    Real (keep)     : ${toKeep.length}\n`)

  if (toDelete.length === 0) {
    console.log('✅  No test rows matched. Nothing to do.\n')
    process.exit(0)
  }

  // Show a sample of what will be deleted, grouped by reason.
  const byReason = {}
  for (const r of toDelete) (byReason[r._reason] ??= []).push(r)
  for (const [reason, rows] of Object.entries(byReason)) {
    console.log(`  ── ${rows.length} × ${reason} ──`)
    rows.slice(0, 8).forEach(r =>
      console.log(`     ${r.email.padEnd(28)} ${String(r.name).slice(0, 24).padEnd(24)} ${r.created_at?.slice(0, 10)}`))
    if (rows.length > 8) console.log(`     … and ${rows.length - 8} more`)
  }

  // Show the KEEP list so a human can confirm no real data is caught (or spot
  // test rows at real domains that need EXTRA_TEST_EMAILS).
  console.log(`\n  ── Keeping ${toKeep.length} row(s) (must all be real) ──`)
  toKeep.slice(0, 30).forEach(r =>
    console.log(`     ${r.email.padEnd(28)} ${String(r.name).slice(0, 24).padEnd(24)} ${r.created_at?.slice(0, 10)}`))
  if (toKeep.length > 30) console.log(`     … and ${toKeep.length - 30} more — review with the admin panel`)

  // Always write a backup of the delete set BEFORE any deletion.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(__dirname, '..', `contact-test-backup-${stamp}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(toDelete, null, 2))
  console.log(`\n💾  Backup of delete set written: ${backupPath}`)

  if (!EXECUTE) {
    console.log(`\n🔍  DRY RUN — nothing deleted. Re-run with --execute to delete the ${toDelete.length} row(s) above.\n`)
    process.exit(0)
  }

  // Execute: delete by id in batches.
  const ids = toDelete.map(r => r.id)
  let deleted = 0
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const { error } = await db.from('contact_submissions').delete().in('id', batch)
    if (error) { console.error(`\n❌  Delete failed on batch ${i}-${i + batch.length}:`, error.message)
      console.error(`    ${deleted} row(s) deleted before failure. Backup: ${backupPath}\n`); process.exit(1) }
    deleted += batch.length
    console.log(`    deleted ${deleted}/${ids.length}`)
  }

  console.log(`\n✅  Deleted ${deleted} test row(s). ${toKeep.length} real row(s) kept. Backup: ${backupPath}\n`)
  process.exit(0)
})()
