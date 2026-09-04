import {
  encryptUserSymmetricKey,
  generateEncryptedRsaKeyPair,
  generateUserSymmetricKey,
  makeMasterPasswordHash,
} from './crypto.js'
import {
  deriveMasterKey,
  normalizeKdfParameters,
} from './kdf.js'

export async function completeInitialSsoSetup({
  email,
  masterPassword,
  loginData = {},
  setMasterPassword,
}) {
  const normalizedEmail = String(email ?? '')
    .trim()
    .toLowerCase()

  if (!normalizedEmail) {
    throw new Error(
      'Vaultwarden did not return an email address.',
    )
  }

  if (!masterPassword) {
    throw new Error('A master password is required.')
  }

  if (typeof setMasterPassword !== 'function') {
    throw new TypeError(
      'A set-password implementation is required.',
    )
  }

  const masterKeyBuffer = await deriveMasterKey(
    masterPassword,
    normalizedEmail,
    loginData,
  )

  const [masterPasswordHash, userKey] = await Promise.all([
    makeMasterPasswordHash(
      masterKeyBuffer,
      masterPassword,
    ),
    Promise.resolve(generateUserSymmetricKey()),
  ])

  const [encryptedUserKey, rsaKeys] = await Promise.all([
    encryptUserSymmetricKey(userKey, masterKeyBuffer),
    generateEncryptedRsaKeyPair(userKey),
  ])

  const kdfParameters = normalizeKdfParameters(loginData)

  await setMasterPassword({
    kdf: kdfParameters.type,
    kdfIterations: kdfParameters.iterations,
    kdfMemory: kdfParameters.memory,
    kdfParallelism: kdfParameters.parallelism,
    key: encryptedUserKey,
    keys: rsaKeys,
    masterPasswordHash,
    masterPasswordHint: null,
  })

  return {
    masterKey: userKey,
    newSsoUser: true,
  }
}
