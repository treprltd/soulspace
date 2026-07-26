import crypto from 'crypto'

// Per-person admin account primitives (compliance finding #1).
//
// Node-runtime ONLY — imported by the admin API routes, never by the Edge
// middleware (which uses the Web-Crypto session module instead). Uses node
// crypto for scrypt password hashing and RFC 6238 TOTP verification, so there
// is no third-party dependency to audit.

// ── Password hashing (scrypt) ───────────────────────────────────────────────
// Stored format: scrypt$<salt_hex>$<hash_hex>. Must match scripts/create-admin.js.
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const derived = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = (stored ?? '').split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  try {
    const salt = Buffer.from(parts[1], 'hex')
    const expected = Buffer.from(parts[2], 'hex')
    const derived = crypto.scryptSync(password, salt, expected.length)
    return expected.length === derived.length && crypto.timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

// ── TOTP (RFC 6238: HMAC-SHA1, 6 digits, 30s period) ────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTotpSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes)
  let bits = '', out = ''
  for (let i = 0; i < buf.length; i++) bits += buf[i].toString(2).padStart(8, '0')
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

function base32Decode(s: string): Buffer {
  const clean = (s ?? '').toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = ''
  for (const c of clean) {
    const idx = B32.indexOf(c)
    if (idx >= 0) bits += idx.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 1_000_000).toString().padStart(6, '0')
}

// Verifies a 6-digit code, tolerating +/- `window` 30s steps for clock drift.
export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  if (!/^\d{6}$/.test(token ?? '')) return false
  const secret = base32Decode(secretBase32)
  if (secret.length === 0) return false
  const counter = Math.floor(Date.now() / 1000 / 30)
  const provided = Buffer.from(token)
  for (let w = -window; w <= window; w++) {
    const candidate = Buffer.from(hotp(secret, counter + w))
    if (crypto.timingSafeEqual(candidate, provided)) return true
  }
  return false
}

export function otpauthUri(email: string, secretBase32: string, issuer = 'Soul Space Admin'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({
    secret: secretBase32, issuer, algorithm: 'SHA1', digits: '6', period: '30',
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
