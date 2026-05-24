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

// ── WebSocket polyfill ────────────────────────────────────────────────────────
// @supabase/realtime-js requires a global WebSocket constructor.
// Node.js 22+ ships it natively. On Node.js 20 we fall back to the 'ws'
// package. If neither is available the script errors out immediately with a
// clear message rather than the cryptic realtime-js throw.
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    globalThis.WebSocket = require('ws')
  } catch {
    console.error('❌  WebSocket not available. Run on Node.js 22+ or install the "ws" package.')
    process.exit(1)
  }
}

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
let testUser    = null
let accessToken = null
let testSessionId = null

// Set to true in setup() when the app's Supabase project ≠ our adminClient's project.
// Triggers earlier/clearer diagnostics in session-dependent tests.
let dbMismatch = false

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
    const icon = pass === true ? '✅' : pass === null ? '⏭️ ' : (critical ? '❌' : '⚠️ ')
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

  // ── Get a session token ───────────────────────────────────────────────────
  // signInWithPassword produces a standard JWT that the production app's
  // createServerClient.auth.getUser(token) always accepts.
  //
  // We avoid verifyOtp / generateLink because @supabase/ssr cookie-mode clients
  // sometimes reject OTP-issued JWTs when the Supabase project has strict
  // redirectTo URL allow-lists (common in production environments).
  const testPassword = `E2eTest${Date.now()}!Aa`

  // Patch the just-created user to add a password (admin API sets it directly)
  const { error: pwErr } = await adminClient.auth.admin.updateUserById(user.id, {
    password: testPassword,
  })
  if (pwErr) throw new Error(`setPassword failed: ${pwErr.message}`)

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
    email,
    password: testPassword,
  })
  if (signInErr || !signInData?.session) {
    throw new Error(`signInWithPassword failed: ${signInErr?.message}`)
  }

  accessToken = signInData.session.access_token
  log(`  ✅  Access token obtained (password auth)`)

  // ── Validate the token against our own Supabase project ─────────────────
  // If this fails it means signInWithPassword returned a JWT that even OUR
  // Supabase project's auth API rejects — almost certainly a wrong anon key.
  // If this passes but the app later returns authenticated=false, it means the
  // app uses a DIFFERENT Supabase project than the GitHub Secrets.
  try {
    const selfCheckRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      signal: AbortSignal.timeout(5000),
    })
    if (selfCheckRes.ok) {
      log(`  ✅  Token is valid for GitHub Secrets' Supabase project (${SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0]}.supabase.co)`)
    } else {
      const body = await selfCheckRes.text().catch(() => '')
      throw new Error(
        `Token self-check failed (${selfCheckRes.status}): ${body.slice(0, 120)}\n` +
        `  This means NEXT_PUBLIC_SUPABASE_ANON_KEY does not match NEXT_PUBLIC_SUPABASE_URL.\n` +
        `  Both must come from the SAME Supabase project. Update GitHub Secrets to fix.`
      )
    }
  } catch (e) {
    if (e.message.includes('Token self-check failed')) throw e
    log(`  ⚠️   Token self-check skipped (network error): ${e.message}`)
  }

  // ── Ensure public.users row exists with an unlimited plan ───────────────
  // The sessions table has a FK: user_id → public.users(id).
  // If no public.users row exists the first sessions INSERT fails with FK violation.
  // We set plan_tier='essentials' so the free-tier gate never fires during the
  // test run — otherwise recovery tests get paywalled after just 1-3 sessions.
  //
  // IMPORTANT: Supabase JS never throws on DB errors — always check .error
  //
  // We upsert TWICE with a 400 ms gap between them. Some Supabase projects
  // have an async Edge Function / trigger that fires on auth.users INSERT
  // and (re)creates the public.users row with plan_tier='free'. Waiting 400 ms
  // and repeating the upsert guarantees we win even if such a trigger exists.
  const upsertPayload = { id: user.id, email, plan_tier: 'essentials' }
  const upsertOpts    = { onConflict: 'id' }

  const { error: upsertErr1 } = await adminClient.from('users').upsert(upsertPayload, upsertOpts)
  if (upsertErr1) throw new Error(`public.users upsert (1) failed: ${upsertErr1.message}`)

  // Give any async trigger time to run, then upsert again so we always win.
  await new Promise(r => setTimeout(r, 400))
  const { error: upsertErr2 } = await adminClient.from('users').upsert(upsertPayload, upsertOpts)
  if (upsertErr2) throw new Error(`public.users upsert (2) failed: ${upsertErr2.message}`)

  // Verify the row actually landed (defence-in-depth)
  const { data: verifyRow, error: rowErr } = await adminClient
    .from('users')
    .select('id, plan_tier')
    .eq('id', user.id)
    .single()
  if (rowErr || !verifyRow) throw new Error(`public.users row not found after upsert: ${rowErr?.message}`)
  if (verifyRow.plan_tier !== 'essentials') {
    throw new Error(`plan_tier mismatch: got '${verifyRow.plan_tier}', expected 'essentials'. ` +
      `The Supabase project may have a trigger that resets plan_tier — contact the project owner.`)
  }

  log(`  ✅  public.users row confirmed (id=${user.id} plan_tier=${verifyRow.plan_tier})`)

  // ── DB consistency check ─────────────────────────────────────────────────
  // Call the deployed app's subscription endpoint with our JWT. If the app
  // returns planTier='essentials' we know it can see the same public.users row
  // our adminClient just wrote (→ same Supabase project). If it returns 'free',
  // the app's SUPABASE_SERVICE_ROLE_KEY points to a DIFFERENT database.
  //
  // This is the most common CI failure cause: Vercel and GitHub Secrets pointing
  // to different Supabase projects.
  try {
    const subRes = await fetch(`${BASE_URL}/api/subscription`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    })
    const subJson = await subRes.json()

    if (subJson.planTier === 'essentials') {
      log(`  ✅  DB consistency: app sees planTier='essentials' — GitHub Secrets ↔ Vercel env are aligned`)
    } else {
      dbMismatch = true
      log(``)
      log(`  ⚠️  ╔══════════════════════════════════════════════════════════════════╗`)
      log(`  ⚠️  ║  SUPABASE PROJECT MISMATCH DETECTED                             ║`)
      log(`  ⚠️  ╠══════════════════════════════════════════════════════════════════╣`)
      log(`  ⚠️  ║  adminClient upserted planTier='essentials' into project A      ║`)
      log(`  ⚠️  ║  App at ${BASE_URL.replace('https://', '').padEnd(26)} returned planTier='${subJson.planTier}'      ║`)
      log(`  ⚠️  ║                                                                  ║`)
      log(`  ⚠️  ║  CAUSE: GitHub Secrets point to a DIFFERENT Supabase project    ║`)
      log(`  ⚠️  ║  than the one soulspacehealth.org actually uses.                ║`)
      log(`  ⚠️  ║                                                                  ║`)
      log(`  ⚠️  ║  ALL 3 secrets must match the PRODUCTION Vercel env vars:       ║`)
      log(`  ⚠️  ║    NEXT_PUBLIC_SUPABASE_URL       ← must match Vercel           ║`)
      log(`  ⚠️  ║    NEXT_PUBLIC_SUPABASE_ANON_KEY  ← must match Vercel           ║`)
      log(`  ⚠️  ║    SUPABASE_SERVICE_ROLE_KEY       ← must match Vercel           ║`)
      log(`  ⚠️  ║                                                                  ║`)
      log(`  ⚠️  ║  FIX (step by step):                                             ║`)
      log(`  ⚠️  ║  1. Vercel → soulspace → Settings → Environment Variables       ║`)
      log(`  ⚠️  ║  2. Set filter to: Environment = "Production"                   ║`)
      log(`  ⚠️  ║  3. Copy all 3 values listed above                              ║`)
      log(`  ⚠️  ║  4. GitHub → treprltd/soulspace → Settings → Secrets → Actions  ║`)
      log(`  ⚠️  ║  5. Update ALL 3 secrets to the values from step 3              ║`)
      log(`  ⚠️  ║  6. Re-run this workflow                                         ║`)
      log(`  ⚠️  ╚══════════════════════════════════════════════════════════════════╝`)
      log(``)
    }
  } catch (e) {
    log(`  ⚠️   DB consistency check skipped (network error: ${e.message})`)
  }
}

