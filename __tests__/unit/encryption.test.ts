/**
 * Encryption module (compliance finding #4). Covers both paths with no real AWS:
 *   - Legacy static-key path (ENCRYPTION_KMS_KEY_ID unset)
 *   - KMS envelope path (SDK mocked with an identity wrap so roundtrips work)
 * Locks in: self-describing "kms:" prefix, keyRef values, and that a blob
 * encrypted one way decrypts back to the original.
 */
import crypto from 'crypto'

const mockSend = jest.fn()
jest.mock('@aws-sdk/client-kms', () => ({
  KMSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GenerateDataKeyCommand: jest.fn().mockImplementation((input) => ({ _type: 'gen', input })),
  DecryptCommand: jest.fn().mockImplementation((input) => ({ _type: 'dec', input })),
}))

import { encrypt, decrypt } from '@/lib/encryption'

const TEST_KEY = 'a'.repeat(64) // 32 bytes hex

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY
  delete process.env.ENCRYPTION_KMS_KEY_ID
  mockSend.mockReset()
})

describe('encryption — legacy static-key path', () => {
  it('roundtrips and tags keyRef v1 with no kms: prefix', async () => {
    const { ciphertext, keyRef } = await encrypt('a secret reflection')
    expect(keyRef).toBe('v1')
    expect(ciphertext.startsWith('kms:')).toBe(false)
    expect(await decrypt(ciphertext)).toBe('a secret reflection')
  })

  it('handles unicode and long text', async () => {
    const text = '🌙 '.repeat(500) + 'end'
    const { ciphertext } = await encrypt(text)
    expect(await decrypt(ciphertext)).toBe(text)
  })
})

describe('encryption — KMS envelope path', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KMS_KEY_ID = 'arn:aws:kms:us-east-1:1:key/test'
    // Identity wrap: CiphertextBlob == Plaintext, so Decrypt(blob) returns the
    // same data key GenerateDataKey issued — enough to validate the format.
    mockSend.mockImplementation(async (cmd) => {
      if (cmd._type === 'gen') {
        const key = crypto.randomBytes(32)
        return { Plaintext: new Uint8Array(key), CiphertextBlob: new Uint8Array(key) }
      }
      if (cmd._type === 'dec') {
        return { Plaintext: new Uint8Array(cmd.input.CiphertextBlob) }
      }
      throw new Error('unexpected command')
    })
  })

  it('produces a kms: prefixed blob, keyRef kms-v1, and roundtrips', async () => {
    const { ciphertext, keyRef } = await encrypt('crisis-adjacent reflection')
    expect(keyRef).toBe('kms-v1')
    expect(ciphertext.startsWith('kms:')).toBe(true)
    expect(await decrypt(ciphertext)).toBe('crisis-adjacent reflection')
    // GenerateDataKey on encrypt, Decrypt on decrypt
    expect(mockSend).toHaveBeenCalledTimes(2)
  })

  it('still decrypts legacy v1 blobs even when KMS is configured', async () => {
    // Make a legacy blob first (KMS off), then decrypt it with KMS on.
    delete process.env.ENCRYPTION_KMS_KEY_ID
    const { ciphertext } = await encrypt('older session')
    process.env.ENCRYPTION_KMS_KEY_ID = 'arn:aws:kms:us-east-1:1:key/test'
    expect(await decrypt(ciphertext)).toBe('older session')
    expect(mockSend).not.toHaveBeenCalled() // legacy path never touches KMS
  })
})
