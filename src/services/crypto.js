/**
 * Bitwarden cryptography performed entirely in the browser.
 *
 * PBKDF2 / Argon2id · AES-256-CBC · HMAC-SHA256 · RSA-OAEP
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const importedKeys = {
  aesEncrypt: new WeakMap(),
  aesDecrypt: new WeakMap(),
  hmacSign: new WeakMap(),
  hmacVerify: new WeakMap(),
}

function assertArrayBuffer(value, label) {
  if (!(value instanceof ArrayBuffer)) {
    throw new TypeError(`${label} must be an ArrayBuffer.`)
  }

  return value
}

async function cachedImportedKey(
  buffer,
  cache,
  algorithm,
  usages,
) {
  assertArrayBuffer(buffer, 'Cryptographic key')

  let imported = cache.get(buffer)

  if (!imported) {
    imported = crypto.subtle.importKey(
      'raw',
      buffer,
      algorithm,
      false,
      usages,
    )

    cache.set(buffer, imported)
  }

  return imported
}

function aesEncryptionKey(buffer) {
  return cachedImportedKey(
    buffer,
    importedKeys.aesEncrypt,
    { name: 'AES-CBC' },
    ['encrypt'],
  )
}

function aesDecryptionKey(buffer) {
  return cachedImportedKey(
    buffer,
    importedKeys.aesDecrypt,
    { name: 'AES-CBC' },
    ['decrypt'],
  )
}

function hmacSigningKey(buffer) {
  return cachedImportedKey(
    buffer,
    importedKeys.hmacSign,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    ['sign'],
  )
}

function hmacVerificationKey(buffer) {
  return cachedImportedKey(
    buffer,
    importedKeys.hmacVerify,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    ['verify'],
  )
}

export function b64ToBuffer(b64) {
  if (typeof b64 !== 'string' || b64 === '') {
    throw new TypeError('Invalid base64 value.')
  }

  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

export function bufferToB64(buffer) {
  const bytes = new Uint8Array(
    assertArrayBuffer(buffer, 'Binary value'),
  )

  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

export async function deriveMasterKeyPBKDF2(
  password,
  email,
  iterations = 600_000,
) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(
        email.trim().toLowerCase(),
      ),
      iterations,
    },
    material,
    256,
  )
}

export async function deriveMasterKeyArgon2id(
  password,
  email,
  memory,
  iterations,
  parallelism,
) {
  const { argon2id } = await import(
    '@noble/hashes/argon2',
  )

  const saltBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(email.trim().toLowerCase()),
  )

  const hash = argon2id(
    encoder.encode(password),
    new Uint8Array(saltBuffer),
    {
      t: iterations,
      m: memory * 1024,
      p: parallelism,
      dkLen: 32,
    },
  )

  return hash.buffer
}

export async function makeMasterPasswordHash(
  masterKeyBuffer,
  password,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    masterKeyBuffer,
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(password),
      iterations: 1,
    },
    key,
    256,
  )

  return bufferToB64(hash)
}

async function hkdfExpand(
  prkBuffer,
  info,
  outputLength = 32,
) {
  const prk = await hmacSigningKey(prkBuffer)
  const encodedInfo = encoder.encode(info)
  const input = new Uint8Array(
    encodedInfo.length + 1,
  )

  input.set(encodedInfo)
  input[input.length - 1] = 0x01

  return new Uint8Array(
    await crypto.subtle.sign('HMAC', prk, input),
  ).slice(0, outputLength).buffer
}

export async function stretchMasterKey(
  masterKeyBuffer,
) {
  const [encKey, macKey] = await Promise.all([
    hkdfExpand(masterKeyBuffer, 'enc', 32),
    hkdfExpand(masterKeyBuffer, 'mac', 32),
  ])

  return { encKey, macKey }
}

/**
 * Parse a Bitwarden EncString.
 *
 * AES types 0/1/2 return { type, iv, ct, mac }.
 * RSA types 3/4/5/6 return { type, ct, mac }.
 */
