import {
  deriveMasterKeyArgon2id,
  deriveMasterKeyPBKDF2,
} from './crypto.js'

const KDF_PBKDF2 = 0
const KDF_ARGON2ID = 1

const LIMITS = Object.freeze({
  pbkdf2Iterations: {
    minimum: 1,
    maximum: 2_000_000,
    fallback: 600_000,
  },
  argon2Iterations: {
    minimum: 1,
    maximum: 20,
    fallback: 3,
  },
  argon2Memory: {
    minimum: 8,
    maximum: 256,
    fallback: 64,
  },
  argon2Parallelism: {
    minimum: 1,
    maximum: 16,
    fallback: 4,
  },
})

function unsupportedKdf(message) {
  const exception = new Error(message)
  exception.code = 'unsupported_kdf'

  return exception
}

function integerParameter(
  value,
  {
    minimum,
    maximum,
    fallback,
    label,
  },
) {
  const candidate = value === null || value === undefined
    ? fallback
    : Number(value)

  if (
    !Number.isSafeInteger(candidate)
    || candidate < minimum
    || candidate > maximum
  ) {
    throw unsupportedKdf(
      `${label} must be an integer between ${minimum} and ${maximum}.`,
    )
  }

  return candidate
}

export function normalizeKdfParameters(kdfData = {}) {
  const kdfType = Number(
    kdfData.Kdf
      ?? kdfData.kdf
      ?? KDF_PBKDF2,
  )

  if (![KDF_PBKDF2, KDF_ARGON2ID].includes(kdfType)) {
    throw unsupportedKdf(
      `Unsupported vault key derivation type: ${String(kdfType)}.`,
    )
  }

  if (kdfType === KDF_ARGON2ID) {
    return {
      type: KDF_ARGON2ID,
      iterations: integerParameter(
        kdfData.KdfIterations
          ?? kdfData.kdfIterations,
        {
          ...LIMITS.argon2Iterations,
          label: 'Argon2 iteration count',
        },
      ),
      memory: integerParameter(
        kdfData.KdfMemory
          ?? kdfData.kdfMemory,
        {
          ...LIMITS.argon2Memory,
          label: 'Argon2 memory size',
        },
      ),
      parallelism: integerParameter(
        kdfData.KdfParallelism
          ?? kdfData.kdfParallelism,
        {
          ...LIMITS.argon2Parallelism,
          label: 'Argon2 parallelism',
        },
      ),
    }
  }

  return {
    type: KDF_PBKDF2,
    iterations: integerParameter(
      kdfData.KdfIterations
        ?? kdfData.kdfIterations,
      {
        ...LIMITS.pbkdf2Iterations,
        label: 'PBKDF2 iteration count',
      },
    ),
    memory: null,
    parallelism: null,
  }
}

export async function deriveMasterKey(
  password,
  loginEmail,
  kdfData,
) {
  const parameters = normalizeKdfParameters(kdfData)

  if (parameters.type === KDF_ARGON2ID) {
    return deriveMasterKeyArgon2id(
      password,
      loginEmail,
      parameters.memory,
      parameters.iterations,
      parameters.parallelism,
    )
  }

  return deriveMasterKeyPBKDF2(
    password,
    loginEmail,
    parameters.iterations,
  )
}
