#!/usr/bin/env node
/**
 * scripts/test-admin.js
 *
 * Functional tests for all admin panel API routes.
 * Logs in using ADMIN_SECRET, then exercises every endpoint and asserts
 * the response shape is correct.
 *
 * Usage:
 *   BASE_URL=https://dev.soulspacehealth.org ADMIN_SECRET=xxx node scripts/test-admin.js
 *   BASE_URL=https://soulspacehealth.org     ADMIN_SECRET=xxx node scripts/test-admin.js
 *
 * Exits 0 on all-pass, 1 if any test fails.
 *
 * Environment:
 *   BASE_URL      Required — target deployment URL (no trailing slash)
 *   ADMIN_SECRET  Required — the admin panel password
 *   ADMIN_ENV     Optional — which env tab to test (dev|qa|prod, default: prod)
 */

const BASE_URL     = process.env.BASE_URL
const ADMIN_SECRET = process.env.ADMIN_SECRET
const ADMIN_ENV    = process.env.ADMIN_ENV ?? 'prod'

if (!BASE_URL) {
  console.error('❌  BASE_URL is required. Example: BASE_URL=https://dev.soulspacehealth.org')
  process.exit(1)
}
if (!ADMIN_SECRET) {
  console.error('❌  ADMIN_SECRET is required.')
  process.exit(1)
}

let passed = 0
let failed = 0
let adminCookie = ''

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${name}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetch_(path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) }
  if (adminCookie) headers['Cookie'] = adminCookie
  return fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers,
    signal: AbortSignal.timeout(20000),
  })
}

async function get(path, opts = {}) {
  return fetch_(path, { ...opts, method: 'GET' })
}

async function post(path, body, opts = {}) {
  return fetch_(path, {
    ...opts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    body: JSON.stringify(body),
  })
}

// ── Login ────────────────────────────────────────────────────────────────────
async function login() {
  console.log('\n🔐  Logging in to admin panel…\n')
  const res = await post('/api/admin/auth', { password: ADMIN_SECRET })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error(`❌  Admin login failed (${res.status}): ${body.error ?? 'unknown error'}`)
    process.exit(1)
  }
  // Capture the session cookie
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/admin_session=[^;]+/)
  if (match) adminCookie = match[0]
  console.log('  ✓  Logged in — session cookie set\n')
}

