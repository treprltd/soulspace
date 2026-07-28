/**
 * Unit tests — src/lib/admin/auth.ts (isAdminAuthenticated)
 *
 * After the break-glass retirement (compliance finding #1) the ONLY accepted
 * credential is a valid signed session token. A raw-secret cookie — which used
 * to authenticate — must now be rejected.
 *
 * next/headers is mocked so we never touch real cookies.
 */

const mockGet = jest.fn()
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({ get: mockGet })),
}))

import { isAdminAuthenticated } from '@/lib/admin/auth'
import { signAdminToken } from '@/lib/admin/session'

const SECRET = 'super-secret-admin-password-123'

function withEnv(secret: string | undefined, fn: () => Promise<void>) {
  const original = process.env.ADMIN_SECRET
  delete process.env.ADMIN_SESSION_SECRET // force sessionSecret() to fall back to ADMIN_SECRET
  if (secret === undefined) delete process.env.ADMIN_SECRET
  else process.env.ADMIN_SECRET = secret
  return fn().finally(() => {
    if (original === undefined) delete process.env.ADMIN_SECRET
    else process.env.ADMIN_SECRET = original
  })
}

describe('isAdminAuthenticated() — signed-token only (break-glass retired)', () => {
  beforeEach(() => mockGet.mockReset())

  it('returns false when no cookie is present', async () => {
    await withEnv(SECRET, async () => {
      mockGet.mockReturnValue(undefined)
      expect(await isAdminAuthenticated()).toBe(false)
    })
  })

  it('REJECTS a raw-secret cookie (legacy break-glass no longer accepted)', async () => {
    await withEnv(SECRET, async () => {
      mockGet.mockReturnValue({ value: SECRET })
      expect(await isAdminAuthenticated()).toBe(false)
    })
  })

  it('rejects a garbage cookie', async () => {
    await withEnv(SECRET, async () => {
      mockGet.mockReturnValue({ value: 'not-a-token' })
      expect(await isAdminAuthenticated()).toBe(false)
    })
  })

  it('accepts a valid signed session token', async () => {
    await withEnv(SECRET, async () => {
      const token = await signAdminToken({ sub: 'admin-1', email: 'a@b.com', exp: Math.floor(Date.now() / 1000) + 60 })
      mockGet.mockReturnValue({ value: token })
      expect(await isAdminAuthenticated()).toBe(true)
    })
  })

  it('rejects an expired signed token', async () => {
    await withEnv(SECRET, async () => {
      const token = await signAdminToken({ sub: 'admin-1', email: 'a@b.com', exp: Math.floor(Date.now() / 1000) - 1 })
      mockGet.mockReturnValue({ value: token })
      expect(await isAdminAuthenticated()).toBe(false)
    })
  })

  it('rejects a valid token once the signing secret is gone', async () => {
    const token = await signAdminToken({ sub: 'x', email: 'x', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET)
    await withEnv(undefined, async () => {
      mockGet.mockReturnValue({ value: token })
      expect(await isAdminAuthenticated()).toBe(false)
    })
  })

  it('reads specifically the admin_session cookie', async () => {
    await withEnv(SECRET, async () => {
      const token = await signAdminToken({ sub: 'admin-1', email: 'a@b.com', exp: Math.floor(Date.now() / 1000) + 60 })
      mockGet.mockImplementation((name: string) => (name === 'admin_session' ? { value: token } : undefined))
      expect(await isAdminAuthenticated()).toBe(true)
    })
  })
})