export function parseEncString(encString) {
  if (
    !encString
    || typeof encString !== 'string'
  ) {
    return null
  }

  const dotIndex = encString.indexOf('.')

  if (dotIndex <= 0) {
    return null
  }

  const type = Number.parseInt(
    encString.substring(0, dotIndex),
    10,
  )

  if (!Number.isInteger(type) || type < 0 || type > 6) {
    return null
  }

  const parts = encString
    .substring(dotIndex + 1)
    .split('|')

  try {
    if (type >= 3) {
      if (!parts[0]) {
        return null
      }

      const ct = b64ToBuffer(parts[0])
      const mac = parts[1]
        ? b64ToBuffer(parts[1])
        : null

      if (
        ct.byteLength === 0
        || (mac && mac.byteLength !== 32)
      ) {
        return null
      }

      return {
        type,
        ct,
        mac,
      }
    }

    if (
      parts.length < 2
      || !parts[0]
      || !parts[1]
    ) {
      return null
    }

    const iv = b64ToBuffer(parts[0])
    const ct = b64ToBuffer(parts[1])
    const mac = parts[2]
      ? b64ToBuffer(parts[2])
      : null

    if (
      iv.byteLength !== 16
      || ct.byteLength === 0
      || ct.byteLength % 16 !== 0
      || (mac && mac.byteLength !== 32)
      || (type !== 0 && !mac)
    ) {
      return null
    }

    return {
      type,
      iv,
      ct,
      mac,
    }
  } catch {
    return null
  }
}

async function verifyHmac(
  iv,
  ciphertext,
  mac,
  macKeyBuffer,
) {
  const macKey = await hmacVerificationKey(
    macKeyBuffer,
  )

  const authenticatedData = new Uint8Array(
    iv.byteLength + ciphertext.byteLength,
  )

  authenticatedData.set(new Uint8Array(iv))
  authenticatedData.set(
    new Uint8Array(ciphertext),
    iv.byteLength,
  )

  return crypto.subtle.verify(
    'HMAC',
    macKey,
    mac,
    authenticatedData,
  )
}

export async function decryptEncStringRaw(
  encString,
  encKeyBuffer,
  macKeyBuffer,
) {
  const parsed = parseEncString(encString)

  if (!parsed || parsed.type >= 3) {
    throw new Error(
      `Ungültiger symmetrischer EncString: ${String(
        encString,
      ).substring(0, 20)}`,
    )
  }

  if (parsed.mac) {
    if (!macKeyBuffer) {
      throw new Error(
        'Der MAC-Schlüssel fehlt.',
      )
    }

    const valid = await verifyHmac(
      parsed.iv,
      parsed.ct,
      parsed.mac,
      macKeyBuffer,
    )

    if (!valid) {
      throw new Error(
        'HMAC-Verifikation fehlgeschlagen',
      )
    }
  }

  const key = await aesDecryptionKey(encKeyBuffer)

  return crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv: parsed.iv,
    },
    key,
    parsed.ct,
  )
}

export async function decryptEncString(
  encString,
  encKeyBuffer,
  macKeyBuffer,
) {
  if (!encString) {
    return ''
  }

  const raw = await decryptEncStringRaw(
    encString,
    encKeyBuffer,
    macKeyBuffer,
  )

  return decoder.decode(raw)
}

export async function decryptUserSymmetricKey(
  encryptedKey,
  masterKeyBuffer,
) {
  const stretched = await stretchMasterKey(
    masterKeyBuffer,
  )

  const raw = new Uint8Array(
    await decryptEncStringRaw(
      encryptedKey,
      stretched.encKey,
      stretched.macKey,
    ),
  )

  if (raw.byteLength !== 64) {
    throw new Error(
      `Ungültige Benutzerschlüssellänge: ${raw.byteLength}`,
    )
  }

  return {
    encKey: raw.slice(0, 32).buffer,
    macKey: raw.slice(32, 64).buffer,
  }
}

export async function decryptRsaPrivateKey(
  encryptedPrivateKey,
  userKey,
) {
  const rawPkcs8 = await decryptEncStringRaw(
    encryptedPrivateKey,
    userKey.encKey,
    userKey.macKey,
  )

  for (const hash of ['SHA-1', 'SHA-256']) {
    try {
      return await crypto.subtle.importKey(
        'pkcs8',
        rawPkcs8,
        {
          name: 'RSA-OAEP',
          hash,
        },
        false,
        ['decrypt'],
      )
    } catch {
      // Try the next provider-compatible hash.
    }
  }

  throw new Error(
    'RSA Private Key konnte nicht importiert werden',
  )
}

