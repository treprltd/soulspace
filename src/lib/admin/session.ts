// Isomorphic signed admin session token — HMAC-SHA256 over a compact payload.
//
// This is issued by the Node API routes and verified by BOTH those routes and
// the Edge-runtime middleware, so it must depend ONLY on Web Crypto
// (globalThis.crypto.subtle) and btoa/atob — never on node:crypto. Both the
// Node (>=20) and Edge runtimes provide those globals.
//
// The token replaces the previous scheme where the cookie value WAS the raw
// ADMIN_SECRET (compliance finding #1): a stolen/logged cookie no longer
// reveals the shared password.

export interface AdminTokenPayload {
  sub:   string   // admin_users.id, or 'break-glass' for the shared-secret login
  email: string
  exp:   number   // unix seconds
}

const encoder = new TextEncoder()

function toB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Return type inferred (Uint8Array<ArrayBuffer>) so it satisfies BufferSource
// on the crypto.subtle calls under TS's parameterized typed-array types.
function fromB64Url(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  )
}

// Signing secret: a dedicated var if set, otherwise derived from ADMIN_SECRET
// so no new environment variable is required to roll this out.
export function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_SECRET ?? ''
}

export async function signAdminToken(
  payload: AdminTokenPayload, secret: string = sessionSecret(),
): Promise<string> {
  const body = toB64Url(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body))
  return `${body}.${toB64Url(new Uint8Array(sig))}`
}

export async function verifyAdminToken(
  token: string | undefined | null, secret: string = sessionSecret(),
): Promise<AdminTokenPayload | null> {
  if (!secret || !token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64Url(sig), encoder.encode(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(body))) as AdminTokenPayload
    if (typeof payload.exp !== 'number' || Math.floor(Date.now() / 1000) >= payload.exp) return null
    return payload
  } catch {
    return null
  }
}
