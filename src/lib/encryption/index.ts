import crypto from 'crypto'
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms'

// ── Encryption (compliance finding #4) ──────────────────────────────────────
//
// AES-256-GCM in both modes; the difference is where the AES key comes from:
//
//   • KMS envelope (new)  — when ENCRYPTION_KMS_KEY_ID is set, every record gets
//     a fresh data key from AWS KMS (GenerateDataKey). The plaintext data key
//     encrypts the content locally; the KMS-wrapped data key is stored inside
//     the ciphertext blob. The blob is prefixed with "kms:" — a marker that can
//     NEVER appear in base64 (no ':' in the base64 alphabet), so decrypt can
//     self-route without threading a keyRef through every caller.
//
//   • Legacy v1 (fallback) — when ENCRYPTION_KMS_KEY_ID is NOT set, or for any
//     stored blob without the "kms:" prefix, the static ENCRYPTION_KEY env var
//     is used, exactly as before. This is what keeps the change non-breaking:
//     deploying without ENCRYPTION_KMS_KEY_ID changes nothing, and existing v1
//     data always decrypts.
//
// Rollout: deploy → set ENCRYPTION_KMS_KEY_ID on dev → verify → set on prod.
// Both encrypt() and decrypt() are async because KMS calls are async.

const ALGORITHM       = 'aes-256-gcm'
const IV_LENGTH       = 16
const AUTH_TAG_LENGTH = 16
const LEGACY_KEY_REF  = 'v1'
const KMS_KEY_REF     = 'kms-v1'
const KMS_PREFIX      = 'kms:'          // impossible in base64 → unambiguous marker

// ── Legacy static key ───────────────────────────────────────────────────────
function getLegacyKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return Buffer.from(hex, 'hex')
}

// ── KMS client + data-key cache ─────────────────────────────────────────────
function kmsKeyId(): string | undefined {
  return process.env.ENCRYPTION_KMS_KEY_ID
}

let _kms: KMSClient | null = null
function kms(): KMSClient {
  // Region + credentials come from the Amplify SSR compute role automatically
  // (default provider chain). AWS_REGION is set in the Lambda environment.
  if (!_kms) _kms = new KMSClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
  return _kms
}

// Cache unwrapped data keys (keyed by a hash of the wrapped blob) so repeated
// reads of the same record don't call KMS every time — the standard envelope
// optimization. Bounded to cap plaintext-key lifetime and memory.
const DATA_KEY_CACHE_MAX = 500
const dataKeyCache = new Map<string, Buffer>()

async function unwrapDataKey(wrapped: Buffer): Promise<Buffer> {
  const cacheKey = crypto.createHash('sha256').update(wrapped).digest('hex')
  const hit = dataKeyCache.get(cacheKey)
  if (hit) return hit

  const out = await kms().send(new DecryptCommand({
    CiphertextBlob: new Uint8Array(wrapped),
    KeyId: kmsKeyId(),
  }))
  if (!out.Plaintext) throw new Error('KMS returned no plaintext data key')
  const dataKey = Buffer.from(out.Plaintext)

  if (dataKeyCache.size >= DATA_KEY_CACHE_MAX) {
    const oldest = dataKeyCache.keys().next().value
    if (oldest) dataKeyCache.delete(oldest)
  }
  dataKeyCache.set(cacheKey, dataKey)
  return dataKey
}

// ── AES helpers ─────────────────────────────────────────────────────────────
function aesGcmEncrypt(key: Buffer, plaintext: string): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted])   // iv || authTag || ciphertext
}

function aesGcmDecrypt(key: Buffer, blob: Buffer): string {
  const iv = blob.subarray(0, IV_LENGTH)
  const authTag = blob.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = blob.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function encrypt(plaintext: string): Promise<{ ciphertext: string; keyRef: string }> {
  const keyId = kmsKeyId()

  if (keyId) {
    const dk = await kms().send(new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: 'AES_256' }))
    if (!dk.Plaintext || !dk.CiphertextBlob) throw new Error('KMS GenerateDataKey returned no key material')
    const dataKey = Buffer.from(dk.Plaintext)
    const wrapped = Buffer.from(dk.CiphertextBlob)
    try {
      const body = aesGcmEncrypt(dataKey, plaintext)
      const wlen = Buffer.alloc(2)
      wlen.writeUInt16BE(wrapped.length, 0)
      const combined = Buffer.concat([wlen, wrapped, body])   // wlen || wrapped || (iv||tag||ct)
      return { ciphertext: KMS_PREFIX + combined.toString('base64'), keyRef: KMS_KEY_REF }
    } finally {
      dataKey.fill(0)   // zero the plaintext data key ASAP (it isn't cached on the write path)
    }
  }

  // Legacy fallback — static env key.
  return { ciphertext: aesGcmEncrypt(getLegacyKey(), plaintext).toString('base64'), keyRef: LEGACY_KEY_REF }
}

export async function decrypt(ciphertext: string): Promise<string> {
  if (ciphertext.startsWith(KMS_PREFIX)) {
    const combined = Buffer.from(ciphertext.slice(KMS_PREFIX.length), 'base64')
    const wlen = combined.readUInt16BE(0)
    const wrapped = combined.subarray(2, 2 + wlen)
    const body = combined.subarray(2 + wlen)
    const dataKey = await unwrapDataKey(wrapped)
    return aesGcmDecrypt(dataKey, body)
  }

  // Legacy v1 blob (no prefix) — static env key.
  return aesGcmDecrypt(getLegacyKey(), Buffer.from(ciphertext, 'base64'))
}
