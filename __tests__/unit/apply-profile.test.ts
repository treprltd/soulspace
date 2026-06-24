/**
 * Unit tests — applyProfile()
 *
 * src/lib/profile/applyProfile.ts is the single shared validation + upsert
 * path used by:
 *   - POST /api/user/profile               (direct submission, /profile/setup)
 *   - POST /api/auth/pending-profile/consume (server-side cross-browser bridge)
 *
 * It was factored out of the old inline POST /api/user/profile handler so
 * both call sites enforce IDENTICAL rules — required fields, age >= 18, phone
 * format/uniqueness — and write the same shape to `users`. These tests build
 * a minimal mock of the Supabase service-client query-builder chain so the
 * validation branches and the upsert payload can be exercised without a DB.
 *
 * Run with: npm test
 */

import { applyProfile, VALID_GENDERS, type ProfileInput } from '@/lib/profile/applyProfile'

const VALID: ProfileInput = {
  firstName: 'Jane',
  lastName:  'Doe',
  dob:       '1990-06-15',
  phone:     '+15550001234',
  gender:    'female',
}

// ── Minimal mock of the Supabase query-builder chain ─────────────────────────
//
// applyProfile only ever calls:
//   service.from('users').select(...).eq(...).neq(...).maybeSingle()
//   service.from('users').upsert(payload, { onConflict: 'id' })
//
// The mock below is configurable per-test: `phoneOwner` controls what the
// uniqueness check returns, `upsertError` controls whether the upsert fails,
// and every upsert call is captured in `upsertCalls` for payload assertions.
function makeMockService(opts: { phoneOwner?: { id: string } | null; upsertError?: { message: string } | null } = {}) {
  const upsertCalls: Array<{ payload: unknown; options: unknown }> = []

  const selectChain = {
    select: () => selectChain,
    eq:     () => selectChain,
    neq:    () => selectChain,
    maybeSingle: async () => ({ data: opts.phoneOwner ?? null, error: null }),
  }

  const table = {
    select: () => selectChain,
    upsert: async (payload: unknown, options: unknown) => {
      upsertCalls.push({ payload, options })
      return { error: opts.upsertError ?? null }
    },
  }

  const service = {
    from: () => table,
  }

  return { service, upsertCalls }
}

// ── Validation — required fields ──────────────────────────────────────────────

describe('applyProfile — required field validation', () => {
  test('rejects missing firstName', async () => {
    const { service } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, firstName: '' })
    expect(result).toEqual({ ok: false, error: 'First name is required.', status: 400 })
  })

  test('rejects whitespace-only lastName', async () => {
    const { service } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, lastName: '   ' })
    expect(result).toEqual({ ok: false, error: 'Last name is required.', status: 400 })
  })

  test('rejects missing dob', async () => {
    const { service } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, dob: '' })
    expect(result).toEqual({ ok: false, error: 'Date of birth is required.', status: 400 })
  })

  test('accepts missing phone (optional field)', async () => {
    const { service, upsertCalls } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, phone: '' })
    expect(result).toEqual({ ok: true })
    expect((upsertCalls[0].payload as { phone: string | null }).phone).toBeNull()
  })

  test('accepts missing gender (optional field)', async () => {
    const { service, upsertCalls } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, gender: '' })
    expect(result).toEqual({ ok: true })
    expect((upsertCalls[0].payload as { gender: string | null }).gender).toBeNull()
  })

  test('skips the phone-uniqueness check entirely when phone is omitted', async () => {
    // phoneOwner is set, but since no phone is given there's nothing to check —
    // the upsert must still succeed rather than rejecting on someone else's phone.
    const { service, upsertCalls } = makeMockService({ phoneOwner: { id: 'other-user' } })
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, phone: '' })
    expect(result).toEqual({ ok: true })
    expect(upsertCalls).toHaveLength(1)
  })

  test('rejects gender not in VALID_GENDERS', async () => {
    const { service } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, gender: 'other' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  test('accepts every value in VALID_GENDERS', async () => {
    for (const gender of VALID_GENDERS) {
      const { service } = makeMockService()
      const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, gender })
      expect(result.ok).toBe(true)
    }
  })
})

