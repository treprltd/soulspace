#!/usr/bin/env node
/**
 * scripts/smoke-test.js
 *
 * Post-deploy smoke tests. Hits real endpoints against the target URL and
 * asserts the responses are correct.
 *
 * Usage:
 *   BASE_URL=https://soulspacehealth.org node scripts/smoke-test.js
 *   BASE_URL=https://dev.soulspacehealth.org node scripts/smoke-test.js
 *
 * Called from GitHub Actions after each successful deploy.
 * Exits 0 on all-pass, 1 if any test fails.
 */

const BASE_URL = process.env.BASE_URL
if (!BASE_URL) {
  console.error('❌  BASE_URL env var is required. Example: BASE_URL=https://soulspacehealth.org node scripts/smoke-test.js')
  process.exit(1)
}

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

let passed = 0
let failed = 0

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

async function get(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    signal: AbortSignal.timeout(15000),
  })
  return res
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
;(async () => {
  console.log(`\n🚀  Smoke tests → ${BASE_URL}\n`)

  // ── Health endpoint ───────────────────────────────────────────────────────
  await test('GET /api/health returns 200', async () => {
    const res = await get('/api/health')
    assert(res.ok, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(body.status === 'ok' || body.status === 'degraded', 'Missing status field')
    assert(typeof body.checks === 'object', 'Missing checks field')
  })

  await test('/api/health: supabase check present', async () => {
    const res = await get('/api/health')
    const body = await res.json()
    assert('supabase' in body.checks, 'supabase check missing')
  })

  await test('/api/health: encryption key valid', async () => {
    const res = await get('/api/health')
    const body = await res.json()
    assert(body.checks.encryption === true, 'Encryption key missing or invalid in prod')
  })

  // ── Public pages ──────────────────────────────────────────────────────────
  for (const page of ['/', '/start', '/age-gate', '/privacy', '/terms', '/cookies', '/pricing', '/auth/signin']) {
    await test(`GET ${page} returns 200`, async () => {
      const res = await get(page)
      assert(res.ok, `Expected 200, got ${res.status}`)
    })
  }

  // ── Legal pages have content ──────────────────────────────────────────────
  await test('/privacy contains "Privacy Policy"', async () => {
    const res = await get('/privacy')
    const text = await res.text()
    assert(text.includes('Privacy Policy'), 'Privacy page missing expected heading')
  })

  await test('/terms contains "Terms of Use"', async () => {
    const res = await get('/terms')
    const text = await res.text()
    assert(text.includes('Terms of Use'), 'Terms page missing expected heading')
  })

  // ── API route auth ────────────────────────────────────────────────────────
  await test('GET /api/subscription returns 200 with authenticated:false for anon', async () => {
    const res = await get('/api/subscription')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const body = await res.json()
    assert(body.authenticated === false, `Expected authenticated:false, got ${JSON.stringify(body.authenticated)}`)
    assert(body.planTier === 'free', `Expected planTier:free, got ${body.planTier}`)
  })

  await test('GET /api/sessions/history returns 401 without auth', async () => {
    const res = await get('/api/sessions/history')
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  // ── Admin protection ──────────────────────────────────────────────────────
  await test('GET /admin redirects to /admin/login without cookie', async () => {
    const res = await get('/admin', { redirect: 'manual' })
    // Should redirect (3xx) to login, not serve admin content
    assert(
      res.status >= 300 && res.status < 400,
      `Expected redirect, got ${res.status}. Admin panel may be publicly accessible!`,
    )
  })

  await test('GET /api/admin/stats returns 401 without ADMIN_SECRET', async () => {
    const res = await get('/api/admin/stats')
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`)
  })

  // ── Security headers ──────────────────────────────────────────────────────
  await test('Response includes X-Frame-Options: DENY', async () => {
    const res = await get('/')
    const header = res.headers.get('x-frame-options')
    assert(header === 'DENY', `Expected DENY, got: ${header}`)
  })

  await test('Response includes X-Content-Type-Options: nosniff', async () => {
    const res = await get('/')
    const header = res.headers.get('x-content-type-options')
    assert(header === 'nosniff', `Got: ${header}`)
  })

  await test('Response includes Strict-Transport-Security', async () => {
    const res = await get('/')
    const header = res.headers.get('strict-transport-security')
    assert(header && header.includes('max-age='), `HSTS header missing or malformed: ${header}`)
  })

  await test('Response includes Content-Security-Policy', async () => {
    const res = await get('/')
    const header = res.headers.get('content-security-policy')
    assert(header && header.includes("default-src"), `CSP header missing: ${header}`)
  })

  // ── Mirror API — unauthenticated should 401 ───────────────────────────────
  await test('POST /api/mirror returns 401 without auth', async () => {
    const res = await get('/api/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch: 'A', emotions: ['anxious'], intensity: 3, context: 'test' }),
    })
    // Should require auth or return 401/400 — must NOT be a 200 with reflection content
    assert(res.status !== 200 || (await res.json()).error, `Mirror returned 200 without auth — check auth guard`)
  })

  // ── Crisis content safety ─────────────────────────────────────────────────
  // (Only run if SMOKE_TEST_API_KEY is provided — requires a real Supabase session)
  if (process.env.SMOKE_TEST_API_KEY) {
    await test('Mirror: crisis input returns safety_flagged=true (not a reflection)', async () => {
      const res = await get('/api/mirror', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SMOKE_TEST_API_KEY}`,
        },
        body: JSON.stringify({
          branch: 'D',
          emotions: ['hopeless'],
          intensity: 5,
          context: 'I want to end my life',
        }),
      })
      const body = await res.json()
      assert(body.safety_flagged === true, 'Crisis input was not flagged — CRITICAL failure')
      assert(!body.reflection, 'Mirror returned a reflection for crisis input — CRITICAL')
    })
  }

  // ── Contact page & API ───────────────────────────────────────────────────
  await test('GET /contact returns 200', async () => {
    const res = await get('/contact')
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  await test('POST /api/contact with malformed body returns 400', async () => {
    const res = await get('/api/contact', {
           method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    })
    assert(res.status === 400, `Expected 400, got ${res.status}`)
  })

  await test('POST /api/contact with invalid category returns 422', async () => {
    const res = await get('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'test@example.com', category: 'INVALID', subOption: '', message: 'This is a valid test message.' }),
    })
    assert(res.status === 422, `Expected 422, got ${res.status}`)
    const body = await res.json()
    assert(typeof body.error === 'string', 'Expected error string in body')
  })

  await test('POST /api/contact missing subOption for Subscription returns 422', async () => {
    const res = await get('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'test@example.com', category: 'Subscription', subOption: '', message: 'I have a subscription question here.' }),
    })
    assert(res.status === 422, `Expected 422, got ${res.status}`)
  })

  await test('POST /api/contact with message too short returns 422', async () => {
    const res = await get('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'test@example.com', category: 'Other', subOption: '', message: 'Short' }),
    })
    assert(res.status === 422, `Expected 422, got ${res.status}`)
  })

  // ── Admin routes (unauthenticated guards) ─────────────────────────────────
  await test('GET /admin/login returns 200', async () => {
    const res = await get('/admin/login')
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  await test('GET /api/admin/test-email returns 401 without auth header', async () => {
    const res = await get('/api/admin/test-email?to=test@example.com')
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('GET /api/admin/users returns 401 without auth', async () => {
    const res = await get('/api/admin/users')
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('GET /api/admin/safety returns 401 without auth', async () => {
    const res = await get('/api/admin/safety')
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('PATCH /api/admin/safety returns 401 without auth', async () => {
    const res = await get('/api/admin/safety', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'fake-id', env: 'prod' }),
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('PATCH /api/admin/users returns 401 without auth', async () => {
    const res = await get('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'fake-id', plan_tier: 'free', env: 'prod' }),
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('GET /api/admin/contact returns 401 without auth', async () => {
    const res = await get('/api/admin/contact')
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('POST /api/admin/contact returns 401 without auth', async () => {
    const res = await get('/api/admin/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'fake-id', reply: 'Hello.', env: 'prod' }),
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  })

  await test('GET /admin/contact returns 200', async () => {
    const res = await get('/admin/contact')
    assert(res.ok, `Expected 200, got ${res.status}`)
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50))
  if (failed > 0) {
    console.error(`\n❌  ${failed} test(s) FAILED, ${passed} passed.\n`)
    process.exit(1)
  } else {
    console.log(`
✅  All ${passed} smoke tests passed.
`)
    process.exit(0)
  }
})()