export async function decryptOrgKeys(
  organizations = [],
  rsaPrivateKey,
) {
  const keys = {}

  await Promise.allSettled(
    organizations.map(async organization => {
      try {
        const parsed = parseEncString(
          organization.Key,
        )

        if (!parsed || !parsed.ct || parsed.type < 3) {
          throw new Error(
            'Ungültiger Organisationsschlüssel.',
          )
        }

        const raw = new Uint8Array(
          await crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            rsaPrivateKey,
            parsed.ct,
          ),
        )

        if (raw.byteLength !== 64) {
          throw new Error(
            `Ungültige Organisationsschlüssellänge: ${raw.byteLength}`,
          )
        }

        keys[organization.Id] = {
          encKey: raw.slice(0, 32).buffer,
          macKey: raw.slice(32, 64).buffer,
        }
      } catch (exception) {
        console.warn(
          `[nc_bitwarden] Org-Key ${organization.Id} nicht entschlüsselbar:`,
          exception.message,
        )
      }
    }),
  )

  return keys
}

export async function encryptBuffer(
  buffer,
  encKeyBuffer,
  macKeyBuffer,
) {
  const iv = crypto.getRandomValues(
    new Uint8Array(16),
  )

  const [encKey, macKey] = await Promise.all([
    aesEncryptionKey(encKeyBuffer),
    hmacSigningKey(macKeyBuffer),
  ])

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    encKey,
    buffer,
  )

  const authenticatedData = new Uint8Array(
    iv.byteLength + ciphertext.byteLength,
  )

  authenticatedData.set(iv)
  authenticatedData.set(
    new Uint8Array(ciphertext),
    iv.byteLength,
  )

  const mac = await crypto.subtle.sign(
    'HMAC',
    macKey,
    authenticatedData,
  )

  return `2.${bufferToB64(iv.buffer)}`
    + `|${bufferToB64(ciphertext)}`
    + `|${bufferToB64(mac)}`
}

export async function encryptString(
  plaintext,
  encKeyBuffer,
  macKeyBuffer,
) {
  if (!plaintext) {
    return null
  }

  return encryptBuffer(
    encoder.encode(plaintext).buffer,
    encKeyBuffer,
    macKeyBuffer,
  )
}

export function generateUserSymmetricKey() {
  const bytes = crypto.getRandomValues(
    new Uint8Array(64),
  )

  return {
    encKey: bytes.slice(0, 32).buffer,
    macKey: bytes.slice(32, 64).buffer,
  }
}

export function symmetricKeyToBuffer(key) {
  if (
    !(key?.encKey instanceof ArrayBuffer)
    || !(key?.macKey instanceof ArrayBuffer)
    || key.encKey.byteLength !== 32
    || key.macKey.byteLength !== 32
  ) {
    throw new Error(
      'Ungültiger symmetrischer Schlüssel.',
    )
  }

  const raw = new Uint8Array(64)

  raw.set(new Uint8Array(key.encKey), 0)
  raw.set(new Uint8Array(key.macKey), 32)

  return raw.buffer
}

export async function encryptSymmetricKey(
  key,
  wrappingKey,
) {
  return encryptBuffer(
    symmetricKeyToBuffer(key),
    wrappingKey.encKey,
    wrappingKey.macKey,
  )
}

export async function decryptSymmetricKey(
  encryptedKey,
  wrappingKey,
) {
  const raw = new Uint8Array(
    await decryptEncStringRaw(
      encryptedKey,
      wrappingKey.encKey,
      wrappingKey.macKey,
    ),
  )

  if (raw.byteLength !== 64) {
    throw new Error(
      `Ungültige Schlüssellänge: ${raw.byteLength}`,
    )
  }

  return {
    encKey: raw.slice(0, 32).buffer,
    macKey: raw.slice(32, 64).buffer,
  }
}