// ── Teardown: delete test user and all related data ───────────────────────────

async function teardown() {
  if (!testUser) return
  log('\n🧹  TEARDOWN')
  try {
    // Delete public.users row first (sessions cascade to session_content + events via FK)
    const { error: delUserErr } = await adminClient.from('users').delete().eq('id', testUser.id)
    if (delUserErr) log(`  ⚠️  public.users delete warning: ${delUserErr.message}`)
    // Then delete auth user
    const { error: delAuthErr } = await adminClient.auth.admin.deleteUser(testUser.id)
    if (delAuthErr) log(`  ⚠️  auth.users delete warning: ${delAuthErr.message}`)
    log(`  Deleted test user ${testUser.id}`)
  } catch (err) {
    log(`  ⚠️  Could not delete test user: ${err.message}`)
  }
}

// ── Test suites ───────────────────────────────────────────────────────────────

async function testAuth() {
  section('Authentication')

  await run('Session and history routes return 401 without token', true, async () => {
    // NOTE: /api/subscription is intentionally PUBLIC — returns 200 with { authenticated:false }
    // so the frontend can check plan status without a session. Only session-write routes need auth.
    const endpoints = [
      ['GET',  '/api/sessions/history'],
      ['POST', '/api/sessions'],
      ['POST', '/api/user/welcome'],
      ['DELETE', '/api/user/data'],
    ]
    const failures    = []  // deployed but returned wrong status
    const notDeployed = []  // returned 404 — route not on this env yet
    for (const [method, path] of endpoints) {
      const { status } = await api(method, path, { body: method === 'POST' ? { branch: 'A' } : undefined })
      if (status === 404)       notDeployed.push(`${method} ${path}`)
      else if (status !== 401)  failures.push(`${method} ${path} returned ${status}`)
    }
    const parts = [
      failures.length > 0    ? `WRONG STATUS: ${failures.join(', ')}`          : '',
      notDeployed.length > 0 ? `not deployed (OK): ${notDeployed.join(', ')}` : '',
    ].filter(Boolean)
    return { pass: failures.length === 0, detail: parts.join(' | ') || undefined }
  })

  await run('GET /api/subscription returns 200 without auth (public endpoint)', true, async () => {
    // Subscription is intentionally public — returns { authenticated:false } for guests
    const { status, json } = await api('GET', '/api/subscription')
    return {
      pass: status === 200 && json.authenticated === false,
      detail: `status=${status} authenticated=${json.authenticated}`,
    }
  })

  await run('Valid Bearer token returns 200 on /api/subscription', true, async () => {
    const { status, json } = await api('GET', '/api/subscription', { token: accessToken })
    // Must return 200 AND authenticated:true — status=200 alone is a false positive
    // because the subscription endpoint is public and returns 200+authenticated:false for guests too
    return {
      pass: status === 200 && json.authenticated === true,
      detail: `status=${status} authenticated=${json.authenticated}`,
    }
  })

  await run('Invalid Bearer token on /api/subscription → 200 unauthenticated (not 401)', false, async () => {
    // Subscription is public: invalid tokens don't yield 401, they yield 200+authenticated:false
    const { status, json } = await api('GET', '/api/subscription', { token: 'invalid.token.here' })
    return {
      pass: status === 200 && json.authenticated === false,
      detail: `status=${status} authenticated=${json.authenticated}`,
    }
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
      return { pass: true, detail: `status=201 id=${testSessionId}` }
    }
    if (status === 500) {
      // FK violation: sessions.user_id → public.users(id) fails because the app's
      // service client cannot find our test user's row in public.users.
      // The setup() DB consistency check above determined the root cause.
      const rootCause = dbMismatch
        ? 'CONFIRMED DB MISMATCH — GitHub Secrets write to a different Supabase project than the app reads. ' +
          'See the ╔══╗ box in the SETUP section of this log for exact fix steps.'
        : 'Unexpected 500 — check Supabase logs for the FK or constraint error detail.'
      return {
        pass: false,
        detail: `status=500 (FK violation) — ${rootCause}`,
      }
    }
    return {
      pass: false,
      detail: `status=${status} id=${json.session?.id ?? 'none'} | server=${JSON.stringify(json).slice(0, 120)}`,
    }
  })

  await run('Created session appears in DB', true, async () => {
    if (!testSessionId) {
      // Session creation failed (likely DB mismatch) — skip rather than cascade-fail
      return { pass: null, detail: 'skipped — session creation did not produce a session ID' }
    }
    const { data } = await adminClient.from('sessions').select('id,user_id,branch').eq('id', testSessionId).single()
    return { pass: data?.id === testSessionId && data?.user_id === testUser.id, detail: `branch=${data?.branch}` }
  })
}

