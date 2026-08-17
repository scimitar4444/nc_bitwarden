import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decryptCipher,
  decryptEncString,
  decryptFileData,
  encryptFileData,
  encryptString,
  generateUserSymmetricKey,
} from '../src/services/crypto.js'
import {
  normalizeKdfParameters,
} from '../src/services/kdf.js'
import {
  mapSettledWithConcurrency,
} from '../src/utils/concurrency.js'

function tamperEncodedValue(value) {
  const index = value.lastIndexOf('|') + 1
  const original = value[index]
  const replacement = original === 'A' ? 'B' : 'A'

  return value.slice(0, index)
    + replacement
    + value.slice(index + 1)
}

test('encrypted strings round-trip', async () => {
  const key = generateUserSymmetricKey()
  const encrypted = await encryptString(
    'Warden test',
    key.encKey,
    key.macKey,
  )

  assert.equal(
    await decryptEncString(
      encrypted,
      key.encKey,
      key.macKey,
    ),
    'Warden test',
  )
})

test('encrypted attachments round-trip and reject tampering', async () => {
  const key = generateUserSymmetricKey()
  const plaintext = new TextEncoder().encode(
    'attachment data',
  )

  const encrypted = await encryptFileData(
    plaintext,
    key,
  )

  const decrypted = await decryptFileData(
    encrypted,
    key,
  )

  assert.equal(
    new TextDecoder().decode(decrypted),
    'attachment data',
  )

  const tampered = new Uint8Array(encrypted.slice(0))
  tampered[tampered.length - 1] ^= 1

  await assert.rejects(
    decryptFileData(tampered, key),
    /Integritätsprüfung/u,
  )
})

test('field decryption failures make ciphers read-only', async () => {
  const key = generateUserSymmetricKey()
  const name = await encryptString(
    'Example',
    key.encKey,
    key.macKey,
  )
  const password = await encryptString(
    'secret',
    key.encKey,
    key.macKey,
  )

  const decrypted = await decryptCipher(
    {
      Id: 'cipher-1',
      Type: 1,
      Name: name,
      Notes: null,
      Favorite: false,
      Login: {
        Username: null,
        Password: tamperEncodedValue(password),
        Totp: null,
        Uris: [],
      },
    },
    key,
  )

  assert.equal(decrypted.name, 'Example')
  assert.equal(decrypted.login.password, '')
  assert.equal(decrypted.decryptionFailed, true)
  assert.equal(decrypted.edit, false)
  assert.equal(decrypted.viewPassword, false)
  assert.equal(decrypted.decryptionErrorCount, 1)
})

test('organization ciphers require their organization key', async () => {
  const userKey = generateUserSymmetricKey()

  await assert.rejects(
    decryptCipher(
      {
        Id: 'cipher-2',
        Type: 2,
        OrganizationId: 'organization-1',
      },
      userKey,
      {},
    ),
    /Kein Organisationsschlüssel/u,
  )
})

test('KDF parameters are used exactly or rejected', () => {
  assert.deepEqual(
    normalizeKdfParameters({
      Kdf: 0,
      KdfIterations: 750_001,
    }),
    {
      type: 0,
      iterations: 750_001,
      memory: null,
      parallelism: null,
    },
  )

  assert.deepEqual(
    normalizeKdfParameters({
      Kdf: 1,
      KdfIterations: 4,
      KdfMemory: 128,
      KdfParallelism: 8,
    }),
    {
      type: 1,
      iterations: 4,
      memory: 128,
      parallelism: 8,
    },
  )

  assert.throws(
    () => normalizeKdfParameters({
      Kdf: 0,
      KdfIterations: 2_000_001,
    }),
    exception => exception.code === 'unsupported_kdf',
  )

  assert.throws(
    () => normalizeKdfParameters({ Kdf: 99 }),
    exception => exception.code === 'unsupported_kdf',
  )
})

test('concurrency helper preserves order and limits workers', async () => {
  let active = 0
  let maximumActive = 0

  const result = await mapSettledWithConcurrency(
    [1, 2, 3, 4, 5, 6],
    2,
    async value => {
      active += 1
      maximumActive = Math.max(maximumActive, active)

      await new Promise(resolve => {
        setTimeout(resolve, 5)
      })

      active -= 1

      if (value === 4) {
        throw new Error('expected failure')
      }

      return value * 2
    },
  )

  assert.ok(maximumActive <= 2)
  assert.deepEqual(
    result.map(entry => entry.status),
    [
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
    ],
  )
  assert.equal(result[0].value, 2)
  assert.equal(result[5].value, 12)
})