export async function encryptFileData(
  plaintext,
  key,
) {
  const input = plaintext instanceof ArrayBuffer
    ? plaintext
    : plaintext.buffer.slice(
      plaintext.byteOffset,
      plaintext.byteOffset + plaintext.byteLength,
    )

  const iv = crypto.getRandomValues(
    new Uint8Array(16),
  )

  const [encryptionKey, macKey] = await Promise.all([
    aesEncryptionKey(key.encKey),
    hmacSigningKey(key.macKey),
  ])

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    encryptionKey,
    input,
  )

  const authenticatedData = new Uint8Array(
    iv.byteLength + ciphertext.byteLength,
  )

  authenticatedData.set(iv, 0)
  authenticatedData.set(
    new Uint8Array(ciphertext),
    iv.byteLength,
  )

  const mac = await crypto.subtle.sign(
    'HMAC',
    macKey,
    authenticatedData,
  )

  const output = new Uint8Array(
    1
      + iv.byteLength
      + mac.byteLength
      + ciphertext.byteLength,
  )

  output[0] = 2
  output.set(iv, 1)
  output.set(new Uint8Array(mac), 17)
  output.set(new Uint8Array(ciphertext), 49)

  return output.buffer
}

export async function decryptFileData(
  encrypted,
  key,
) {
  const bytes = encrypted instanceof Uint8Array
    ? encrypted
    : new Uint8Array(encrypted)

  if (bytes.byteLength < 65) {
    throw new Error(
      'Die verschlüsselte Datei ist zu kurz.',
    )
  }

  if (bytes[0] !== 2) {
    throw new Error(
      `Nicht unterstützter Dateiverschlüsselungstyp: ${bytes[0]}`,
    )
  }

  const iv = bytes.slice(1, 17)
  const mac = bytes.slice(17, 49)
  const ciphertext = bytes.slice(49)

  if (
    ciphertext.byteLength === 0
    || ciphertext.byteLength % 16 !== 0
  ) {
    throw new Error(
      'Der verschlüsselte Dateiinhalt ist ungültig.',
    )
  }

  const authenticatedData = new Uint8Array(
    iv.byteLength + ciphertext.byteLength,
  )

  authenticatedData.set(iv, 0)
  authenticatedData.set(
    ciphertext,
    iv.byteLength,
  )

  const [macKey, decryptionKey] = await Promise.all([
    hmacVerificationKey(key.macKey),
    aesDecryptionKey(key.encKey),
  ])

  const valid = await crypto.subtle.verify(
    'HMAC',
    macKey,
    mac,
    authenticatedData,
  )

  if (!valid) {
    throw new Error(
      'Die Integritätsprüfung des Anhangs ist fehlgeschlagen.',
    )
  }

  return crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    decryptionKey,
    ciphertext,
  )
}

export async function encryptUserSymmetricKey(
  userKey,
  masterKeyBuffer,
) {
  const stretched = await stretchMasterKey(
    masterKeyBuffer,
  )

  return encryptBuffer(
    symmetricKeyToBuffer(userKey),
    stretched.encKey,
    stretched.macKey,
  )
}

export async function generateEncryptedRsaKeyPair(
  userKey,
) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-1',
    },
    true,
    ['encrypt', 'decrypt'],
  )

  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey(
      'spki',
      keyPair.publicKey,
    ),
    crypto.subtle.exportKey(
      'pkcs8',
      keyPair.privateKey,
    ),
  ])

  return {
    publicKey: bufferToB64(publicKey),
    encryptedPrivateKey: await encryptBuffer(
      privateKey,
      userKey.encKey,
      userKey.macKey,
    ),
  }
}

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function organizationKeyForId(
  organizationId,
  organizationKeys,
) {
  if (!organizationId) {
    return null
  }

  if (organizationKeys[organizationId]) {
    return organizationKeys[organizationId]
  }

  const normalized = normalizeId(organizationId)

  return Object.entries(organizationKeys)
    .find(([id]) => normalizeId(id) === normalized)
    ?.[1] ?? null
}

/**
 * Decrypt a cipher without allowing an unreadable field to be
 * written back as an empty value later.
 *
 * Field-level errors are recorded so the item can still be shown,
 * but the resulting item is marked read-only. Missing organization
 * keys reject the complete item because every field would otherwise
 * be decrypted with the wrong key.
 */