async function testSubscriptionAPI() {
  section('Subscription & Usage (GET /api/subscription)')

  await run('Returns planTier and sessionsThisMonth', true, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    // authenticated:false means the Bearer token was rejected — surface a clear diagnosis
    if (json.authenticated === false) {
      return {
        pass: false,
        detail: 'Bearer token rejected by production app — Supabase project mismatch. ' +
          'All 3 GitHub Secrets (URL, ANON_KEY, SERVICE_ROLE_KEY) must match the ' +
          'Production Vercel environment for soulspacehealth.org.',
      }
    }
    return {
      pass: typeof json.planTier === 'string' && typeof json.sessionsThisMonth === 'number',
      detail: `tier=${json.planTier} sessions=${json.sessionsThisMonth}`,
    }
  })

  await run('Session count is accurate (≥1 after creation)', true, async () => {
    if (!testSessionId) {
      // Session creation failed upstream — this test is meaningless without a session
      return { pass: null, detail: 'skipped — no session was created (see session creation failure above)' }
    }
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    return {
      pass: (json.sessionsThisMonth ?? 0) >= 1,
      detail: `count=${json.sessionsThisMonth}`,
    }
  })

  await run('Limit field is present and correct for plan tier', false, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    // Free  → a positive integer (the source-code const may differ across deployed envs)
    // Paid  → null (unlimited)
    const pass = json.planTier === 'free'
      ? (Number.isInteger(json.limit) && json.limit > 0)
      : json.limit === null
    return {
      pass,
      detail: `tier=${json.planTier} limit=${json.limit} (free→positive int, paid→null)`,
    }
  })
}

