/**
 * Unit tests — recoverSession() / RecoverSchema
 *
 * src/lib/sessions/recoverSession.ts is the single shared validation + write
 * path used by:
 *   - POST /api/sessions/recover                (localStorage bridge, same browser)
 *   - POST /api/auth/pending-session/consume    (server-side cross-browser bridge)
 *
 * It was factored out of the old inline POST /api/sessions/recover handler so
 * both call sites enforce IDENTICAL rules — TTL, free-tier quota, schema —
 * and write the exact same shape to `sessions` / `session_content` with the
 * same `recovered: true` analytics flag. These tests build a minimal mock of
 * the Supabase service-client query-builder chain so each branch (TTL expiry,
 * paywall, malformed mirror output, success) can be exercised without a DB.
 *
 * Run with: npm test
 */

// recoverSession() encrypts contextText/mirrorOutput via src/lib/encryption
// (AES-256-GCM, CLAUDE.md rule #6) — that module requires a 64-hex-char
// (32-byte) ENCRYPTION_KEY at call time. Provide a deterministic test-only
// key so the encrypt() calls inside recoverSession succeed; this never
// touches real data or real keys.
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import { recoverSession, RecoverSchema, SESSION_TTL_MS } from '@/lib/sessions/recoverSession'

const VALID_MIRROR = JSON.stringify({ season: 'Su', safetyFlagged: false })

const VALID_INPUT = {
  branch:       'A' as const,
  situation:    'work-career',
  contextText:  'Something about a decision at work.',
  mirrorOutput: VALID_MIRROR,
  emotions:     '["uneasy","tired"]',
  intensity:    6,
  resonanceTap: 'accurate' as const,
  savedAt:      Date.now(),
}

// ── Minimal mock of the Supabase query-builder chain ─────────────────────────
//
// recoverSession only ever calls:
//   db.from('users').select('plan_tier').eq('id', userId).single()
//   db.from('sessions').select(..., { count: 'exact', head: true }).eq(...).gte(...)
//   db.from('sessions').insert(payload).select('id').single()
//   db.from('session_content').insert(payload)
//   db.from('events').insert(payload)
function makeMockDb(opts: {
  planTier?: string | null
  sessionCountThisMonth?: number
  insertSessionError?: { message: string } | null
  insertedSessionId?: string
} = {}) {
  const inserts: Record<string, unknown[]> = { sessions: [], session_content: [], events: [] }

  const usersTable = {
    select: () => usersTable,
    eq:     () => usersTable,
    single: async () => ({ data: opts.planTier === undefined ? { plan_tier: 'free' } : (opts.planTier ? { plan_tier: opts.planTier } : null), error: null }),
  }

  const countChain = {
    select: () => countChain,
    eq:     () => countChain,
    gte:    async () => ({ count: opts.sessionCountThisMonth ?? 0 }),
  }

  const sessionsInsertChain = {
    select: () => sessionsInsertChain,
    single: async () => {
      if (opts.insertSessionError) return { data: null, error: opts.insertSessionError }
      return { data: { id: opts.insertedSessionId ?? 'session-123' }, error: null }
    },
  }

  const sessionsTable = {
    select: (...args: unknown[]) => {
      // Distinguish the count query (head:true option) from a plain select
      const isCountQuery = typeof args[1] === 'object' && args[1] !== null && 'count' in (args[1] as object)
      return isCountQuery ? countChain : sessionsTable
    },
    insert: (payload: unknown) => {
      inserts.sessions.push(payload)
      return sessionsInsertChain
    },
  }

  const genericInsertTable = (name: string) => ({
    insert: async (payload: unknown) => {
      inserts[name].push(payload)
      return { error: null }
    },
  })

  const db = {
    from: (table: string) => {
      if (table === 'users') return usersTable
      if (table === 'sessions') return sessionsTable
      return genericInsertTable(table)
    },
  }

  return { db, inserts }
}

// ── RecoverSchema ──────────────────────────────────────────────────────────────

describe('RecoverSchema', () => {
  test('accepts a fully-populated valid payload', () => {
    expect(RecoverSchema.safeParse(VALID_INPUT).success).toBe(true)
  })

  test('rejects an invalid branch', () => {
    expect(RecoverSchema.safeParse({ ...VALID_INPUT, branch: 'Z' }).success).toBe(false)
  })

  test('coerces a string intensity to a number', () => {
    const result = RecoverSchema.safeParse({ ...VALID_INPUT, intensity: '7' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.intensity).toBe(7)
  })

  test('rejects intensity out of 1-10 range', () => {
    expect(RecoverSchema.safeParse({ ...VALID_INPUT, intensity: 11 }).success).toBe(false)
    expect(RecoverSchema.safeParse({ ...VALID_INPUT, intensity: 0 }).success).toBe(false)
  })

  test('defaults contextText to empty string when omitted', () => {
    const { contextText: _omit, ...rest } = VALID_INPUT
    void _omit
    const result = RecoverSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.contextText).toBe('')
  })

  test('defaults resonanceTap to null when omitted', () => {
    const { resonanceTap: _omit, ...rest } = VALID_INPUT
    void _omit
    const result = RecoverSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.resonanceTap).toBeNull()
  })

  test('rejects a missing mirrorOutput', () => {
    const { mirrorOutput: _omit, ...rest } = VALID_INPUT
    void _omit
    expect(RecoverSchema.safeParse(rest).success).toBe(false)
  })
})

// ── recoverSession — TTL ───────────────────────────────────────────────────────

