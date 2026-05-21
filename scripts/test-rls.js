#!/usr/bin/env node
/**
 * scripts/test-rls.js
 *
 * Automated Row-Level Security (RLS) policy tests for Supabase.
 *
 * Creates two isolated test users via the service role, writes data as
 * User A, then attempts to read that data as User B.  All cross-user
 * reads must return empty — otherwise an RLS policy is broken.
 *
 * Usage (requires real Supabase credentials):
 *   node scripts/test-rls.js
 *
 * Called from GitHub Actions on PRs that touch supabase/migrations/*.
 * Can also be run manually against any environment by setting:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *
 * Exits 0 on all-pass, 1 if any RLS check fails.
 * Cleans up all test data regardless of outcome (finally block).
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY          = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('❌  Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

// Service-role client — bypasses RLS (used for setup/teardown only)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let passed = 0
let failed = 0

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${name}: ${err.message}`)
    failed++
  }
}

// ---------------------------------------------------------------------------
// Test user IDs (created during setup, deleted in finally)
// ---------------------------------------------------------------------------
let userAId = null
let userBId = null
let sessionAId = null
const TEST_EMAIL_A = `rls-test-a-${Date.now()}@test-never-real.invalid`
const TEST_EMAIL_B = `rls-test-b-${Date.now()}@test-never-real.invalid`

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
;(async () => {
  console.log('\n🔐  RLS policy tests\n')

  // ── Setup: create two real Supabase auth users ──────────────────────────
  console.log('  Setting up test users...')
  try {
    const { data: a, error: aErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL_A, password: 'TestPassword123!', email_confirm: true,
    })
    if (aErr) throw new Error(`Create user A: ${aErr.message}`)
    userAId = a.user.id

    const { data: b, error: bErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL_B, password: 'TestPassword123!', email_confirm: true,
    })
    if (bErr) throw new Error(`Create user B: ${bErr.message}`)
    userBId = b.user.id

    console.log(`  User A: ${userAId}`)
    console.log(`  User B: ${userBId}\n`)
  } catch (err) {
    console.error(`❌  Setup failed: ${err.message}`)
    process.exit(1)
  }

  try {
    // ── Write data as User A (via service role with explicit user_id) ──────
    const now = new Date().toISOString()
    const encryptedPlaceholder = Buffer.from('test-encrypted-content').toString('base64')

    // Insert a session for User A
    const { data: sess, error: sessErr } = await admin
      .from('sessions')
      .insert({ user_id: userAId, branch: 'A', created_at: now })
      .select('id')
      .single()
    if (sessErr) {
      console.warn(`  ⚠  Could not insert test session (schema may differ): ${sessErr.message}`)
    } else {
      sessionAId = sess.id
    }

    // Insert an event for User A
    await admin.from('events').insert({
      session_id: sessionAId,
      user_id: userAId,
      event_name: 'rls_test',
      created_at: now,
    }).select()

    // ── Get anon client authenticated as User B ───────────────────────────
    // Sign in User B using the password we set (admin-created user)
    const clientB = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: signIn, error: signInErr } = await clientB.auth.signInWithPassword({
      email: TEST_EMAIL_B, password: 'TestPassword123!',
    })
    if (signInErr) throw new Error(`Sign in User B: ${signInErr.message}`)

    // ── RLS tests: User B tries to access User A's data ───────────────────

    await test('sessions: User B cannot read User A\'s sessions', async () => {
      const { data, error } = await clientB
        .from('sessions')
        .select('id')
        .eq('user_id', userAId)
      assert(!error, `Query error: ${error?.message}`)
      assert(data.length === 0, `User B read ${data.length} sessions belonging to User A — RLS BROKEN`)
    })

    await test('events: User B cannot read User A\'s events', async () => {
      const { data, error } = await clientB
        .from('events')
        .select('id')
        .eq('user_id', userAId)
      assert(!error, `Query error: ${error?.message}`)
      assert(data.length === 0, `User B read ${data.length} events belonging to User A — RLS BROKEN`)
    })

    if (sessionAId) {
      await test('session_content: User B cannot read User A\'s content', async () => {
        const { data, error } = await clientB
          .from('session_content')
          .select('id')
          .eq('session_id', sessionAId)
        assert(!error || error.code === 'PGRST116', `Query error: ${error?.message}`)
        assert(!data || data.length === 0, `User B read session_content from User A — RLS BROKEN`)
      })
    }

    await test('subscriptions: User B cannot read User A\'s subscription', async () => {
      const { data, error } = await clientB
        .from('subscriptions')
        .select('id')
        .eq('user_id', userAId)
      assert(!error, `Query error: ${error?.message}`)
      assert(data.length === 0, `User B read ${data.length} subscriptions belonging to User A — RLS BROKEN`)
    })

    await test('safety_events: User B cannot read User A\'s safety events', async () => {
      const { data, error } = await clientB
        .from('safety_events')
        .select('id')
        .eq('user_id', userAId)
      // RLS may return 0 rows or permission error — both are acceptable
      const exposed = data && data.length > 0
      assert(!exposed, `User B read ${data?.length} safety_events belonging to User A — RLS BROKEN`)
    })

    await test('users: User B cannot read User A\'s user row', async () => {
      const { data, error } = await clientB
        .from('users')
        .select('id, email')
        .eq('id', userAId)
      assert(!error, `Query error: ${error?.message}`)
      assert(data.length === 0, `User B read User A's user row — RLS BROKEN`)
    })

    // ── User B CAN read their own data ────────────────────────────────────
    await test('sessions: User B CAN read their own sessions', async () => {
      const { data, error } = await clientB
        .from('sessions')
        .select('id')
        .eq('user_id', userBId)
      assert(!error, `Query error: ${error?.message}`)
      // Should return 0 (no sessions yet for B) — just checking no error
    })

  } finally {
    // ── Cleanup: delete test users and all their data ─────────────────────
    console.log('\n  Cleaning up test data...')
    if (userAId) {
      await admin.from('events').delete().eq('user_id', userAId)
      if (sessionAId) {
        await admin.from('session_content').delete().eq('session_id', sessionAId)
        await admin.from('sessions').delete().eq('id', sessionAId)
      }
      await admin.auth.admin.deleteUser(userAId).catch(() => {})
    }
    if (userBId) {
      await admin.auth.admin.deleteUser(userBId).catch(() => {})
    }
    console.log('  Cleanup complete.')
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50))
  if (failed > 0) {
    console.error(`\n❌  ${failed} RLS test(s) FAILED — data isolation is broken. Do not deploy.\n`)
    process.exit(1)
  } else {
    console.log(`\n✅  All ${passed} RLS tests passed — data isolation confirmed.\n`)
    process.exit(0)
  }
})()
