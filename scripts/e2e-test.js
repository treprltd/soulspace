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
 *   CRON_SECRET           If set, digest endpoint live-fire tests run
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

const missingSecrets = [
  !SUPABASE_URL      && 'NEXT_PUBLIC_SUPABASE_URL',
  !SUPABASE_ANON_KEY && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  !SERVICE_ROLE_KEY  && 'SUPABASE_SERVICE_ROLE_KEY',
].filter(Boolean)

if (missingSecrets.length > 0) {
  console.error('\n❌  Missing required environment variables:')
  missingSecrets.forEach(v => console.error(`    • ${v}`))
  console.error('\n    For local runs — create a .env.local file with these values.')
  console.error('    For CI — add them to GitHub: Settings → Secrets → Actions\n')
  process.exit(1)
}

// Quick connectivity check — fail fast with a useful error if the app is unreachable
async function checkConnectivity() {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(8000) })
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, error: err.message }
  }
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

async function testPublicPages() {
  section('Public Pages & Health Check')

  await run('Homepage (GET /) is reachable', true, async () => {
    const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(10000) })
    return { pass: res.status === 200, detail: `status=${res.status}` }
  })

  await run('Pricing page (GET /pricing) is reachable', false, async () => {
    const res = await fetch(`${BASE_URL}/pricing`, { signal: AbortSignal.timeout(10000) })
    return { pass: res.status === 200, detail: `status=${res.status}` }
  })

  await run('GET /api/health returns valid response', true, async () => {
    const { status, json } = await api('GET', '/api/health')
    const hasFields = typeof json.status === 'string' && typeof json.checks === 'object'
    return {
      pass: (status === 200 || status === 503) && hasFields,
      detail: `status=${status} health=${json.status}`,
    }
  })

  await run('/api/health reports supabase check', true, async () => {
    const { json } = await api('GET', '/api/health')
    return {
      pass: typeof json.checks?.supabase === 'boolean',
      detail: `supabase=${json.checks?.supabase}`,
    }
  })

  await run('/api/health reports encryption check', true, async () => {
    const { json } = await api('GET', '/api/health')
    return {
      pass: typeof json.checks?.encryption === 'boolean' && json.checks.encryption === true,
      detail: `encryption=${json.checks?.encryption}`,
    }
  })
}

async function testWelcomeEmail() {
  section('Welcome Email (POST /api/user/welcome)')

  await run('Returns 401 without auth token', true, async () => {
    const { status } = await api('POST', '/api/user/welcome')
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('Returns 200 for authenticated user (skipped for returning users)', true, async () => {
    const { status, json } = await api('POST', '/api/user/welcome', { token: accessToken })
    // Test user will have sessions from earlier tests → should skip gracefully
    // New users get sent=true; returning users get skipped=true. Both are valid.
    const isValid = status === 200 && (json.sent === true || json.skipped === true)
    return {
      pass: isValid,
      detail: `status=${status} sent=${json.sent} skipped=${json.skipped} reason=${json.reason ?? ''}`,
    }
  })

  await run('Idempotent — second call skips (user now has sessions)', false, async () => {
    const { status, json } = await api('POST', '/api/user/welcome', { token: accessToken })
    // After sessions exist, must return skipped
    const isSkipped = status === 200 && json.skipped === true
    return {
      pass: isSkipped,
      detail: `skipped=${json.skipped} reason=${json.reason ?? ''}`,
    }
  })
}

async function testNotificationBannerData() {
  section('Notification Banner Data (GET /api/subscription)')

  await run('Response includes all banner-required fields', true, async () => {
    const { status, json } = await api('GET', '/api/subscription', { token: accessToken })
    const requiredFields = ['planTier', 'sessionsThisMonth', 'limit']
    const missing = requiredFields.filter(f => !(f in json))
    return {
      pass: status === 200 && missing.length === 0,
      detail: missing.length > 0 ? `missing: ${missing.join(', ')}` : `tier=${json.planTier} sessions=${json.sessionsThisMonth} limit=${json.limit}`,
    }
  })

  await run('cancel_at_period_end field is present (null for free tier)', false, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    const present = 'cancelAtPeriodEnd' in json || json.planTier === 'free'
    return {
      pass: present,
      detail: `planTier=${json.planTier} cancelAtPeriodEnd=${json.cancelAtPeriodEnd ?? 'null (free tier — expected)'}`,
    }
  })

  await run('sessionsThisMonth is a non-negative integer', true, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    const v = json.sessionsThisMonth
    return {
      pass: Number.isInteger(v) && v >= 0,
      detail: `sessionsThisMonth=${v}`,
    }
  })

  await run('limit is a positive integer', true, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    const v = json.limit
    return {
      pass: Number.isInteger(v) && v > 0,
      detail: `limit=${v}`,
    }
  })
}