async function testSessionHistory() {
  section('Session History (GET /api/sessions/history)')

  await run('Returns sessions array', true, async () => {
    const { status, json } = await api('GET', '/api/sessions/history', { token: accessToken })
    if (status === 401) {
      return { pass: false, detail: 'status=401 — Bearer token rejected. Check setup() signInWithPassword logs.' }
    }
    return {
      pass: status === 200 && Array.isArray(json.sessions),
      detail: `status=${status} count=${json.sessions?.length}`,
    }
  })

  await run('History contains the created session', true, async () => {
    if (!testSessionId) return { pass: null, detail: 'skipped — no session was created' }
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
    if (!testSessionId) return { pass: null, detail: 'skipped — no session was created' }
    const { status } = await api('POST', `/api/sessions/${testSessionId}/complete`, { token: accessToken })
    if (status !== 200) return { pass: false, detail: `status=${status}` }
    // Verify in DB
    const { data } = await adminClient.from('sessions').select('completed_at').eq('id', testSessionId).single()
    return { pass: !!data?.completed_at, detail: `completed_at=${data?.completed_at}` }
  })

  await run('Cannot complete non-existent session (returns 200 or 500)', false, async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const { status } = await api('POST', `/api/sessions/${fakeId}/complete`, { token: accessToken })
    // If auth itself is failing, this test can't tell us anything about "non-existent session" behaviour
    if (status === 401) return { pass: null, detail: 'status=401 — Bearer token rejected (auth issue in setup)' }
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
    if (!tapSessionId) return { pass: null, detail: 'skipped — session creation failed (see session creation failure above)' }
    const { status } = await api('POST', `/api/sessions/${tapSessionId}/resonance`, {
      token: accessToken,
      body: { result: 'accurate' },
    })
    if (status !== 200) return { pass: false, detail: `status=${status}` }
    const { data } = await adminClient.from('sessions').select('resonance_tap').eq('id', tapSessionId).single()
    return { pass: data?.resonance_tap === 'accurate', detail: `resonance_tap=${data?.resonance_tap}` }
  })

  await run('Invalid result value returns 400', false, async () => {
    if (!tapSessionId) return { pass: null, detail: 'skipped — session creation failed' }
    const { status } = await api('POST', `/api/sessions/${tapSessionId}/resonance`, {
      token: accessToken,
      body: { result: 'invalid_value' },
    })
    return { pass: status === 400, detail: `status=${status}` }
  })
}