export async function decryptCipher(
  cipher,
  userKey,
  organizationKeys = {},
) {
  const organizationId =
    cipher.OrganizationId
    ?? cipher.organizationId
    ?? null

  const key = organizationId
    ? organizationKeyForId(
      organizationId,
      organizationKeys,
    )
    : userKey

  if (!key?.encKey || !key?.macKey) {
    throw new Error(
      organizationId
        ? `Kein Organisationsschlüssel für Eintrag ${cipher.Id ?? cipher.id ?? ''}`
        : 'Der Benutzerschlüssel ist nicht verfügbar.',
    )
  }

  const decryptionErrors = []

  const decrypt = async (
    value,
    field = 'unknown',
  ) => {
    if (!value) {
      return ''
    }

    try {
      return await decryptEncString(
        value,
        key.encKey,
        key.macKey,
      )
    } catch (exception) {
      decryptionErrors.push(field)
      console.warn(
        `[nc_bitwarden] Feld ${field} konnte nicht entschlüsselt werden:`,
        exception.message,
      )
      return ''
    }
  }

  const personalItem = !normalizeId(organizationId)

  const canEdit = Boolean(
    cipher.Edit
    ?? cipher.edit
    ?? personalItem,
  )

  const canViewPassword = Boolean(
    cipher.ViewPassword
    ?? cipher.viewPassword
    ?? personalItem,
  )

  const rawPermissions =
    cipher.Permissions
    ?? cipher.permissions
    ?? {}

  const base = {
    id: cipher.Id ?? cipher.id,
    type: cipher.Type ?? cipher.type,
    folderId: cipher.FolderId ?? cipher.folderId,
    collectionIds: Array.isArray(
      cipher.CollectionIds ?? cipher.collectionIds,
    )
      ? [...(cipher.CollectionIds ?? cipher.collectionIds)]
      : [],
    favorite: Boolean(
      cipher.Favorite ?? cipher.favorite,
    ),
    reprompt: Number(
      cipher.Reprompt
      ?? cipher.reprompt
      ?? 0,
    ) || 0,
    name: await decrypt(
      cipher.Name ?? cipher.name,
      'name',
    ),
    notes: await decrypt(
      cipher.Notes ?? cipher.notes,
      'notes',
    ),
    revisionDate:
      cipher.RevisionDate
      ?? cipher.revisionDate
      ?? null,
    passwordRevisionDate:
      cipher.PasswordRevisionDate
      ?? cipher.passwordRevisionDate
      ?? null,
    creationDate:
      cipher.CreationDate
      ?? cipher.creationDate
      ?? null,
    deletedDate:
      cipher.DeletedDate
      ?? cipher.deletedDate
      ?? null,
    organizationId,
    edit: canEdit,
    viewPassword: canViewPassword,
    decryptionFailed: false,
    decryptionErrorCount: 0,
    permissions: {
      delete: Boolean(
        rawPermissions.Delete
        ?? rawPermissions.delete
        ?? canEdit,
      ),
      restore: Boolean(
        rawPermissions.Restore
        ?? rawPermissions.restore
        ?? rawPermissions.Delete
        ?? rawPermissions.delete
        ?? canEdit,
      ),
    },
  }

  const rawPasswordHistory = Array.isArray(
    cipher.PasswordHistory ?? cipher.passwordHistory,
  )
    ? cipher.PasswordHistory ?? cipher.passwordHistory
    : []

  base.passwordHistory = (
    await Promise.all(
      rawPasswordHistory.map(
        async (entry, index) => ({
          password: await decrypt(
            entry.Password
              ?? entry.password
              ?? '',
            `passwordHistory.${index}.password`,
          ),
          lastUsedDate:
            entry.LastUsedDate
            ?? entry.lastUsedDate
            ?? null,
        }),
      ),
    )
  ).filter(entry => entry.password)

  const rawAttachments = Array.isArray(
    cipher.Attachments ?? cipher.attachments,
  )
    ? cipher.Attachments ?? cipher.attachments
    : []

  base.attachments = await Promise.all(
    rawAttachments.map(async (attachment, index) => {
      const attachmentId =
        attachment.Id
        ?? attachment.id
        ?? ''

      const encryptedFileName =
        attachment.FileName
        ?? attachment.fileName
        ?? ''

      const encryptedKey =
        attachment.Key
        ?? attachment.key
        ?? ''

      const fileName = await decrypt(
        encryptedFileName,
        `attachments.${index}.fileName`,
      )

      try {
        const attachmentKey = encryptedKey
          ? await decryptSymmetricKey(
            encryptedKey,
            key,
          )
          : key

        return {
          id: attachmentId,
          fileName:
            fileName
            || 'Unbenannter Anhang',
          encryptedFileName,
          encryptedKey,
          key: attachmentKey,
          size: Number(
            attachment.Size
            ?? attachment.size
            ?? 0,
          ),
          sizeName:
            attachment.SizeName
            ?? attachment.sizeName
            ?? '',
          unavailable: false,
        }
      } catch (exception) {
        decryptionErrors.push(
          `attachments.${index}.key`,
        )

        console.warn(
          '[nc_bitwarden] Anhangsschlüssel konnte '
            + 'nicht entschlüsselt werden:',
          exception,
        )

        return {
          id: attachmentId,
          fileName:
            fileName
            || 'Nicht entschlüsselbarer Anhang',
          encryptedFileName,
          encryptedKey,
          key: null,
          size: Number(
            attachment.Size
            ?? attachment.size
            ?? 0,
          ),
          sizeName:
            attachment.SizeName
            ?? attachment.sizeName
            ?? '',
          unavailable: true,
          error: exception?.message ?? '',
        }
      }
    }),
  )

  switch (Number(base.type)) {
    case 1: {
      const login =
        cipher.Login
        ?? cipher.login
        ?? {}

      const decryptCredentialValue = async (
        value,
        field,
      ) => {
        if (value === null || value === undefined) {
          return ''
        }

        if (typeof value !== 'string') {
          return String(value)
        }

        return /^[0-6]\./u.test(value)
          ? decrypt(value, field)
          : value
      }

      const rawCredentials =
        login.Fido2Credentials
        ?? login.Fido2credentials
        ?? login.fido2Credentials
        ?? []

      base.login = {
        username: await decrypt(
          login.Username ?? login.username,
          'login.username',
        ),
        password: await decrypt(
          login.Password ?? login.password,
          'login.password',
        ),
        totp: await decrypt(
          login.Totp ?? login.totp,
          'login.totp',
        ),
        uris: await Promise.all(
          (login.Uris ?? login.uris ?? [])
            .map(async (uri, index) => ({
              uri: await decrypt(
                uri.Uri ?? uri.uri,
                `login.uris.${index}`,
              ),
              match: uri.Match ?? uri.match,
            })),
        ),
        passwordRevisionDate:
          login.PasswordRevisionDate
          ?? login.passwordRevisionDate
          ?? base.passwordRevisionDate,
        fido2Credentials: await Promise.all(
          rawCredentials.map(
            async (credential, index) => ({
              credentialId:
                await decryptCredentialValue(
                  credential.CredentialId
                    ?? credential.credentialId,
                  `login.passkeys.${index}.credentialId`,
                ),
              keyType:
                await decryptCredentialValue(
                  credential.KeyType
                    ?? credential.keyType,
                  `login.passkeys.${index}.keyType`,
                ),
              keyAlgorithm:
                await decryptCredentialValue(
                  credential.KeyAlgorithm
                    ?? credential.keyAlgorithm,
                  `login.passkeys.${index}.keyAlgorithm`,
                ),
              keyCurve:
                await decryptCredentialValue(
                  credential.KeyCurve
                    ?? credential.keyCurve,
                  `login.passkeys.${index}.keyCurve`,
                ),
              keyValue:
                await decryptCredentialValue(
                  credential.KeyValue
                    ?? credential.keyValue,
                  `login.passkeys.${index}.keyValue`,
                ),
              rpId: await decryptCredentialValue(
                credential.RpId
                  ?? credential.rpId,
                `login.passkeys.${index}.rpId`,
              ),
              rpName: await decryptCredentialValue(
                credential.RpName
                  ?? credential.rpName,
                `login.passkeys.${index}.rpName`,
              ),
              userHandle:
                await decryptCredentialValue(
                  credential.UserHandle
                    ?? credential.userHandle,
                  `login.passkeys.${index}.userHandle`,
                ),
              userName:
                await decryptCredentialValue(
                  credential.UserName
                    ?? credential.userName,
                  `login.passkeys.${index}.userName`,
                ),
              userDisplayName:
                await decryptCredentialValue(
                  credential.UserDisplayName
                    ?? credential.userDisplayName,
                  `login.passkeys.${index}.userDisplayName`,
                ),
              counter:
                await decryptCredentialValue(
                  credential.Counter
                    ?? credential.counter,
                  `login.passkeys.${index}.counter`,
                ),
              discoverable:
                await decryptCredentialValue(
                  credential.Discoverable
                    ?? credential.discoverable,
                  `login.passkeys.${index}.discoverable`,
                ),
              creationDate:
                credential.CreationDate
                ?? credential.creationDate
                ?? null,
            }),
          ),
        ),
      }
      break
    }

    case 2:
      break

    case 3: {
      const card =
        cipher.Card
        ?? cipher.card
        ?? {}

      base.card = {
        cardholderName: await decrypt(
          card.CardholderName ?? card.cardholderName,
          'card.cardholderName',
        ),
        brand: await decrypt(
          card.Brand ?? card.brand,
          'card.brand',
        ),
        number: await decrypt(
          card.Number ?? card.number,
          'card.number',
        ),
        expMonth: await decrypt(
          card.ExpMonth ?? card.expMonth,
          'card.expMonth',
        ),
        expYear: await decrypt(
          card.ExpYear ?? card.expYear,
          'card.expYear',
        ),
        code: await decrypt(
          card.Code ?? card.code,
          'card.code',
        ),
      }
      break
    }

    case 4: {
      const identity =
        cipher.Identity
        ?? cipher.identity
        ?? {}

      const field = (name, camelName) =>
        identity[name] ?? identity[camelName]

      base.identity = {
        title: await decrypt(
          field('Title', 'title'),
          'identity.title',
        ),
        firstName: await decrypt(
          field('FirstName', 'firstName'),
          'identity.firstName',
        ),
        middleName: await decrypt(
          field('MiddleName', 'middleName'),
          'identity.middleName',
        ),
        lastName: await decrypt(
          field('LastName', 'lastName'),
          'identity.lastName',
        ),
        username: await decrypt(
          field('Username', 'username'),
          'identity.username',
        ),
        company: await decrypt(
          field('Company', 'company'),
          'identity.company',
        ),
        email: await decrypt(
          field('Email', 'email'),
          'identity.email',
        ),
        phone: await decrypt(
          field('Phone', 'phone'),
          'identity.phone',
        ),
        address1: await decrypt(
          field('Address1', 'address1'),
          'identity.address1',
        ),
        address2: await decrypt(
          field('Address2', 'address2'),
          'identity.address2',
        ),
        address3: await decrypt(
          field('Address3', 'address3'),
          'identity.address3',
        ),
        city: await decrypt(
          field('City', 'city'),
          'identity.city',
        ),
        state: await decrypt(
          field('State', 'state'),
          'identity.state',
        ),
        postalCode: await decrypt(
          field('PostalCode', 'postalCode'),
          'identity.postalCode',
        ),
        country: await decrypt(
          field('Country', 'country'),
          'identity.country',
        ),
        ssn: await decrypt(
          field('Ssn', 'ssn'),
          'identity.ssn',
        ),
        passportNumber: await decrypt(
          field('PassportNumber', 'passportNumber'),
          'identity.passportNumber',
        ),
        licenseNumber: await decrypt(
          field('LicenseNumber', 'licenseNumber'),
          'identity.licenseNumber',
        ),
      }
      break
    }

    case 5: {
      const sshKey =
        cipher.SshKey
        ?? cipher.SSHKey
        ?? cipher.sshKey
        ?? {}

      base.sshKey = {
        privateKey: await decrypt(
          sshKey.PrivateKey ?? sshKey.privateKey,
          'sshKey.privateKey',
        ),
        publicKey: await decrypt(
          sshKey.PublicKey ?? sshKey.publicKey,
          'sshKey.publicKey',
        ),
        keyFingerprint: await decrypt(
          sshKey.KeyFingerprint
            ?? sshKey.keyFingerprint,
          'sshKey.keyFingerprint',
        ),
      }
      break
    }
  }

  const rawFields =
    cipher.Fields
    ?? cipher.fields
    ?? []

  if (Array.isArray(rawFields) && rawFields.length > 0) {
    base.fields = await Promise.all(
      rawFields.map(async (field, index) => ({
        type: field.Type ?? field.type,
        name: await decrypt(
          field.Name ?? field.name,
          `fields.${index}.name`,
        ),
        value: await decrypt(
          field.Value ?? field.value,
          `fields.${index}.value`,
        ),
        linkedId:
          field.LinkedId
          ?? field.linkedId
          ?? null,
      })),
    )
  }

  if (decryptionErrors.length > 0) {
    base.decryptionFailed = true
    base.decryptionErrorCount =
      decryptionErrors.length
    base.edit = false
    base.viewPassword = false
  }

  return base
}
