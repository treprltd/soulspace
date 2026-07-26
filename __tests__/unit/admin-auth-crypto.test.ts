/**
 * Admin auth crypto (compliance finding #1). Security-critical primitives:
 *   - signed session token (HMAC-SHA256, isomorphic Web Crypto)
 *   - scrypt password hashing
 *   - RFC 6238 TOTP verification
 * No env or network needed.
 */
import crypto from 'crypto'
import { signAdminToken, verifyAdminToken } from '@/lib/admin/session'
import { hashPassword, verifyPassword, generateTotpSecret, verifyTotp } from '@/lib/admin/accounts'

const SECRET = 'unit-test-admin-secret'

describe('admin session tokens', () => {
  const base = { sub: 'admin-1', email: 'a@b.com' }

  it('signs and verifies a valid token', async () => {
    const token = await signAdminToken({ ...base, exp: Math.floor(Date.now() / 1000) + 60 }, SECRET)
    const p = await verifyAdminToken(token, SECRET)
    expect(p).not.toBeNull()
    expect(p?.sub).toBe('admin-1')
    expect(p?.email).toBe('a@b.com')
  })

  it('rejects a tampered token', async () => {
    const token = await signAdminToken({ ...base, exp: Math.floor(Date.now() / 1000) + 60 }, SECRET)
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A')
    expect(await verifyAdminToken(tampered, SECRET)).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signAdminToken({ ...base, exp: Math.floor(Date.now() / 1000) + 60 }, SECRET)
    expect(await verifyAdminToken(token, 'a-different-secret')).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signAdminToken({ ...base, exp: Math.floor(Date.now() / 1000) - 1 }, SECRET)
    expect(await verifyAdminToken(token, SECRET)).toBeNull()
  })

  it('rejects junk / empty input', async () => {
    expect(await verifyAdminToken('', SECRET)).toBeNull()
    expect(await verifyAdminToken('not-a-token', SECRET)).toBeNull()
    expect(await verifyAdminToken('a.b.c', SECRET)).toBeNull()
  })
})

describe('admin password hashing', () => {
  it('verifies the correct password and rejects wrong ones', () => {
    const hash = hashPassword('correct horse battery staple')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true)
    expect(verifyPassword('wrong password', hash)).toBe(false)
  })

  it('rejects malformed stored hashes without throwing', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false)
    expect(verifyPassword('x', '')).toBe(false)
  })
})

// Independent RFC 6238 generator to validate verifyTotp.
function totpAt(secretB32: string, counter: number): string {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of secretB32.toUpperCase()) {
    const i = B32.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  const secret = Buffer.from(bytes)
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const h = crypto.createHmac('sha1', secret).update(buf).digest()
  const o = h[h.length - 1] & 0xf
  const code = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff)
  return (code % 1_000_000).toString().padStart(6, '0')
}

describe('admin TOTP', () => {
  it('accepts a valid current code, rejects wrong/malformed', () => {
    const secret = generateTotpSecret()
    const now = Math.floor(Date.now() / 1000 / 30)
    expect(verifyTotp(secret, totpAt(secret, now))).toBe(true)

    // Deterministically-wrong 6-digit code (not in the ±1 window set).
    const valid = new Set([totpAt(secret, now - 1), totpAt(secret, now), totpAt(secret, now + 1)])
    let wrong = '000000'
    while (valid.has(wrong)) wrong = String((Number(wrong) + 1) % 1_000_000).padStart(6, '0')
    expect(verifyTotp(secret, wrong)).toBe(false)

    expect(verifyTotp(secret, 'abcdef')).toBe(false)
    expect(verifyTotp(secret, '12345')).toBe(false)
  })
})
