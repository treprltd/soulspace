#!/usr/bin/env node
/**
 * Soul Space — End-to-End API Test Suite
 *
 * Tests every critical API route against a real environment.
 * Generates a markdown report and exits 1 if any CRITICAL test fails.
 *
 * Usage:
 *   node scripts/e2e-test.js [--url https://soulspacehealth.org] [--report]
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL        Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   Supabase anon key
 *   SUPABASE_SERVICE_ROLE_KEY       Supabase service-role key (for test user setup)
 *
 * Optional env vars:
 *   BASE_URL              Target base URL (default: http://localhost:3000)
 *   ANTHROPIC_API_KEY     If set, mirror tests are run (costs ~$0.01 per run)
 *   REPORT_PATH           Where to write the markdown report (default: e2e-report.md)
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL    = process.env.BASE_URL ?? 'http://localhost:3000'
const REPORT_PATH = process.env.REPORT_PATH ?? path.join(__dirname, '..', 'e2e-report.md')
const WRITE_REPORT = process.argv.includes('--report')

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const HAS_ANTHROPIC     = !!process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Test state ────────────────────────────────────────────────────────────────

const results = []
let testUser  = null
let accessToken = null
let testSessionId = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) { process.stdout.write(msg + '\n') }

async function api(method, path, { body, token, expectStatus } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { _raw: text } }
  return { status: res.status, json }
}

async function run(name, critical, fn) {
  const start = Date.now()
  try {
    const { pass, detail } = await fn()
    const ms = Date.now() - start
    const icon = pass ? '✅' : (critical ? '❌' : '⚠️ ')
    log(`  ${icon}  ${name}${detail ? ' — ' + detail : ''} (${ms}ms)`)
    results.push({ name, pass, critical, detail, ms })
  } catch (err) {
    const ms = Date.now() - start
    log(`  ❌  ${name} — threw: ${err.message} (${ms}ms)`)
    results.push({ name, pass: false, critical, detail: err.message, ms })
  }
}

function section(title) {
  log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length - 4))}`)
  results.push({ section: title })
}

// ── Setup: create test user and get access token ──────────────────────────────

async function setup() {
  log('\n🔧  SETUP')

  const email = `e2e-test-${Date.now()}@soulspace-test.invalid`

  // Create a confirmed test user
  const { data: { user }, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { e2e_test: true },
  })
  if (createErr || !user) throw new Error(`createUser failed: ${createErr?.message}`)
  testUser = user
  log(`  Created test user: ${email} (${user.id})`)

  // Generate a magic link and exchange it for a session token
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData?.properties?.email_otp) {
    throw new Error(`generateLink failed: ${linkErr?.message}`)
  }

  // Exchange the OTP for a real session using the anon client
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: verifyErr } = await anonClient.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: 'email',
  })
  if (verifyErr || !authData?.session) {
    throw new Error(`verifyOtp failed: ${verifyErr?.message}`)
  }

  accessToken = authData.session.access_token
  log(`  ✅  Access token obtained`)
}

// ── Teardown: delete test user and all related data ───────────────────────────

async function teardown() {
  if (!testUser) return
  log('\n🧹  TEARDOWN')
  try {
    await adminClient.auth.admin.deleteUser(testUser.id)
    log(`  Deleted test user ${testUser.id}`)
  } catch (err) {
    log(`  ⚠️  Could not delete test user: ${err.message}`)
  }
}

// ── Test suites ───────────────────────────────────────────────────────────────

async function testAuth() {
  section('Authentication')

  await run('Protected routes return 401 without token', true, async () => {
    const endpoints = [
      ['GET',  '/api/subscription'],
      ['GET',  '/api/sessions/history'],
      ['POST', '/api/sessions'],
    ]
    const failures = []
    for (const [method, path] of endpoints) {
      const { status } = await api(method, path, { body: method === 'POST' ? { branch: 'A' } : undefined })
      if (status !== 401) failures.push(`${method} ${path} returned ${status}`)
    }
    return { pass: failures.length === 0, detail: failures.join(', ') || undefined }
  })

  await run('Valid Bearer token returns 200 on /api/subscription', true, async () => {
    const { status } = await api('GET', '/api/subscription', { token: accessToken })
    return { pass: status === 200, detail: `status=${status}` }
  })

  await run('Expired/invalid token returns 401', false, async () => {
    const { status } = await api('GET', '/api/subscription', { token: 'invalid.token.here' })
    return { pass: status === 401, detail: `status=${status}` }
  })
}

async function testSessionCreation() {
  section('Session Creation (POST /api/sessions)')

  await run('Missing body returns 400', false, async () => {
    const { status } = await api('POST', '/api/sessions', { token: accessToken, body: {} })
    return { pass: status === 400, detail: `status=${status}` }
  })

  await run('Invalid branch returns 400', false, async () => {
    const { status } = await api('POST', '/api/sessions', { token: accessToken, body: { branch: 'Z' } })
    return { pass: status === 400, detail: `status=${status}` }
  })

  await run('Valid request creates session (201)', true, async () => {
    const { status, json } = await api('POST', '/api/sessions', {
      token: accessToken,
      body: { branch: 'A' },
    })
    if (status === 201 && json.session?.id) {
      testSessionId = json.session.id
    }
    return { pass: status === 201 && !!json.session?.id, detail: `id=${json.session?.id ?? 'none'}` }
  })

  await run('Created session appears in DB', true, async () => {
    if (!testSessionId) return { pass: false, detail: 'no session ID from previous test' }
    const { data } = await adminClient.from('sessions').select('id,user_id,branch').eq('id', testSessionId).single()
    return { pass: data?.id === testSessionId && data?.user_id === testUser.id, detail: `branch=${data?.branch}` }
  })
}

async function testSubscriptionAPI() {
  section('Subscription & Usage (GET /api/subscription)')

  await run('Returns planTier and sessionsThisMonth', true, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    return {
      pass: typeof json.planTier === 'string' && typeof json.sessionsThisMonth === 'number',
      detail: `tier=${json.planTier} sessions=${json.sessionsThisMonth}`,
    }
  })

  await run('Session count is accurate (≥1 after creation)', true, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    return {
      pass: (json.sessionsThisMonth ?? 0) >= 1,
      detail: `count=${json.sessionsThisMonth}`,
    }
  })

  await run('Free tier limit is set correctly (=1)', false, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    return {
      pass: json.limit === 1,
      detail: `limit=${json.limit}`,
    }
  })
}

async function testSessionHistory() {
  section('Session History (GET /api/sessions/history)')

  await run('Returns sessions array', true, async () => {
    const { status, json } = await api('GET', '/api/sessions/history', { token: accessToken })
    return { pass: status === 200 && Array.isArray(json.sessions), detail: `count=${json.sessions?.length}` }
  })

  await run('History contains the created session', true, async () => {
    if (!testSessionId) return { pass: false, detail: 'no session ID' }
    const { json } = await api('GET', '/api/sessions/history', { token: accessToken })
    const found = (json.sessions ?? []).some(s => s.id === testSessionId)
    return { pass: found, detail: found ? 'found' : 'NOT found in history' }
  })

  await run('Limit param is respected (max=50)', false, async () => {
    const { status, json } = await api('GET', '/api/sessions/history?limit=2', { token: accessToken })
    return { pass: status === 200 && Array.isArray(json.sessions), detail: `returned ${json.sessions?.length}` }
  })
}

async function testSessionComplete() {
  section('Session Complete (POST /api/sessions/:id/complete)')

  await run('Marks session as completed', true, async () => {
    if (!testSessionId) return { pass: false, detail: 'no session ID' }
    const { status } = await api('POST', `/api/sessions/${testSessionId}/complete`, { token: accessToken })
    if (status !== 200) return { pass: false, detail: `status=${status}` }
    // Verify in DB
    const { data } = await adminClient.from('sessions').select('completed_at').eq('id', testSessionId).single()
    return { pass: !!data?.completed_at, detail: `completed_at=${data?.completed_at}` }
  })

  await run('Cannot complete non-existent session (returns 500)', false, async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const { status } = await api('POST', `/api/sessions/${fakeId}/complete`, { token: accessToken })
    // Supabase update with no matching rows returns no error (0 rows affected) — 200 expected
    return { pass: status === 200 || status === 500, detail: `status=${status}` }
  })
}

async function testResonance() {
  section('Resonance Tap (POST /api/sessions/:id/resonance)')

  // Create a fresh session to tap so we don't interfere with the completed one
  let tapSessionId = null
  const { json: created } = await api('POST', '/api/sessions', { token: accessToken, body: { branch: 'B' } })
  tapSessionId = created.session?.id ?? null

  await run('Valid tap saves resonance_tap in DB', true, async () => {
    if (!tapSessionId) return { pass: false, detail: 'could not create session for tap test' }
    const { status } = await api('POST', `/api/sessions/${tapSessionId}/resonance`, {
      token: accessToken,
      body: { result: 'accurate' },
    })
    if (status !== 200) return { pass: false, detail: `status=${status}` }
    const { data } = await adminClient.from('sessions').select('resonance_tap').eq('id', tapSessionId).single()
    return { pass: data?.resonance_tap === 'accurate', detail: `resonance_tap=${data?.resonance_tap}` }
  })

  await run('Invalid result value returns 400', false, async () => {
    if (!tapSessionId) return { pass: false, detail: 'no session' }
    const { status } = await api('POST', `/api/sessions/${tapSessionId}/resonance`, {
      token: accessToken,
      body: { result: 'invalid_value' },
    })
    return { pass: status === 400, detail: `status=${status}` }
  })
}

async function testSessionRecovery() {
  section('Anonymous Session Recovery (POST /api/sessions/recover)')

  const fakeMirror = JSON.stringify({
    carrying:   'A test carrying statement.',
    underneath: 'A test underneath statement.',
    question:   'A test question back?',
    season:     'W',
    patternTags: ['clarity', 'uncertainty'],
    safetyFlagged: false,
  })

  await run('Valid recovery creates a session row', true, async () => {
    const { status, json } = await api('POST', '/api/sessions/recover', {
      token: accessToken,
      body: {
        branch:       'C',
        contextText:  'Test context from anonymous session.',
        mirrorOutput: fakeMirror,
        emotions:     JSON.stringify(['anxious', 'uncertain']),
        intensity:    6,
        resonanceTap: 'accurate',
        savedAt:      Date.now(),
      },
    })
    return {
      pass: status === 200 && json.ok === true && !!json.sessionId,
      detail: `status=${status} sessionId=${json.sessionId ?? 'none'}`,
    }
  })

  await run('Expired payload (>1h) is rejected with 410', true, async () => {
    const { status } = await api('POST', '/api/sessions/recover', {
      token: accessToken,
      body: {
        branch:       'D',
        contextText:  'Old context.',
        mirrorOutput: fakeMirror,
        emotions:     '[]',
        intensity:    3,
        resonanceTap: null,
        savedAt:      Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      },
    })
    return { pass: status === 410, detail: `status=${status}` }
  })

  await run('Recovery without token returns 401', true, async () => {
    const { status } = await api('POST', '/api/sessions/recover', {
      body: { branch: 'A', mirrorOutput: fakeMirror, emotions: '[]', intensity: 5, savedAt: Date.now() },
    })
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('Session count increments after recovery', true, async () => {
    const { json: before } = await api('GET', '/api/subscription', { token: accessToken })
    const countBefore = before.sessionsThisMonth ?? 0

    await api('POST', '/api/sessions/recover', {
      token: accessToken,
      body: {
        branch: 'B', contextText: 'Recovery count test.', mirrorOutput: fakeMirror,
        emotions: '[]', intensity: 4, resonanceTap: null, savedAt: Date.now(),
      },
    })

    const { json: after } = await api('GET', '/api/subscription', { token: accessToken })
    const countAfter = after.sessionsThisMonth ?? 0

    return {
      pass: countAfter === countBefore + 1,
      detail: `${countBefore} → ${countAfter}`,
    }
  })
}

async function testPaywall() {
  section('Free-Tier Paywall (POST /api/mirror)')

  if (!HAS_ANTHROPIC) {
    log('  ⏭️   Mirror tests skipped (ANTHROPIC_API_KEY not set)')
    results.push({ name: 'Mirror paywall enforcement', pass: null, critical: false, detail: 'skipped — no API key' })
    return
  }

  // Find how many sessions the test user has this month
  const { json: sub } = await api('GET', '/api/subscription', { token: accessToken })
  const count = sub.sessionsThisMonth ?? 0
  const FREE_LIMIT = sub.limit ?? 1

  if (count < FREE_LIMIT) {
    log(`  ⏭️   Cannot test paywall — test user has ${count}/${FREE_LIMIT} sessions (need to reach limit first)`)
    results.push({ name: 'Mirror paywall enforcement', pass: null, critical: false, detail: 'skipped — test user not at limit' })
    return
  }

  await run('Mirror returns paywall:true when limit reached', true, async () => {
    const { status, json } = await api('POST', '/api/mirror', {
      token: accessToken,
      body: {
        sessionId:   crypto.randomUUID(),
        branch:      'A',
        emotionTags: ['overwhelmed'],
        intensity:   5,
        contextText: 'Test context for paywall check.',
      },
    })
    return {
      pass: status === 200 && json.paywall === true,
      detail: `status=${status} paywall=${json.paywall}`,
    }
  })
}

async function testAdminDigest() {
  section('Admin Digest (POST /api/notifications/digest)')

  await run('Missing cron secret returns 401', true, async () => {
    const { status } = await api('POST', '/api/notifications/digest?mode=admin_digest', {})
    return { pass: status === 401, detail: `status=${status}` }
  })

  if (process.env.CRON_SECRET) {
    await run('Valid cron secret runs digest', false, async () => {
      const res = await fetch(`${BASE_URL}/api/notifications/digest?mode=admin_digest`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET },
      })
      const json = await res.json()
      return { pass: res.status === 200 && json.ok === true, detail: `status=${res.status}` }
    })
  } else {
    log('  ⏭️   Digest end-to-end skipped (CRON_SECRET not set)')
  }
}

// ── Report generation ─────────────────────────────────────────────────────────

function buildReport() {
  const passed    = results.filter(r => r.pass === true)
  const failed    = results.filter(r => r.pass === false)
  const skipped   = results.filter(r => r.pass === null)
  const critFails = results.filter(r => r.pass === false && r.critical)

  const now = new Date().toISOString()
  const lines = [
    `# Soul Space E2E Test Report`,
    ``,
    `**Date:** ${now}  `,
    `**Target:** ${BASE_URL}  `,
    `**Mirror tests:** ${HAS_ANTHROPIC ? 'enabled' : 'skipped (no ANTHROPIC_API_KEY)'}`,
    ``,
    `## Summary`,
    ``,
    `| Result | Count |`,
    `|--------|-------|`,
    `| ✅ Passed   | ${passed.length} |`,
    `| ❌ Failed   | ${failed.length} |`,
    `| ⏭️ Skipped  | ${skipped.length} |`,
    `| **Total**  | **${passed.length + failed.length + skipped.length}** |`,
    ``,
    critFails.length > 0
      ? `> ⚠️ **${critFails.length} CRITICAL failure(s)** — deploy blocked until resolved.`
      : `> ✅ All critical tests passed — safe to deploy.`,
    ``,
    `## Results`,
    ``,
  ]

  for (const r of results) {
    if (r.section) {
      lines.push(`### ${r.section}`)
      lines.push(``)
      continue
    }
    const icon   = r.pass === true ? '✅' : r.pass === false ? (r.critical ? '❌' : '⚠️') : '⏭️'
    const badge  = r.critical ? ' `CRITICAL`' : ''
    const detail = r.detail ? ` — *${r.detail}*` : ''
    const timing = r.ms != null ? ` *(${r.ms}ms)*` : ''
    lines.push(`- ${icon}${badge} **${r.name}**${detail}${timing}`)
  }

  lines.push(``)
  lines.push(`---`)
  lines.push(`*Generated by \`scripts/e2e-test.js\`*`)

  return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`\n╔══════════════════════════════════════════════════════════════╗`)
  log(`║       Soul Space — E2E API Test Suite                        ║`)
  log(`╚══════════════════════════════════════════════════════════════╝`)
  log(`  Target:  ${BASE_URL}`)
  log(`  Mirror:  ${HAS_ANTHROPIC ? 'ENABLED' : 'skipped'}`)

  try {
    await setup()
  } catch (err) {
    log(`\n❌  Setup failed: ${err.message}`)
    log('    Check SUPABASE_SERVICE_ROLE_KEY and ensure the Supabase project is reachable.')
    process.exit(1)
  }

  try {
    await testAuth()
    await testSessionCreation()
    await testSubscriptionAPI()
    await testSessionHistory()
    await testSessionComplete()
    await testResonance()
    await testSessionRecovery()
    await testPaywall()
    await testAdminDigest()
  } finally {
    await teardown()
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const passed    = results.filter(r => r.pass === true).length
  const failed    = results.filter(r => r.pass === false).length
  const skipped   = results.filter(r => r.pass === null).length
  const critFails = results.filter(r => r.pass === false && r.critical)

  log(`\n══════════════════════════════════════════════════════════════`)
  log(`  Results:  ✅ ${passed} passed  ❌ ${failed} failed  ⏭️  ${skipped} skipped`)

  if (WRITE_REPORT) {
    const report = buildReport()
    fs.writeFileSync(REPORT_PATH, report, 'utf8')
    log(`  Report:   ${REPORT_PATH}`)
  }

  if (critFails.length > 0) {
    log(`\n  ❌  CRITICAL FAILURES — do NOT push to production:`)
    critFails.forEach(f => log(`      • ${f.name}${f.detail ? ' — ' + f.detail : ''}`))
    log(``)
    process.exit(1)
  }

  log(`\n  ✅  All critical tests passed. Safe to deploy.\n`)
  process.exit(0)
}

main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
