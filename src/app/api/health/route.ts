import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/health
 *
 * Lightweight liveness + dependency check used by:
 *   - Uptime monitors (UptimeRobot / Better Uptime)
 *   - Post-deploy smoke tests
 *   - Admin dashboard system health row
 *
 * Returns HTTP 200 when everything is reachable, 503 when a dependency is down.
 * Does NOT require authentication — uptime monitors need to call it unauthenticated.
 * Contains no user data.
 */
export async function GET() {
  const start = Date.now()
  const checks: Record<string, boolean> = {}

  // ── 1. Supabase reachability ──────────────────────────────────────────────
  try {
    const url   = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key   = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase env vars missing')

    const supabase = createClient(url, key, { auth: { persistSession: false } })
    // Lightweight query: count rows in events table (fast, small payload)
    const { error } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
    checks.supabase = !error
  } catch {
    checks.supabase = false
  }

  // ── 2. Anthropic API reachability ─────────────────────────────────────────
  // We don't make a real inference call — that's expensive and slow.
  // Instead, we check that the key is present and the API base responds.
  try {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key || !key.startsWith('sk-ant-')) throw new Error('Key missing or malformed')

    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(5000),
    })
    checks.anthropic = res.ok || res.status === 401 // 401 = API up, key may be wrong
  } catch {
    checks.anthropic = false
  }

  // ── 3. Encryption key present and valid length ────────────────────────────
  try {
    const key = process.env.ENCRYPTION_KEY ?? ''
    checks.encryption = key.length === 64 && /^[0-9a-f]+$/i.test(key)
  } catch {
    checks.encryption = false
  }

  const allOk  = Object.values(checks).every(Boolean)
  const elapsed = Date.now() - start

  return NextResponse.json(
    {
      status:  allOk ? 'ok' : 'degraded',
      checks,
      latencyMs: elapsed,
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_ENV ?? 'unknown',
      commit:  process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'unknown',
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        // Don't cache — every poll must be fresh
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}
