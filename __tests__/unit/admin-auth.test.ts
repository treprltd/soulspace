/**
 * Unit tests — src/lib/admin/auth.ts
 *
 * Tests isAdminAuthenticated() across all cases:
 *   - ADMIN_SECRET not configured → always false
 *   - Correct cookie value → true
 *   - Wrong cookie value → false
 *   - No cookie present → false
 *   - Empty ADMIN_SECRET → false (even if cookie matches)
 *
 * next/headers is mocked so we never touch real cookies.
 *
 * Run: npm test -- admin-auth
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockGet = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: mockGet,
  })),
}))

// ── SUT ──────────────────────────────────────────────────────────────────────
import { isAdminAuthenticated } from '@/lib/admin/auth'

// ── Helpers ──────────────────────────────────────────────────────────────────
const SECRET = 'super-secret-admin-password-123'

function withEnv(secret: string | undefined, fn: () => Promise<void>) {
  const original = process.env.ADMIN_SECRET
  if (secret === undefined) {
    delete process.env.ADMIN_SECRET
  } else {
    process.env.ADMIN_SECRET = secret
  }
  return fn().finally(() => {
    if (original === undefined) {
      delete process.env.ADMIN_SECRET
    } else {
      process.env.ADMIN_SECRET = original
    }
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('isAdminAuthenticated()', () => {

  beforeEach(() => {
    mockGet.mockReset()
  })

  describe('when ADMIN_SECRET is not set', () => {
    it('returns false even when cookie is present', async () => {
      await withEnv(undefined, async () => {
        mockGet.mockReturnValue({ value: 'anything' })
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })

    it('returns false when cookie is absent', async () => {
      await withEnv(undefined, async () => {
        mockGet.mockReturnValue(undefined)
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })
  })

  describe('when ADMIN_SECRET is empty string', () => {
    it('returns false (empty secret is treated as unconfigured)', async () => {
      await withEnv('', async () => {
        mockGet.mockReturnValue({ value: '' })
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })
  })

  describe('when ADMIN_SECRET is configured', () => {
    it('returns true when cookie matches the secret exactly', async () => {
      await withEnv(SECRET, async () => {
        mockGet.mockReturnValue({ value: SECRET })
        expect(await isAdminAuthenticated()).toBe(true)
      })
    })

    it('returns false when cookie value is wrong', async () => {
      await withEnv(SECRET, async () => {
        mockGet.mockReturnValue({ value: 'wrong-password' })
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })

    it('returns false when cookie is absent (get() returns undefined)', async () => {
      await withEnv(SECRET, async () => {
        mockGet.mockReturnValue(undefined)
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })

    it('returns false when cookie value is empty string', async () => {
      await withEnv(SECRET, async () => {
        mockGet.mockReturnValue({ value: '' })
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })

    it('is case-sensitive — uppercase secret does not match lowercase cookie', async () => {
      await withEnv(SECRET, async () => {
        mockGet.mockReturnValue({ value: SECRET.toUpperCase() })
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })

    it('does not match a secret with trailing whitespace', async () => {
      await withEnv(SECRET, async () => {
        mockGet.mockReturnValue({ value: `${SECRET} ` })
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })
  })

  describe('cookie name', () => {
    it('reads from admin_session cookie (not any other name)', async () => {
      await withEnv(SECRET, async () => {
        // Simulate cookies().get() returning undefined for 'admin_session'
        // but returning something for any other key
        mockGet.mockImplementation((name: string) =>
          name === 'admin_session' ? undefined : { value: SECRET }
        )
        expect(await isAdminAuthenticated()).toBe(false)
      })
    })

    it('reads admin_session cookie by name', async () => {
      await withEnv(SECRET, async () => {
        mockGet.mockImplementation((name: string) =>
          name === 'admin_session' ? { value: SECRET } : undefined
        )
        expect(await isAdminAuthenticated()).toBe(true)
      })
    })
  })
})