describe('recoverSession — TTL', () => {
  test('rejects a payload older than the 1-hour TTL', async () => {
    const { db } = makeMockDb()
    const stale = { ...VALID_INPUT, savedAt: Date.now() - SESSION_TTL_MS - 1000 }
    const result = await recoverSession(db as never, 'user-1', stale)
    expect(result).toEqual({
      ok: false,
      status: 410,
      error: 'Session data has expired — it can only be recovered within 1 hour of completion.',
    })
  })

  test('accepts a payload just inside the TTL window', async () => {
    const { db } = makeMockDb()
    const fresh = { ...VALID_INPUT, savedAt: Date.now() - (SESSION_TTL_MS - 60_000) }
    const result = await recoverSession(db as never, 'user-1', fresh)
    expect(result.ok).toBe(true)
  })
})

// ── recoverSession — free-tier quota ───────────────────────────────────────────

describe('recoverSession — free-tier quota', () => {
  test('blocks recovery with a paywall response when the free quota is reached', async () => {
    const { db, inserts } = makeMockDb({ planTier: 'free', sessionCountThisMonth: 1 })
    const result = await recoverSession(db as never, 'user-1', VALID_INPUT)
    expect(result).toEqual({ ok: false, status: 200, paywall: true })
    expect(inserts.sessions).toHaveLength(0) // never wrote a row
  })

  test('allows recovery when under the free quota', async () => {
    const { db } = makeMockDb({ planTier: 'free', sessionCountThisMonth: 0 })
    const result = await recoverSession(db as never, 'user-1', VALID_INPUT)
    expect(result.ok).toBe(true)
  })

  test('skips the quota check entirely for paid plans', async () => {
    const { db, inserts } = makeMockDb({ planTier: 'essentials', sessionCountThisMonth: 99 })
    const result = await recoverSession(db as never, 'user-1', VALID_INPUT)
    expect(result.ok).toBe(true)
    expect(inserts.sessions).toHaveLength(1)
  })

  test('treats a missing plan_tier as free (defensive default)', async () => {
    const { db } = makeMockDb({ planTier: null, sessionCountThisMonth: 1 })
    const result = await recoverSession(db as never, 'user-1', VALID_INPUT)
    expect(result).toEqual({ ok: false, status: 200, paywall: true })
  })
})

// ── recoverSession — mirror output parsing ────────────────────────────────────

describe('recoverSession — mirror output', () => {
  test('rejects unparseable mirrorOutput JSON', async () => {
    const { db } = makeMockDb()
    const result = await recoverSession(db as never, 'user-1', { ...VALID_INPUT, mirrorOutput: 'not-json{' })
    expect(result).toEqual({ ok: false, status: 400, error: 'Invalid mirror output' })
  })

  test('writes season_assigned and safety_flagged from the parsed mirror output', async () => {
    const { db, inserts } = makeMockDb()
    await recoverSession(db as never, 'user-1', {
      ...VALID_INPUT,
      mirrorOutput: JSON.stringify({ season: 'Au', safetyFlagged: true }),
    })
    const row = inserts.sessions[0] as { season_assigned: string; safety_flagged: boolean }
    expect(row.season_assigned).toBe('Au')
    expect(row.safety_flagged).toBe(true)
  })
})

// ── recoverSession — successful write shape ───────────────────────────────────

describe('recoverSession — successful write', () => {
  test('writes the expected session row, encrypted content, and recovered analytics event', async () => {
    const { db, inserts } = makeMockDb({ insertedSessionId: 'sess-abc' })
    const result = await recoverSession(db as never, 'user-xyz', VALID_INPUT)

    expect(result).toEqual({ ok: true, sessionId: 'sess-abc' })

    const sessionRow = inserts.sessions[0] as Record<string, unknown>
    expect(sessionRow).toMatchObject({
      user_id:        'user-xyz',
      branch:         'A',
      situation:      'work-career',
      intensity:      6,
      season_assigned: 'Su',
      char_count:     VALID_INPUT.contextText.length,
      safety_flagged: false,
      resonance_tap:  'accurate',
    })
    expect(sessionRow.completed_at).toBeDefined()

    expect(inserts.session_content).toHaveLength(1)
    const contentRow = inserts.session_content[0] as Record<string, unknown>
    expect(contentRow.session_id).toBe('sess-abc')
    expect(contentRow.encrypted_context).toBeDefined()
    expect(contentRow.encrypted_mirror_output).toBeDefined()
    // Never store plaintext (CLAUDE.md rule #6)
    expect(contentRow.encrypted_context).not.toBe(VALID_INPUT.contextText)
    expect(contentRow.encrypted_mirror_output).not.toBe(VALID_INPUT.mirrorOutput)

    expect(inserts.events).toHaveLength(1)
    const eventRow = inserts.events[0] as { event_name: string; properties: { branch: string; recovered: boolean } }
    expect(eventRow.event_name).toBe('mirror_rendered')
    expect(eventRow.properties).toEqual({ branch: 'A', recovered: true })
  })

  test('omits situation from the row when not provided', async () => {
    const { situation: _omit, ...rest } = VALID_INPUT
    void _omit
    const { db, inserts } = makeMockDb()
    await recoverSession(db as never, 'user-1', rest)
    const row = inserts.sessions[0] as Record<string, unknown>
    expect(row).not.toHaveProperty('situation')
  })

  test('surfaces a database error from the session insert as a 500', async () => {
    const { db } = makeMockDb({ insertSessionError: { message: 'connection reset' } })
    const result = await recoverSession(db as never, 'user-1', VALID_INPUT)
    expect(result).toEqual({ ok: false, status: 500, error: 'connection reset' })
  })
})