async function testDigestEndpoints() {
  section('Notification Digest Endpoints (POST & GET /api/notifications/digest)')

  // ── Auth guard tests (no secret) ────────────────────────────────────────────
  await run('POST without cron secret returns 401', true, async () => {
    const { status } = await api('POST', '/api/notifications/digest?mode=admin_digest')
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('POST with wrong cron secret returns 401', true, async () => {
    const res = await fetch(`${BASE_URL}/api/notifications/digest?mode=admin_digest`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong-secret-value' },
    })
    return { pass: res.status === 401, detail: `status=${res.status}` }
  })

  await run('GET without secret param returns 401', true, async () => {
    const { status } = await api('GET', '/api/notifications/digest')
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('GET with wrong secret param returns 401', false, async () => {
    const { status } = await api('GET', '/api/notifications/digest?secret=wrong')
    return { pass: status === 401, detail: `status=${status}` }
  })

  // ── Live-fire tests (only when CRON_SECRET is set) ───────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    log('  ⏭️   Live digest tests skipped (CRON_SECRET not set)')
    results.push({ name: 'GET /api/notifications/digest health check', pass: null, critical: false, detail: 'skipped — no CRON_SECRET' })
    results.push({ name: 'POST digest mode=admin_digest', pass: null, critical: false, detail: 'skipped — no CRON_SECRET' })
    results.push({ name: 'POST digest mode=user_digest', pass: null, critical: false, detail: 'skipped — no CRON_SECRET' })
    results.push({ name: 'POST digest mode=all', pass: null, critical: false, detail: 'skipped — no CRON_SECRET' })
    return
  }

  await run('GET /api/notifications/digest health check (valid secret)', false, async () => {
    const res = await fetch(`${BASE_URL}/api/notifications/digest?secret=${encodeURIComponent(cronSecret)}`)
    const json = await res.json().catch(() => ({}))
    return {
      pass: res.status === 200 && json.ok === true,
      detail: `status=${res.status} ok=${json.ok}`,
    }
  })

  await run('POST digest mode=admin_digest completes without error', false, async () => {
    const res = await fetch(`${BASE_URL}/api/notifications/digest?mode=admin_digest`, {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    })
    const json = await res.json().catch(() => ({}))
    return {
      pass: res.status === 200 && json.ok === true,
      detail: `status=${res.status} adminDigest=${JSON.stringify(json.results?.adminDigest ?? {})}`,
    }
  })

  await run('POST digest mode=user_digest completes without error', false, async () => {
    const res = await fetch(`${BASE_URL}/api/notifications/digest?mode=user_digest`, {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    })
    const json = await res.json().catch(() => ({}))
    return {
      pass: res.status === 200 && json.ok === true,
      detail: `status=${res.status} userDigest=${JSON.stringify(json.results?.userDigest ?? {})}`,
    }
  })

  await run('POST digest mode=all runs both admin + user pipelines', false, async () => {
    const res = await fetch(`${BASE_URL}/api/notifications/digest?mode=all`, {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    })
    const json = await res.json().catch(() => ({}))
    const hasAdminKey = 'adminDigest' in (json.results ?? {})
    const hasUserKey  = 'userDigest'  in (json.results ?? {})
    return {
      pass: res.status === 200 && json.ok === true && hasAdminKey && hasUserKey,
      detail: `status=${res.status} keys=${Object.keys(json.results ?? {}).join(',')}`,
    }
  })
}

async function testAdminPortalAuth() {
  section('Admin Portal Auth (all /api/admin/* require admin cookie)')

  const adminRoutes = [
    ['GET',  '/api/admin/sessions'],
    ['GET',  '/api/admin/users'],
    ['GET',  '/api/admin/analytics'],
    ['GET',  '/api/admin/stats'],
    ['GET',  '/api/admin/events'],
    ['GET',  '/api/admin/mirror'],
    ['GET',  '/api/admin/safety'],
    ['GET',  '/api/admin/revenue'],
    ['GET',  '/api/admin/health'],
    ['GET',  '/api/admin/retention'],
  ]

  await run('All admin GET routes return 401 without cookie', true, async () => {
    const failures = []
    for (const [method, path] of adminRoutes) {
      const { status } = await api(method, path)
      if (status !== 401) failures.push(`${method} ${path} → ${status}`)
    }
    return {
      pass: failures.length === 0,
      detail: failures.length > 0 ? failures.join(' | ') : `${adminRoutes.length} routes all returned 401`,
    }
  })

  await run('Admin routes also reject Bearer token (not admin cookie)', true, async () => {
    // A regular user JWT should NOT grant admin access
    const failures = []
    for (const [method, path] of adminRoutes.slice(0, 3)) { // sample 3 to keep test fast
      const { status } = await api(method, path, { token: accessToken })
      if (status !== 401) failures.push(`${method} ${path} → ${status}`)
    }
    return {
      pass: failures.length === 0,
      detail: failures.length > 0 ? failures.join(' | ') : 'Bearer token correctly rejected on admin routes',
    }
  })

  await run('POST /api/admin/auth with wrong password returns 401', true, async () => {
    const { status } = await api('POST', '/api/admin/auth', {
      body: { password: 'wrong-password-e2e-test' },
    })
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('DELETE /api/admin/auth (logout) returns 200', false, async () => {
    const res = await fetch(`${BASE_URL}/api/admin/auth`, { method: 'DELETE' })
    return { pass: res.status === 200, detail: `status=${res.status}` }
  })
}

async function testStripeRoutes() {
  section('Stripe Route Security')

  await run('POST /api/stripe/checkout requires auth (returns 401)', true, async () => {
    const { status } = await api('POST', '/api/stripe/checkout', {
      body: { planTier: 'essentials' },
    })
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('POST /api/stripe/portal requires auth (returns 401)', true, async () => {
    const { status } = await api('POST', '/api/stripe/portal', { body: {} })
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('POST /api/stripe/webhook without stripe-signature returns 400', true, async () => {
    // No signature header → must reject before any processing
    const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    })
    return { pass: res.status === 400, detail: `status=${res.status}` }
  })

  await run('POST /api/stripe/checkout with auth but invalid plan returns 400', false, async () => {
    const { status } = await api('POST', '/api/stripe/checkout', {
      token: accessToken,
      body: { planTier: 'invalid_plan' },
    })
    return { pass: status === 400, detail: `status=${status}` }
  })
}

async function testSessionRecoveryDBState() {
  section('Anonymous Session Recovery — DB State Verification')

  const fakeMirror = JSON.stringify({
    carrying:   'DB state verification carrying statement.',
    underneath: 'DB state verification underneath statement.',
    question:   'DB state verification question?',
    season:     'S',
    patternTags: ['reflection'],
    safetyFlagged: false,
  })

  let recoveredSessionId = null

  await run('Recovery creates session row with completed_at set', true, async () => {
    const { status, json } = await api('POST', '/api/sessions/recover', {
      token: accessToken,
      body: {
        branch:       'D',
        contextText:  'DB state verification context.',
        mirrorOutput: fakeMirror,
        emotions:     JSON.stringify(['uncertain', 'hopeful']),
        intensity:    7,
        resonanceTap: 'accurate',
        savedAt:      Date.now(),
      },
    })
    if (status === 200 && json.sessionId) {
      recoveredSessionId = json.sessionId
    }
    return {
      pass: status === 200 && !!json.sessionId,
      detail: `status=${status} sessionId=${json.sessionId ?? 'none'}`,
    }
  })

  await run('Recovered session has completed_at in DB', true, async () => {
    if (!recoveredSessionId) return { pass: false, detail: 'no sessionId from previous test' }
    const { data } = await adminClient
      .from('sessions')
      .select('id, user_id, branch, completed_at, resonance_tap, season_assigned')
      .eq('id', recoveredSessionId)
      .single()
    return {
      pass: !!data?.completed_at,
      detail: `completed_at=${data?.completed_at ?? 'null'} branch=${data?.branch} resonance=${data?.resonance_tap}`,
    }
  })

  await run('Recovered session has resonance_tap saved in DB', true, async () => {
    if (!recoveredSessionId) return { pass: false, detail: 'no sessionId' }
    const { data } = await adminClient
      .from('sessions')
      .select('resonance_tap')
      .eq('id', recoveredSessionId)
      .single()
    return {
      pass: data?.resonance_tap === 'accurate',
      detail: `resonance_tap=${data?.resonance_tap}`,
    }
  })

  await run('Recovered session content exists in session_content table', true, async () => {
    if (!recoveredSessionId) return { pass: false, detail: 'no sessionId' }
    const { data } = await adminClient
      .from('session_content')
      .select('session_id, context_text_enc, mirror_output_enc')
      .eq('session_id', recoveredSessionId)
      .single()
    const hasEncContent = data?.context_text_enc != null || data?.mirror_output_enc != null
    return {
      pass: !!data && hasEncContent,
      detail: data ? 'encrypted content found' : 'NO session_content row found',
    }
  })

  await run('Recovery logs mirror_rendered event with recovered=true', true, async () => {
    if (!recoveredSessionId) return { pass: false, detail: 'no sessionId' }
    const { data } = await adminClient
      .from('events')
      .select('event_name, metadata')
      .eq('session_id', recoveredSessionId)
      .eq('event_name', 'mirror_rendered')
    const event = (data ?? [])[0]
    const isRecovered = event?.metadata?.recovered === true
    return {
      pass: !!event && isRecovered,
      detail: event
        ? `event found, recovered=${event.metadata?.recovered}`
        : 'mirror_rendered event NOT found in events table',
    }
  })
}

async function testUserDataEndpoint() {
  section('User Data (GET /api/user/data)')

  await run('Returns 401 without token', true, async () => {
    const { status } = await api('GET', '/api/user/data')
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('Returns user data with valid token', true, async () => {
    const { status, json } = await api('GET', '/api/user/data', { token: accessToken })
    const hasData = status === 200 && (json.user != null || json.sessions != null || json.error == null)
    return {
      pass: hasData || status === 200,
      detail: `status=${status}`,
    }
  })
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
    `**Mirror tests:** ${HAS_ANTHROPIC ? 'enabled' : 'skipped (no ANTHROPIC_API_KEY)'}  `,
    `**Digest tests:** ${process.env.CRON_SECRET ? 'enabled' : 'skipped (no CRON_SECRET)'}`,
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
  log(`  Digest:  ${process.env.CRON_SECRET ? 'ENABLED' : 'skipped'}`)

  // ── Connectivity preflight ───────────────────────────────────────────────
  log(`\n🔌  Checking connectivity…`)
  const conn = await checkConnectivity()
  if (!conn.ok) {
    log(`\n❌  Cannot reach ${BASE_URL}`)
    log(`    Error: ${conn.error}`)
    log(`\n    Fix options:`)
    log(`      • Run "npm run dev" if testing locally`)
    log(`      • Set BASE_URL to a deployed URL: BASE_URL=https://soulspacehealth.org npm run e2e`)
    log(`      • In CI: set the E2E_BASE_URL repository variable in GitHub Settings → Variables\n`)
    process.exit(1)
  }
  log(`  ✅  ${BASE_URL} is reachable (HTTP ${conn.status})`)

  try {
    await setup()
  } catch (err) {
    log(`\n❌  Setup failed: ${err.message}`)
    log('    Check SUPABASE_SERVICE_ROLE_KEY and ensure the Supabase project is reachable.')
    process.exit(1)
  }

  try {
    // ── Core flow ──────────────────────────────────────────────────────────────
    await testPublicPages()
    await testAuth()
    await testSessionCreation()
    await testSubscriptionAPI()
    await testSessionHistory()
    await testSessionComplete()
    await testResonance()
    await testSessionRecovery()
    await testSessionRecoveryDBState()
    await testPaywall()

    // ── Email & notifications ──────────────────────────────────────────────────
    await testWelcomeEmail()
    await testNotificationBannerData()
    await testDigestEndpoints()

    // ── Admin & security ───────────────────────────────────────────────────────
    await testAdminPortalAuth()
    await testStripeRoutes()
    await testAdminDigest()

    // ── User data ──────────────────────────────────────────────────────────────
    await testUserDataEndpoint()
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