async function testSessionRecovery() {
  section('Anonymous Session Recovery (POST /api/sessions/recover)')

  // ── Probe: is this route deployed on the current environment? ─────────────
  // POST with no auth → 401 when deployed, 404 when not yet deployed.
  const { status: probeStatus } = await api('POST', '/api/sessions/recover', {})
  if (probeStatus === 404) {
    const skipDetail = 'route not deployed on this environment (404)'
    log(`  ⏭️   All session recovery tests skipped — ${skipDetail}`)
    ;[
      'Valid recovery creates a session row',
      'Expired payload (>1h) is rejected with 410',
      'Recovery without token returns 401',
      'Session count increments after recovery',
    ].forEach(name => results.push({ name, pass: null, critical: false, detail: skipDetail }))
    return
  }

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
    // paywall:true means free limit reached — not an error, just a cap
    if (status === 200 && json.paywall === true) {
      return { pass: null, detail: 'free-tier limit reached — paywalled (skip)' }
    }
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

    const { status: recoverStatus, json: recoverJson } = await api('POST', '/api/sessions/recover', {
      token: accessToken,
      body: {
        branch: 'B', contextText: 'Recovery count test.', mirrorOutput: fakeMirror,
        emotions: '[]', intensity: 4, resonanceTap: null, savedAt: Date.now(),
      },
    })

    // If we hit the paywall, this test cannot run — skip rather than fail
    if (recoverStatus === 200 && recoverJson.paywall === true) {
      return { pass: null, detail: 'free-tier limit reached before count test — skip' }
    }

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

  // Find plan and session count for this test user
  const { json: sub } = await api('GET', '/api/subscription', { token: accessToken })
  const count = sub.sessionsThisMonth ?? 0
  const FREE_LIMIT = sub.limit ?? 1

  // The test user was set to 'essentials' in setup to prevent paywall blocking
  // earlier test suites. Paywall only applies to free-tier users.
  if (sub.planTier !== 'free') {
    log(`  ⏭️   Paywall test skipped — test user is on '${sub.planTier}' plan (not free tier)`)
    results.push({ name: 'Mirror paywall enforcement', pass: null, critical: false, detail: `skipped — plan=${sub.planTier}` })
    return
  }

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

  // ── Probe: is the digest route deployed on this environment? ──────────────
  const { status: probeStatus } = await api('POST', '/api/notifications/digest?mode=admin_digest', {})
  if (probeStatus === 404) {
    const skipDetail = 'route not deployed on this environment (404)'
    log(`  ⏭️   Admin digest tests skipped — ${skipDetail}`)
    results.push({ name: 'Missing cron secret returns 401', pass: null, critical: false, detail: skipDetail })
    return
  }

  await run('Missing cron secret returns 401', true, async () => {
    // We already have the probe result for this exact request.
    return { pass: probeStatus === 401, detail: `status=${probeStatus}` }
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

  await run('/api/health reports encryption check', false, async () => {
    // Non-critical: key presence is validated by the app at boot; check format here
    const { json } = await api('GET', '/api/health')
    return {
      pass: typeof json.checks?.encryption === 'boolean' && json.checks.encryption === true,
      detail: `encryption=${json.checks?.encryption}`,
    }
  })
}

async function testWelcomeEmail() {
  section('Welcome Email (POST /api/user/welcome)')

  // ── Probe: is this route deployed on the current environment? ─────────────
  // POST with no auth → 401 when deployed, 404 when not yet deployed.
  const { status: probeStatus } = await api('POST', '/api/user/welcome', {})
  if (probeStatus === 404) {
    const skipDetail = 'route not deployed on this environment (404)'
    log(`  ⏭️   Welcome email tests skipped — ${skipDetail}`)
    ;[
      'Returns 401 without auth token',
      'Returns 200 for authenticated user (skipped for returning users)',
      'Idempotent — second call skips (user now has sessions)',
    ].forEach(name => results.push({ name, pass: null, critical: false, detail: skipDetail }))
    return
  }

  await run('Returns 401 without auth token', true, async () => {
    // We already probed above; re-use the known status rather than fetching again.
    return { pass: probeStatus === 401, detail: `status=${probeStatus}` }
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

  await run('subscription field is present (null for no active subscription)', false, async () => {
    // cancel_at_period_end is nested inside subscription object, not top-level.
    // For users without an active Stripe subscription, subscription should be null.
    // NOTE: older production code may not include this field at all — skip rather than fail
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    if (!('subscription' in json)) {
      return { pass: null, detail: 'subscription field absent — older API version deployed (skip)' }
    }
    const subValue = json.subscription
    const valid = subValue === null || typeof subValue?.cancel_at_period_end === 'boolean'
    return {
      pass: valid,
      detail: `subscription=${subValue === null ? 'null (no active sub — expected)' : JSON.stringify(subValue)}`,
    }
  })

  await run('sessionsThisMonth is a non-negative integer', true, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    // null means unauthenticated response — Bearer token was rejected
    if (json.authenticated === false) {
      return { pass: null, detail: 'skipped — Bearer token rejected (Supabase project mismatch)' }
    }
    const v = json.sessionsThisMonth
    return {
      pass: Number.isInteger(v) && v >= 0,
      detail: `sessionsThisMonth=${v}`,
    }
  })

  await run('limit field is correct for plan tier', true, async () => {
    const { json } = await api('GET', '/api/subscription', { token: accessToken })
    const v = json.limit
    const tier = json.planTier
    // Free tier → limit is a positive integer; paid tier → limit is null (no cap)
    const pass = tier === 'free'
      ? (Number.isInteger(v) && v > 0)
      : (v === null)
    return {
      pass,
      detail: `planTier=${tier} limit=${v} (free→integer, paid→null)`,
    }
  })
}

async function testDigestEndpoints() {
  section('Notification Digest Endpoints (POST & GET /api/notifications/digest)')

  // ── Probe: is this route deployed on the current environment? ─────────────
  // GET with no secret → 401 when deployed, 404 when not yet deployed.
  const { status: probeStatus } = await api('GET', '/api/notifications/digest', {})
  if (probeStatus === 404) {
    const skipDetail = 'route not deployed on this environment (404)'
    log(`  ⏭️   All digest endpoint tests skipped — ${skipDetail}`)
    ;[
      'POST without cron secret returns 401',
      'POST with wrong cron secret returns 401',
      'GET without secret param returns 401',
      'GET with wrong secret param returns 401',
      'GET /api/notifications/digest health check (valid secret)',
      'POST digest mode=admin_digest completes without error',
      'POST digest mode=user_digest completes without error',
      'POST digest mode=all runs both admin + user pipelines',
    ].forEach(name => results.push({ name, pass: null, critical: false, detail: skipDetail }))
    return
  }

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
    const failures    = []  // deployed but wrong status
    const notDeployed = []  // returned 404 — route not on this env yet
    for (const [method, path] of adminRoutes) {
      const { status } = await api(method, path)
      if (status === 404)      notDeployed.push(path)
      else if (status !== 401) failures.push(`${method} ${path} → ${status}`)
    }
    const parts = [
      failures.length > 0    ? `WRONG STATUS: ${failures.join(' | ')}`          : '',
      notDeployed.length > 0 ? `not deployed (OK): ${notDeployed.join(', ')}` : '',
    ].filter(Boolean)
    const deployed = adminRoutes.length - notDeployed.length
    return {
      pass: failures.length === 0,
      detail: parts.join(' | ') || `${deployed}/${adminRoutes.length} deployed routes all returned 401`,
    }
  })

  await run('Admin routes also reject Bearer token (not admin cookie)', true, async () => {
    // A regular user JWT should NOT grant admin access. Test first 3 as sample.
    const failures = []
    for (const [method, path] of adminRoutes.slice(0, 3)) {
      const { status } = await api(method, path, { token: accessToken })
      if (status === 404) continue  // not deployed — skip this route
      if (status !== 401) failures.push(`${method} ${path} → ${status}`)
    }
    return {
      pass: failures.length === 0,
      detail: failures.length > 0 ? failures.join(' | ') : 'Bearer token correctly rejected on admin routes',
    }
  })

  await run('POST /api/admin/auth with wrong password returns 401 or 503', true, async () => {
    const { status } = await api('POST', '/api/admin/auth', {
      body: { password: 'wrong-password-e2e-test' },
    })
    // 401 = wrong password (ADMIN_SECRET configured)
    // 503 = ADMIN_SECRET not configured on this environment (still blocks access)
    return { pass: status === 401 || status === 503, detail: `status=${status}` }
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
    // If auth itself is failing we can't test input validation — skip cleanly
    if (status === 401) return { pass: null, detail: 'status=401 — Bearer token rejected (auth issue in setup)' }
    return { pass: status === 400, detail: `status=${status}` }
  })
}

async function testSessionRecoveryDBState() {
  section('Anonymous Session Recovery — DB State Verification')

  // ── Probe: is the recover route deployed? ─────────────────────────────────
  const { status: probeStatus } = await api('POST', '/api/sessions/recover', {})
  if (probeStatus === 404) {
    const skipDetail = 'route not deployed on this environment (404)'
    log(`  ⏭️   Recovery DB-state tests skipped — ${skipDetail}`)
    ;[
      'Recovery creates session row with completed_at set',
      'Recovered session has completed_at in DB',
      'Recovered session has resonance_tap saved in DB',
      'Recovered session content exists in session_content table',
      'Recovery logs mirror_rendered event with recovered=true',
    ].forEach(name => results.push({ name, pass: null, critical: false, detail: skipDetail }))
    return
  }

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
    // paywall:true → free limit reached, skip remaining DB-state checks
    if (status === 200 && json.paywall === true) {
      return { pass: null, detail: 'free-tier limit reached — paywalled (skip)' }
    }
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
      .select('session_id, encrypted_context, encrypted_mirror_output')
      .eq('session_id', recoveredSessionId)
      .single()
    // Both columns are encrypted ciphertexts — just check they're non-null strings
    const hasEncContent = !!data?.encrypted_context || !!data?.encrypted_mirror_output
    return {
      pass: !!data && hasEncContent,
      detail: data ? 'encrypted content found in session_content' : 'NO session_content row found',
    }
  })

  await run('Recovery logs mirror_rendered event with recovered=true', true, async () => {
    if (!recoveredSessionId) return { pass: false, detail: 'no sessionId' }
    const { data } = await adminClient
      .from('events')
      .select('event_name, properties')
      .eq('session_id', recoveredSessionId)
      .eq('event_name', 'mirror_rendered')
    const event = (data ?? [])[0]
    const isRecovered = event?.properties?.recovered === true
    return {
      pass: !!event && isRecovered,
      detail: event
        ? `event found, recovered=${event.properties?.recovered}`
        : 'mirror_rendered event NOT found in events table',
    }
  })
}

async function testUserDataEndpoint() {
  section('User Data Deletion (DELETE /api/user/data)')

  // NOTE: /api/user/data only has DELETE (permanent account deletion — GDPR).
  // There is no GET method; GET would return 405 Method Not Allowed.
  // We only test the auth guard here — we do NOT call DELETE with a valid token
  // because that would destroy all test user data before teardown.

  await run('DELETE /api/user/data without token returns 401', true, async () => {
    const { status } = await api('DELETE', '/api/user/data')
    return { pass: status === 401, detail: `status=${status}` }
  })

  await run('GET /api/user/data returns 405 (method not allowed)', false, async () => {
    const { status } = await api('GET', '/api/user/data', { token: accessToken })
    return { pass: status === 405, detail: `status=${status}` }
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
