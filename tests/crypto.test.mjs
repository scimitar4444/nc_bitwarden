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
  decryptCipher,
  decryptEncStringRaw,
  decryptUserSymmetricKey,
  encryptBuffer,
  generateUserSymmetricKey,
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

test('organization ciphers never fall back to the personal user key', async () => {
  const userKey = generateUserSymmetricKey()

  await assert.rejects(
    decryptCipher(
      {
        Id: 'cipher-1',
        Type: 2,
        OrganizationId: 'organization-1',
      },
      userKey,
      {},
    ),
    /organization key/u,
  )
})

test('a single damaged encrypted field makes the cipher read-only', async () => {
  const userKey = generateUserSymmetricKey()
  const encryptedName = await encryptBuffer(
    new TextEncoder().encode('Protected item').buffer,
    userKey.encKey,
    userKey.macKey,
  )
  const damagedNotes = `2.${toBase64(16)}|${toBase64(16)}`

  const result = await decryptCipher(
    {
      Id: 'cipher-2',
      Type: 2,
      Name: encryptedName,
      Notes: damagedNotes,
      Favorite: false,
      CollectionIds: [],
      PasswordHistory: [],
      Attachments: [],
      Edit: true,
      ViewPassword: true,
      Permissions: {
        Delete: true,
        Restore: true,
      },
    },
    userKey,
  )

  assert.equal(result.name, 'Protected item')
  assert.equal(result.notes, '')
  assert.equal(result.decryptionFailed, true)
  assert.equal(result.edit, false)
  assert.equal(result.viewPassword, false)
  assert.deepEqual(result.permissions, {
    delete: false,
    restore: false,
  })
  assert.equal(result.decryptionErrors.length, 1)
})
