#!/usr/bin/env node
/**
 * Soul Space — Targeted Email Delivery Test
 *
 * Creates a real test user with a specified email address, fires every
 * notification path that sends to end-users, and verifies the API responses.
 * Use this to confirm actual email delivery before and after changes.
 *
 * Usage:
 *   node scripts/e2e-email-test.js
 *   TEST_EMAIL=you@example.com node scripts/e2e-email-test.js
 *
 * Required env vars (same as e2e-test.js):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   BASE_URL        Target app URL (default: https://soulspacehealth.org)
 *   TEST_EMAIL      Destination email (default: kankanamitra01@gmail.com)
 *   CRON_SECRET     If set, digest endpoints are also tested
 *   KEEP_USER       Set to "1" to skip teardown (so you can inspect the user)
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL     = process.env.BASE_URL   ?? 'https://soulspacehealth.org'
const TEST_EMAIL   = process.env.TEST_EMAIL ?? 'kankanamitra01@gmail.com'
const CRON_SECRET  = process.env.CRON_SECRET
const KEEP_USER    = process.env.KEEP_USER === '1'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const missingVars = [
  !SUPABASE_URL      && 'NEXT_PUBLIC_SUPABASE_URL',
  !SUPABASE_ANON_KEY && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  !SERVICE_ROLE_KEY  && 'SUPABASE_SERVICE_ROLE_KEY',
].filter(Boolean)

if (missingVars.length) {
  console.error('\n❌  Missing required env vars:', missingVars.join(', '))
  process.exit(1)
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const results = []
let testUser    = null
let accessToken = null
let testSessionId = null

const pad  = s => s.padEnd(55, ' ')
const sep  = () => console.log('─'.repeat(70))
const log  = m  => console.log(m)
const tick = (label, pass, detail) => {
  const icon = pass === true ? '✅' : pass === false ? '❌' : '⏭️ '
  console.log(`  ${icon}  ${pad(label)}${detail ?? ''}`)
  results.push({ label, pass, detail })
}

async function api(method, path, { body, token, cronSecret, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token)      headers['Authorization']   = `Bearer ${token}`
  if (cronSecret) headers['x-cron-secret']   = cronSecret

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (raw) return res
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { _raw: text } }
  return { status: res.status, json }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

async function setup() {
  log('\n🔧  SETUP')
  log(`    Target:  ${BASE_URL}`)
  log(`    Email:   ${TEST_EMAIL}\n`)

  // Delete any existing test user with this email (cleanup from previous run)
  const { data: existing } = await adminClient.auth.admin.listUsers()
  const prev = (existing?.users ?? []).find(u => u.email === TEST_EMAIL && u.user_metadata?.e2e_email_test)
  if (prev) {
    await adminClient.auth.admin.deleteUser(prev.id)
    log(`    Cleaned up previous test user (${prev.id})`)
  }

  // Create test user with the real email address
  const { data: { user }, error: createErr } = await adminClient.auth.admin.createUser({
    email: TEST_EMAIL,
    email_confirm: true,
    user_metadata: { e2e_email_test: true },
  })
  if (createErr || !user) throw new Error(`createUser failed: ${createErr?.message}`)
  testUser = user
  log(`  ✅  Test user created: ${TEST_EMAIL} (${user.id})`)

  // Generate OTP and exchange for session (avoids needing to click the magic link)
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_EMAIL,
  })
  if (linkErr || !linkData?.properties?.email_otp) throw new Error(`generateLink failed: ${linkErr?.message}`)

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: verifyErr } = await anonClient.auth.verifyOtp({
    email: TEST_EMAIL,
    token: linkData.properties.email_otp,
    type: 'email',
  })
  if (verifyErr || !authData?.session) throw new Error(`verifyOtp failed: ${verifyErr?.message}`)

  accessToken = authData.session.access_token
  log(`  ✅  Access token obtained (session valid for 1 hour)`)
}

// ── Teardown ──────────────────────────────────────────────────────────────────

async function teardown() {
  if (!testUser || KEEP_USER) {
    if (KEEP_USER) log('\n  ℹ️   KEEP_USER=1 — test user NOT deleted (inspect in Supabase dashboard)')
    return
  }
  log('\n🧹  TEARDOWN')
  await adminClient.auth.admin.deleteUser(testUser.id)
  log(`  Deleted test user ${testUser.id}`)
}

// ── Email test suites ─────────────────────────────────────────────────────────

async function testWelcomeEmailDelivery() {
  sep()
  log('📧  WELCOME EMAIL — delivered to: ' + TEST_EMAIL)
  sep()
  log('')

  // New user (0 sessions) → should send
  const { status, json } = await api('POST', '/api/user/welcome', { token: accessToken })
  tick(
    'POST /api/user/welcome → sends to new user',
    status === 200 && json.sent === true,
    `status=${status}  sent=${json.sent}  skipped=${json.skipped ?? false}`,
  )

  if (json.sent) {
    log('')
    log('  📬  Welcome email queued for delivery to ' + TEST_EMAIL)
    log('      Subject: "Welcome to Soul Space"')
    log('      From:    noreply@soulspacehealth.org')
    log('      Check inbox (and spam folder) in ~60 seconds.')
    log('')
  }

  // Call again after session is created → should skip (idempotency)
  // First create a session to simulate returning user
  const { status: sStatus, json: sJson } = await api('POST', '/api/sessions', {
    token: accessToken,
    body: { branch: 'B' },
  })
  if (sStatus === 201) testSessionId = sJson.session?.id

  const { status: s2, json: j2 } = await api('POST', '/api/user/welcome', { token: accessToken })
  tick(
    'POST /api/user/welcome is idempotent (skips returning user)',
    s2 === 200 && j2.skipped === true,
    `status=${s2}  skipped=${j2.skipped}  reason=${j2.reason ?? ''}`,
  )
}

async function testSessionFlow() {
  sep()
  log('🔄  SESSION FLOW (authenticated)')
  sep()
  log('')

  // Subscription status
  const { status: subStatus, json: sub } = await api('GET', '/api/subscription', { token: accessToken })
  tick(
    'GET /api/subscription returns plan data',
    subStatus === 200 && typeof sub.planTier === 'string',
    `tier=${sub.planTier}  sessions=${sub.sessionsThisMonth}  limit=${sub.limit}`,
  )

  // Session history
  const { status: histStatus, json: hist } = await api('GET', '/api/sessions/history', { token: accessToken })
  tick(
    'GET /api/sessions/history returns array',
    histStatus === 200 && Array.isArray(hist.sessions),
    `count=${hist.sessions?.length ?? 'n/a'}`,
  )

  // Create a session (may already exist from welcome test)
  if (!testSessionId) {
    const { status: cs, json: cj } = await api('POST', '/api/sessions', {
      token: accessToken,
      body: { branch: 'C' },
    })
    tick(
      'POST /api/sessions creates session',
      cs === 201 && !!cj.session?.id,
      `id=${cj.session?.id?.slice(0, 8) ?? 'none'}`,
    )
    if (cj.session?.id) testSessionId = cj.session.id
  } else {
    tick(
      'Session already created in welcome test',
      true,
      `id=${testSessionId.slice(0, 8)}`,
    )
  }

  // Complete session
  if (testSessionId) {
    const { status: compStatus } = await api('POST', `/api/sessions/${testSessionId}/complete`, { token: accessToken })
    tick(
      'POST /api/sessions/:id/complete marks done',
      compStatus === 200,
      `status=${compStatus}`,
    )

    // Resonance tap
    const { status: tapStatus } = await api('POST', `/api/sessions/${testSessionId}/resonance`, {
      token: accessToken,
      body: { result: 'accurate' },
    })
    tick(
      'POST /api/sessions/:id/resonance saves tap',
      tapStatus === 200,
      `status=${tapStatus}`,
    )
  }

  // Anonymous session recovery
  const fakeMirror = JSON.stringify({
    carrying: 'Email test carrying statement.', underneath: 'Email test underneath.',
    question: 'Email test question?', season: 'A', patternTags: ['clarity'], safetyFlagged: false,
  })
  const { status: recStatus, json: recJson } = await api('POST', '/api/sessions/recover', {
    token: accessToken,
    body: {
      branch: 'A', contextText: 'Email test context.', mirrorOutput: fakeMirror,
      emotions: JSON.stringify(['anxious']), intensity: 5, resonanceTap: 'accurate',
      savedAt: Date.now(),
    },
  })
  tick(
    'POST /api/sessions/recover creates recovered session',
    recStatus === 200 && recJson.ok === true,
    `status=${recStatus}  sessionId=${recJson.sessionId?.slice(0, 8) ?? 'none'}`,
  )
}

async function testAdminDigestDelivery() {
  sep()
  log('📊  ADMIN DIGEST EMAILS')
  sep()
  log('')

  if (!CRON_SECRET) {
    tick('POST /api/notifications/digest (admin_digest)', null, 'SKIPPED — set CRON_SECRET env var to enable')
    tick('POST /api/notifications/digest (user_digest)',  null, 'SKIPPED — set CRON_SECRET env var to enable')
    tick('POST /api/notifications/digest (all)',          null, 'SKIPPED — set CRON_SECRET env var to enable')
    log('')
    log('  ℹ️   Admin digest emails go to the ADMIN_EMAIL server env var, not to TEST_EMAIL.')
    log('      Set CRON_SECRET to run live digest tests.')
    return
  }

  // Admin digest — goes to ADMIN_EMAIL (server-side env, not TEST_EMAIL)
  const adminRes = await api('POST', '/api/notifications/digest?mode=admin_digest', { cronSecret: CRON_SECRET })
  const adminOk  = adminRes.status === 200 && adminRes.json.ok === true
  tick(
    'POST digest mode=admin_digest',
    adminOk,
    `status=${adminRes.status}  result=${JSON.stringify(adminRes.json.results?.adminDigest ?? {})}`,
  )
  if (adminOk) {
    const r = adminRes.json.results?.adminDigest
    if (r?.sent)    log('      📬  Admin daily digest sent to ADMIN_EMAIL')
    if (r?.skipped) log(`      ⏭️   Admin digest skipped — reason: ${r.reason ?? 'ADMIN_EMAIL not set on server'}`)
  }

  // User digest — re-engagement emails (sent to users inactive 7–30 days)
  const userRes = await api('POST', '/api/notifications/digest?mode=user_digest', { cronSecret: CRON_SECRET })
  const userOk  = userRes.status === 200 && userRes.json.ok === true
  const ud = userRes.json.results?.userDigest
  tick(
    'POST digest mode=user_digest',
    userOk,
    `status=${userRes.status}  sent=${ud?.sent ?? 0}  eligible=${ud?.eligible ?? 0}`,
  )
  if (userOk) {
    if ((ud?.sent ?? 0) === 0) {
      log('      ℹ️   No re-engagement emails sent — no users inactive 7–30 days')
      log('          (This is normal for fresh/active users — the test user was just created)')
    } else {
      log(`      📬  Re-engagement emails sent to ${ud.sent} users`)
    }
  }

  // All modes
  const allRes = await api('POST', '/api/notifications/digest?mode=all', { cronSecret: CRON_SECRET })
  tick(
    'POST digest mode=all (both pipelines)',
    allRes.status === 200 && allRes.json.ok === true,
    `status=${allRes.status}  keys=${Object.keys(allRes.json.results ?? {}).join(',')}`,
  )
}

async function testDigestAuthGuard() {
  sep()
  log('🔒  DIGEST ENDPOINT AUTH GUARDS')
  sep()
  log('')

  const { status: s1 } = await api('POST', '/api/notifications/digest?mode=admin_digest')
  tick('POST digest without cron secret → 401', s1 === 401, `status=${s1}`)

  const { status: s2 } = await api('GET', '/api/notifications/digest')
  tick('GET digest without secret param → 401',  s2 === 401, `status=${s2}`)

  const getWithSecret = await fetch(`${BASE_URL}/api/notifications/digest?secret=wrong-secret`)
  tick('GET digest with wrong secret → 401', getWithSecret.status === 401, `status=${getWithSecret.status}`)

  if (CRON_SECRET) {
    const validGet = await fetch(`${BASE_URL}/api/notifications/digest?secret=${encodeURIComponent(CRON_SECRET)}`)
    const vj = await validGet.json().catch(() => ({}))
    tick('GET digest with valid secret → 200', validGet.status === 200 && vj.ok === true, `status=${validGet.status}`)
  }
}

async function testNotificationBannerFields() {
  sep()
  log('🔔  NOTIFICATION BANNER DATA FIELDS')
  sep()
  log('')

  const { status, json } = await api('GET', '/api/subscription', { token: accessToken })
  const fields = { planTier: json.planTier, sessionsThisMonth: json.sessionsThisMonth, limit: json.limit }

  tick(
    'planTier present and is a string',
    typeof json.planTier === 'string',
    `planTier=${json.planTier}`,
  )
  tick(
    'sessionsThisMonth present and ≥0',
    typeof json.sessionsThisMonth === 'number' && json.sessionsThisMonth >= 0,
    `sessionsThisMonth=${json.sessionsThisMonth}`,
  )
  tick(
    'limit present and is a positive integer',
    Number.isInteger(json.limit) && json.limit > 0,
    `limit=${json.limit}`,
  )
  tick(
    'Session count reflects actual sessions created',
    (json.sessionsThisMonth ?? 0) >= 1,
    `sessions=${json.sessionsThisMonth} (expected ≥1 from test)`,
  )
}

async function testAdminPortalSecurity() {
  sep()
  log('🛡️   ADMIN PORTAL SECURITY')
  sep()
  log('')

  const routes = [
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

  const unauthFails = []
  const bearerFails = []

  for (const [method, path] of routes) {
    const { status: s1 } = await api(method, path)
    if (s1 !== 401) unauthFails.push(`${path} → ${s1}`)

    const { status: s2 } = await api(method, path, { token: accessToken })
    if (s2 !== 401) bearerFails.push(`${path} → ${s2}`)
  }

  tick(
    `All ${routes.length} admin routes reject without cookie`,
    unauthFails.length === 0,
    unauthFails.length > 0 ? unauthFails.join(' | ') : `all returned 401`,
  )
  tick(
    `All ${routes.length} admin routes reject user Bearer token`,
    bearerFails.length === 0,
    bearerFails.length > 0 ? bearerFails.join(' | ') : `all rejected Bearer token`,
  )

  const { status: authWrong } = await api('POST', '/api/admin/auth', { body: { password: 'wrong' } })
  tick('POST /api/admin/auth with wrong password → 401', authWrong === 401, `status=${authWrong}`)
}

async function testStripeRouteSecurity() {
  sep()
  log('💳  STRIPE ROUTE SECURITY')
  sep()
  log('')

  const { status: s1 } = await api('POST', '/api/stripe/checkout', { body: { planTier: 'essentials' } })
  tick('POST /api/stripe/checkout without token → 401', s1 === 401, `status=${s1}`)

  const { status: s2 } = await api('POST', '/api/stripe/portal', { body: {} })
  tick('POST /api/stripe/portal without token → 401', s2 === 401, `status=${s2}`)

  const webhookRes = await fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'checkout.session.completed' }),
  })
  tick('POST /api/stripe/webhook without stripe-signature → 400', webhookRes.status === 400, `status=${webhookRes.status}`)

  const { status: s4 } = await api('POST', '/api/stripe/checkout', {
    token: accessToken,
    body: { planTier: 'not_a_real_plan' },
  })
  tick('POST /api/stripe/checkout with invalid planTier → 400', s4 === 400, `status=${s4}`)
}

async function testPublicHealthCheck() {
  sep()
  log('🏥  HEALTH & PUBLIC ROUTES')
  sep()
  log('')

  const homeRes = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(10000) })
  tick('GET / (homepage) → 200', homeRes.status === 200, `status=${homeRes.status}`)

  const { status: hs, json: hj } = await api('GET', '/api/health')
  tick('GET /api/health returns valid response', (hs === 200 || hs === 503) && typeof hj.status === 'string', `health=${hj.status}`)
  tick('Supabase connectivity check passes', hj.checks?.supabase === true, `supabase=${hj.checks?.supabase}`)
  tick('Encryption key check passes', hj.checks?.encryption === true, `encryption=${hj.checks?.encryption}`)
}

// ── Final report ──────────────────────────────────────────────────────────────

function printReport() {
  sep()
  log('📋  SUMMARY')
  sep()

  const passed  = results.filter(r => r.pass === true).length
  const failed  = results.filter(r => r.pass === false).length
  const skipped = results.filter(r => r.pass === null).length

  log(`\n  ✅  ${passed} passed   ❌  ${failed} failed   ⏭️   ${skipped} skipped\n`)

  if (failed > 0) {
    log('  Failed tests:')
    results.filter(r => r.pass === false).forEach(r => {
      log(`    ❌  ${r.label}`)
      if (r.detail) log(`        ${r.detail}`)
    })
    log('')
  }

  log('  Emails delivered to ' + TEST_EMAIL + ':')
  log('    📧  Welcome email — subject: "Welcome to Soul Space"')
  log('        From: noreply@soulspacehealth.org via Brevo')
  log('        → Check inbox (and spam/promotions) within 60 seconds\n')

  if (CRON_SECRET) {
    log('  Admin digest email:')
    log('    📊  Sent to ADMIN_EMAIL (server env var) — not to TEST_EMAIL')
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('\n╔══════════════════════════════════════════════════════════════════════╗')
  log('║        Soul Space — Targeted Email & Notification Test               ║')
  log('╚══════════════════════════════════════════════════════════════════════╝')

  try {
    await setup()
  } catch (err) {
    log(`\n❌  Setup failed: ${err.message}`)
    process.exit(1)
  }

  try {
    await testWelcomeEmailDelivery()
    await testSessionFlow()
    await testNotificationBannerFields()
    await testDigestAuthGuard()
    await testAdminDigestDelivery()
    await testAdminPortalSecurity()
    await testStripeRouteSecurity()
    await testPublicHealthCheck()
  } finally {
    await teardown()
  }

  printReport()
  sep()
  log('')

  const failed = results.filter(r => r.pass === false).length
  if (failed > 0) {
    log(`  ❌  ${failed} test(s) failed — review output above\n`)
    process.exit(1)
  }
  log('  ✅  All tests passed.\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
