import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import test from 'node:test'

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

if (!globalThis.atob) {
  globalThis.atob = value => Buffer.from(value, 'base64').toString('binary')
}

if (!globalThis.btoa) {
  globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64')
}

const {
  decryptEncStringRaw,
  decryptUserSymmetricKey,
  encryptBuffer,
  parseEncString,
  stretchMasterKey,
} = await import('../src/services/crypto.js')

function toBase64(length, fill = 0) {
  return Buffer.alloc(length, fill).toString('base64')
}

test('type 2 encrypted strings require a 32-byte HMAC', () => {
  const value = `2.${toBase64(16)}|${toBase64(16)}`

  assert.throws(
    () => parseEncString(value),
    /HMAC/u,
  )
})

test('encrypted strings reject invalid IV and ciphertext lengths', () => {
  assert.throws(
    () => parseEncString(
      `2.${toBase64(15)}|${toBase64(16)}|${toBase64(32)}`,
    ),
    /IV/u,
  )

  assert.throws(
    () => parseEncString(
      `2.${toBase64(16)}|${toBase64(17)}|${toBase64(32)}`,
    ),
    /ciphertext/u,
  )
})

test('RSA encrypted strings cannot enter the AES decryptor', async () => {
  const encrypted = `4.${toBase64(32)}`
  const key = new Uint8Array(32).buffer

  await assert.rejects(
    decryptEncStringRaw(encrypted, key, key),
    /AES/u,
  )
})

test('user keys must decrypt to exactly 64 bytes', async () => {
  const masterKey = crypto.getRandomValues(new Uint8Array(32)).buffer
  const stretched = await stretchMasterKey(masterKey)
  const invalidUserKey = await encryptBuffer(
    new Uint8Array(32).buffer,
    stretched.encKey,
    stretched.macKey,
  )

  await assert.rejects(
    decryptUserSymmetricKey(invalidUserKey, masterKey),
    /64/u,
  )
})

test('valid 64-byte user keys still round-trip', async () => {
  const masterKey = crypto.getRandomValues(new Uint8Array(32)).buffer
  const stretched = await stretchMasterKey(masterKey)
  const rawUserKey = crypto.getRandomValues(new Uint8Array(64))
  const encryptedUserKey = await encryptBuffer(
    rawUserKey.buffer,
    stretched.encKey,
    stretched.macKey,
  )

  const result = await decryptUserSymmetricKey(
    encryptedUserKey,
    masterKey,
  )

  const combined = new Uint8Array(64)
  combined.set(new Uint8Array(result.encKey), 0)
  combined.set(new Uint8Array(result.macKey), 32)

  assert.deepEqual(combined, rawUserKey)
})
