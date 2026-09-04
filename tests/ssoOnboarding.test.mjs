import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decryptUserSymmetricKey,
} from '../src/services/crypto.js'
import {
  deriveMasterKey,
} from '../src/services/kdf.js'
import {
  completeInitialSsoSetup,
} from '../src/services/ssoOnboarding.js'

function bytes(value) {
  return Array.from(new Uint8Array(value))
}

test('completely new SSO user sets a master password and opens the vault', async () => {
  const email = 'New.User@Example.Test '
  const masterPassword = 'Correct-Horse-42!'
  const loginData = {
    Kdf: 0,
    KdfIterations: 1,
    KdfMemory: null,
    KdfParallelism: null,
  }

  let submittedPayload = null

  const result = await completeInitialSsoSetup({
    email,
    masterPassword,
    loginData,
    setMasterPassword: async payload => {
      submittedPayload = payload
      return { object: 'set-password' }
    },
  })

  assert.ok(submittedPayload)
  assert.equal(submittedPayload.kdf, 0)
  assert.equal(submittedPayload.kdfIterations, 1)
  assert.equal(submittedPayload.kdfMemory, null)
  assert.equal(submittedPayload.kdfParallelism, null)
  assert.equal(submittedPayload.masterPasswordHint, null)
  assert.match(submittedPayload.masterPasswordHash, /\S/u)
  assert.match(submittedPayload.key, /^2\./u)
  assert.match(
    submittedPayload.keys.encryptedPrivateKey,
    /^2\./u,
  )
  assert.match(submittedPayload.keys.publicKey, /\S/u)

  const masterKey = await deriveMasterKey(
    masterPassword,
    email.trim().toLowerCase(),
    loginData,
  )
  const decryptedUserKey = await decryptUserSymmetricKey(
    submittedPayload.key,
    masterKey,
  )

  assert.deepEqual(
    bytes(decryptedUserKey.encKey),
    bytes(result.masterKey.encKey),
  )
  assert.deepEqual(
    bytes(decryptedUserKey.macKey),
    bytes(result.masterKey.macKey),
  )
  assert.equal(result.newSsoUser, true)
})