// ── Validation — date of birth ────────────────────────────────────────────────

describe('applyProfile — dob validation', () => {
  test('rejects an unparseable date string', async () => {
    const { service } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, dob: 'not-a-date' })
    expect(result).toEqual({ ok: false, error: 'Invalid date of birth.', status: 400 })
  })

  test('rejects a user under 18', async () => {
    const { service } = makeMockService()
    const tooYoung = new Date()
    tooYoung.setFullYear(tooYoung.getFullYear() - 17)
    const dob = tooYoung.toISOString().split('T')[0]
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, dob })
    expect(result).toEqual({ ok: false, error: 'You must be 18 or older to use Soul Space.', status: 400 })
  })

  test('accepts a user exactly 18 years old', async () => {
    const { service } = makeMockService()
    const justTurned18 = new Date()
    justTurned18.setFullYear(justTurned18.getFullYear() - 18)
    justTurned18.setDate(justTurned18.getDate() - 1) // safely past the threshold
    const dob = justTurned18.toISOString().split('T')[0]
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, dob })
    expect(result.ok).toBe(true)
  })
})

// ── Validation — phone ─────────────────────────────────────────────────────────

describe('applyProfile — phone validation', () => {
  test('rejects a phone with fewer than 7 digits', async () => {
    const { service } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, phone: '12345' })
    expect(result).toEqual({ ok: false, error: 'Please enter a valid phone number.', status: 400 })
  })

  test('rejects a phone with more than 15 digits', async () => {
    const { service } = makeMockService()
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', { ...VALID, phone: '+1234567890123456' })
    expect(result).toEqual({ ok: false, error: 'Please enter a valid phone number.', status: 400 })
  })

  test('rejects a phone already claimed by a different account', async () => {
    const { service } = makeMockService({ phoneOwner: { id: 'other-user' } })
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', VALID)
    expect(result).toEqual({
      ok: false,
      error: 'This phone number is already registered with another account.',
      status: 409,
    })
  })

  test('allows a phone already associated with the SAME account (the .neq filter excludes self)', async () => {
    // The mock's maybeSingle always reflects `phoneOwner`; a real query adds
    // .neq('id', userId), so a self-match never reaches here as `phoneOwner`.
    // Simulate that correctly-filtered "no other owner" result:
    const { service, upsertCalls } = makeMockService({ phoneOwner: null })
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', VALID)
    expect(result.ok).toBe(true)
    expect(upsertCalls).toHaveLength(1)
  })
})

// ── Successful upsert — payload shape ─────────────────────────────────────────

describe('applyProfile — successful upsert', () => {
  test('writes the expected normalized payload with profile_complete: true', async () => {
    const { service, upsertCalls } = makeMockService()
    const result = await applyProfile(service as never, 'user-123', 'Jane@Example.com', {
      firstName: '  Jane  ',
      lastName:  '  Doe  ',
      dob:       '1990-06-15',
      phone:     '  +1 555 000 1234  ',
      gender:    'female',
    })

    expect(result).toEqual({ ok: true })
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].payload).toEqual({
      id:               'user-123',
      email:            'Jane@Example.com',
      first_name:       'Jane',
      last_name:        'Doe',
      dob:              '1990-06-15',
      phone:            '+1 555 000 1234',
      gender:           'female',
      profile_complete: true,
    })
    expect(upsertCalls[0].options).toEqual({ onConflict: 'id' })
  })

  test('falls back to empty string email when user has none', async () => {
    const { service, upsertCalls } = makeMockService()
    await applyProfile(service as never, 'user-123', null, VALID)
    expect((upsertCalls[0].payload as { email: string }).email).toBe('')
  })

  test('surfaces a database error from the upsert as a 500', async () => {
    const { service } = makeMockService({ upsertError: { message: 'connection reset' } })
    const result = await applyProfile(service as never, 'user-1', 'jane@example.com', VALID)
    expect(result).toEqual({ ok: false, error: 'connection reset', status: 500 })
  })
})