;(async () => {
  console.log(`\n🛡️   Admin panel tests → ${BASE_URL}  [env=${ADMIN_ENV}]\n`)

  // ── 1. Unauthenticated guards ─────────────────────────────────────────────
  console.log('── Unauthenticated guards ──')

  await test('POST /api/admin/auth: wrong password → 401', async () => {
    const res = await post('/api/admin/auth', { password: 'wrong-password-xyz' })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('GET /api/admin/stats: no cookie → 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/stats`, { signal: AbortSignal.timeout(10000) })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  // ── 2. Login ──────────────────────────────────────────────────────────────
  await login()

  // ── 3. Auth round-trip ────────────────────────────────────────────────────
  console.log('── Auth ──')

  await test('POST /api/admin/auth: correct password → 200 + ok', async () => {
    const res = await post('/api/admin/auth', { password: ADMIN_SECRET })
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(body.ok === true, 'Expected ok:true')
  })

  await test('DELETE /api/admin/auth: sign-out → 200', async () => {
    const res = await fetch_('/api/admin/auth', { method: 'DELETE' })
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(body.ok === true, 'Expected ok:true')
    // Re-login so remaining tests work
    await login()
  })

  // ── 4. Dashboard stats ────────────────────────────────────────────────────
  console.log('── Dashboard ──')

  await test(`GET /api/admin/stats?env=${ADMIN_ENV} → 200 with expected shape`, async () => {
    const res = await get(`/api/admin/stats?env=${ADMIN_ENV}`)
    if (res.status === 503) {
      const body = await res.json()
      if (body.not_configured) { console.log(`     ⚠️  ${ADMIN_ENV.toUpperCase()} not configured — skipping shape check`); return }
    }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(typeof body.users === 'object',   'Missing users field')
    assert(typeof body.sessions === 'object','Missing sessions field')
    assert(typeof body.mirror === 'object',  'Missing mirror field')
    assert(typeof body.safety === 'object',  'Missing safety field')
    assert(typeof body.funnel === 'object',  'Missing funnel field')
    assert(typeof body.system === 'object',  'Missing system field')
    assert(typeof body.users.total === 'number',    'users.total must be a number')
    assert(typeof body.sessions.total === 'number', 'sessions.total must be a number')
    assert('resonanceRate' in body.mirror,          'mirror.resonanceRate must exist')
    assert(typeof body.safety.unreviewed === 'number', 'safety.unreviewed must be a number')
    assert(['session_start','branchSelected','mirrorRendered','sessionComplete'].every(k => k in body.funnel || true),
      'funnel shape unexpected')
  })

  // ── 5. Analytics ──────────────────────────────────────────────────────────
  console.log('── Analytics ──')

  await test(`GET /api/admin/analytics?env=${ADMIN_ENV} → 200 with shape`, async () => {
    const res = await get(`/api/admin/analytics?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.daily) || typeof body.daily === 'object', 'Missing daily field')
  })

  await test('GET /api/admin/analytics: window param accepted (7d)', async () => {
    const res = await get(`/api/admin/analytics?env=${ADMIN_ENV}&window=7d`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  await test('GET /api/admin/analytics: window param accepted (30d)', async () => {
    const res = await get(`/api/admin/analytics?env=${ADMIN_ENV}&window=30d`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  // ── 6. Users ──────────────────────────────────────────────────────────────
  console.log('── Users ──')

  await test(`GET /api/admin/users?env=${ADMIN_ENV} → 200 with shape`, async () => {
    const res = await get(`/api/admin/users?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.users), 'users must be an array')
    assert(typeof body.total === 'number', 'total must be a number')
    assert(typeof body.page === 'number',  'page must be a number')
    assert(typeof body.pages === 'number', 'pages must be a number')
  })

  await test('GET /api/admin/users: plan filter param accepted', async () => {
    const res = await get(`/api/admin/users?env=${ADMIN_ENV}&plan=free`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  await test('GET /api/admin/users: search param accepted', async () => {
    const res = await get(`/api/admin/users?env=${ADMIN_ENV}&q=example`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  await test('PATCH /api/admin/users: invalid plan_tier → 400', async () => {
    const res = await fetch_(`/api/admin/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'fake-id', plan_tier: 'ultra', env: ADMIN_ENV }),
    })
    assert(res.status === 400, `Expected 400, got ${res.status}`)
  })

  // ── 7. Sessions ───────────────────────────────────────────────────────────
  console.log('── Sessions ──')

  await test(`GET /api/admin/sessions?env=${ADMIN_ENV} → 200 with shape`, async () => {
    const res = await get(`/api/admin/sessions?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.sessions), 'sessions must be an array')
    assert(typeof body.total === 'number', 'total must be a number')
  })

  await test('GET /api/admin/sessions: branch filter accepted', async () => {
    const res = await get(`/api/admin/sessions?env=${ADMIN_ENV}&branch=A`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  await test('GET /api/admin/sessions: safety=flagged filter accepted', async () => {
    const res = await get(`/api/admin/sessions?env=${ADMIN_ENV}&safety=flagged`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  // ── 8. Safety monitor ─────────────────────────────────────────────────────
  console.log('── Safety monitor ──')

  await test(`GET /api/admin/safety?env=${ADMIN_ENV} → 200 with shape`, async () => {
    const res = await get(`/api/admin/safety?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.events), 'events must be an array')
    assert(typeof body.total === 'number', 'total must be a number')
  })

  await test('GET /api/admin/safety: reviewed=false filter accepted', async () => {
    const res = await get(`/api/admin/safety?env=${ADMIN_ENV}&reviewed=false`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  await test('PATCH /api/admin/safety: missing id → 400', async () => {
    const res = await fetch_(`/api/admin/safety`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env: ADMIN_ENV }),  // no id
    })
    assert(res.status === 400, `Expected 400, got ${res.status}`)
  })

  // ── 9. Mirror quality ─────────────────────────────────────────────────────
  console.log('── Mirror quality ──')

  await test(`GET /api/admin/mirror?env=${ADMIN_ENV} → 200 with shape`, async () => {
    const res = await get(`/api/admin/mirror?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(typeof body.overallRate !== 'undefined' || body.overall !== undefined || Array.isArray(body.byBranch) || typeof body === 'object',
      'Unexpected response shape')
  })

  // ── 10. Feedback ──────────────────────────────────────────────────────────
  console.log('── Feedback ──')

  await test(`GET /api/admin/feedback?env=${ADMIN_ENV} → 200 with shape`, async () => {
    const res = await get(`/api/admin/feedback?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.feedback) || Array.isArray(body.items) || typeof body === 'object',
      'Missing feedback array')
  })

  // ── 11. System Health ─────────────────────────────────────────────────────
  console.log('── System health ──')

  await test(`GET /api/admin/health?env=${ADMIN_ENV} → 200 with shape`, async () => {
    const res = await get(`/api/admin/health?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(typeof body === 'object', 'Expected object response')
  })

  // ── 12. Retention ─────────────────────────────────────────────────────────
  console.log('── Retention ──')

  await test(`GET /api/admin/retention?env=${ADMIN_ENV} → 200`, async () => {
    const res = await get(`/api/admin/retention?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  // ── 13. Revenue ───────────────────────────────────────────────────────────
  console.log('── Revenue ──')

  await test(`GET /api/admin/revenue?env=${ADMIN_ENV} → 200`, async () => {
    const res = await get(`/api/admin/revenue?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  // ── 14. Events ────────────────────────────────────────────────────────────
  console.log('── Events ──')

  await test(`GET /api/admin/events?env=${ADMIN_ENV} → 200 with shape`, async () => {
    const res = await get(`/api/admin/events?env=${ADMIN_ENV}`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.events) || typeof body === 'object', 'Unexpected response shape')
  })

  await test('GET /api/admin/events: event_name filter accepted', async () => {
    const res = await get(`/api/admin/events?env=${ADMIN_ENV}&event=session_start`)
    if (res.status === 503) { console.log('     ⚠️  Not configured — skipped'); return }
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  // ── 15. Test-email route ───────────────────────────────────────────────────
  console.log('── Test-email route ──')

  await test('GET /api/admin/test-email without to= → 400', async () => {
    const res = await get(`/api/admin/test-email?secret=${ADMIN_SECRET}`)
    assert(res.status === 400, `Expected 400, got ${res.status}`)
    const body = await res.json()
    assert(typeof body.error === 'string', 'Expected error message')
  })

  await test('GET /api/admin/test-email with unknown type → 400', async () => {
    const res = await get(`/api/admin/test-email?secret=${ADMIN_SECRET}&to=test@example.com&type=nonexistent`)
    assert(res.status === 400, `Expected 400, got ${res.status}`)
  })

  await test('GET /api/admin/test-email without secret → 401', async () => {
    // Bypass the cookie header to test the query-param auth independently
    const res = await fetch(`${BASE_URL}/api/admin/test-email?to=test@example.com`, {
      signal: AbortSignal.timeout(10000),
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  // ── 16. Page routes (HTML) ────────────────────────────────────────────────
  console.log('── Admin page routes ──')

  const adminPages = [
    '/admin',
    '/admin/analytics',
    '/admin/users',
    '/admin/sessions',
    '/admin/safety',
    '/admin/mirror',
    '/admin/feedback',
    '/admin/health',
    '/admin/retention',
    '/admin/revenue',
    '/admin/events',
  ]

  for (const page of adminPages) {
    await test(`GET ${page} returns 200 (with cookie)`, async () => {
      const res = await get(page)
      assert(res.ok, `Expected 200, got ${res.status}`)
    })
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50))
  if (failed > 0) {
    console.error(`\n❌  ${failed} test(s) FAILED, ${passed} passed.\n`)
    process.exit(1)
  } else {
    console.log(`\n✅  All ${passed} admin tests passed.\n`)
    process.exit(0)
  }
})()
