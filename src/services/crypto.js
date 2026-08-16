/**
 *
 * Bitwarden Crypto – Client-Side Vault Decryption
 * PBKDF2 / Argon2id · AES-256-CBC · HMAC-SHA256 · RSA-OAEP (Org-Keys)
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function b64ToBuffer(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function bufferToB64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

// ─── Key Derivation ───────────────────────────────────────────────────────────

export async function deriveMasterKeyPBKDF2(password, email, iterations = 600000) {
  const mat = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(email.trim().toLowerCase()), iterations },
    mat, 256,
  )
}

export async function deriveMasterKeyArgon2id(password, email, memory, iterations, parallelism) {
  const { argon2id } = await import('@noble/hashes/argon2')
  const saltBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(email.trim().toLowerCase()))
  const hash = argon2id(encoder.encode(password), new Uint8Array(saltBuffer), {
    t: iterations, m: memory * 1024, p: parallelism, dkLen: 32,
  })
  return hash.buffer
}

export async function makeMasterPasswordHash(masterKeyBuffer, password) {
  const key = await crypto.subtle.importKey('raw', masterKeyBuffer, 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(password), iterations: 1 },
    key, 256,
  )
  return bufferToB64(hash)
}

// HKDF-Expand (kein Extract) – entspricht Bitwarden hkdfExpand()
async function hkdfExpand(prkBuffer, info, outputLen = 32) {
  const prk = await crypto.subtle.importKey('raw', prkBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const input = new Uint8Array(encoder.encode(info).length + 1)
  input.set(encoder.encode(info))
  input[input.length - 1] = 0x01
  return new Uint8Array(await crypto.subtle.sign('HMAC', prk, input)).slice(0, outputLen).buffer
}

export async function stretchMasterKey(masterKeyBuffer) {
  const [encKey, macKey] = await Promise.all([
    hkdfExpand(masterKeyBuffer, 'enc', 32),
    hkdfExpand(masterKeyBuffer, 'mac', 32),
  ])
  return { encKey, macKey }
}

// ─── EncString Parsing ────────────────────────────────────────────────────────

/**
 * Parsed AES-EncStrings (Typ 0/1/2) → { type, iv, ct, mac }
 * Parsed RSA-EncStrings (Typ 3/4/5/6) → { type, ct }  (kein IV)
 */
const AES_BLOCK_BYTES = 16
const HMAC_SHA256_BYTES = 32

function decodeEncStringPart(value, label) {
  try {
    const decoded = b64ToBuffer(value)

    if (decoded.byteLength === 0) {
      throw new Error('empty value')
    }

    return decoded
  } catch (exception) {
    throw new Error(
      `Invalid ${label} in encrypted string.`,
      { cause: exception },
    )
  }
}

export function parseEncString(encStr) {
  if (!encStr || typeof encStr !== 'string') return null

  const dotIdx = encStr.indexOf('.')
  if (dotIdx < 1) return null

  const type = Number(encStr.slice(0, dotIdx))

  if (!Number.isInteger(type) || type < 0 || type > 6) {
    throw new Error('Unsupported encrypted string type.')
  }

  const parts = encStr.slice(dotIdx + 1).split('|')

  if (type >= 3) {
    if (parts.length < 1 || parts.length > 2 || !parts[0]) {
      throw new Error('Invalid RSA encrypted string.')
    }

    return {
      type,
      ct: decodeEncStringPart(parts[0], 'RSA ciphertext'),
      mac: parts[1]
        ? decodeEncStringPart(parts[1], 'RSA MAC')
        : null,
    }
  }

  if (
    parts.length < 2
    || parts.length > 3
    || !parts[0]
    || !parts[1]
  ) {
    throw new Error('Invalid AES encrypted string.')
  }

  const iv = decodeEncStringPart(parts[0], 'IV')
  const ct = decodeEncStringPart(parts[1], 'ciphertext')
  const mac = parts[2]
    ? decodeEncStringPart(parts[2], 'HMAC')
    : null

  if (iv.byteLength !== AES_BLOCK_BYTES) {
    throw new Error('Invalid IV length in encrypted string.')
  }

  if (
    ct.byteLength === 0
    || ct.byteLength % AES_BLOCK_BYTES !== 0
  ) {
    throw new Error('Invalid ciphertext length in encrypted string.')
  }

  if ((type === 1 || type === 2) && !mac) {
    throw new Error('Encrypted string is missing its HMAC.')
  }

  if (mac && mac.byteLength !== HMAC_SHA256_BYTES) {
    throw new Error('Invalid HMAC length in encrypted string.')
  }

  return {
    type,
    iv,
    ct,
    mac,
  }
}

// ─── AES-CBC Decryption ───────────────────────────────────────────────────────

async function verifyHmac(iv, ct, mac, macKeyBuffer) {
  const macKey = await crypto.subtle.importKey('raw', macKeyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const combined = new Uint8Array(iv.byteLength + ct.byteLength)
  combined.set(new Uint8Array(iv))
  combined.set(new Uint8Array(ct), iv.byteLength)
  return crypto.subtle.verify('HMAC', macKey, mac, combined)
}

export async function decryptEncStringRaw(encStr, encKeyBuffer, macKeyBuffer) {
  const parsed = parseEncString(encStr)

  if (!parsed) {
    throw new Error(
      `Invalid encrypted string: ${String(encStr).substring(0, 20)}`,
    )
  }

  if (parsed.type > 2 || !parsed.iv) {
    throw new Error(
      `Encrypted string type ${parsed.type} is not an AES payload.`,
    )
  }

  const encryptionKeyLength = encKeyBuffer?.byteLength ?? 0

  if (![16, 24, 32].includes(encryptionKeyLength)) {
    throw new Error('Invalid AES encryption key length.')
  }

  if (parsed.type === 1 || parsed.type === 2) {
    if (!parsed.mac || !macKeyBuffer) {
      throw new Error('Authenticated encrypted string is missing its HMAC key.')
    }
  }

  if (parsed.mac) {
    if (macKeyBuffer?.byteLength !== HMAC_SHA256_BYTES) {
      throw new Error('Invalid HMAC key length.')
    }

    const valid = await verifyHmac(
      parsed.iv,
      parsed.ct,
      parsed.mac,
      macKeyBuffer,
    )

    if (!valid) {
      throw new Error('HMAC verification failed.')
    }
  }

  const decKey = await crypto.subtle.importKey(
    'raw',
    encKeyBuffer,
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  )

  return crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: parsed.iv },
    decKey,
    parsed.ct,
  )
}

/** decryptEncString gibt '' zurück wenn encStr leer/null – kein Crash */
export async function decryptEncString(encStr, encKeyBuffer, macKeyBuffer) {
  if (!encStr) return ''
  const raw = await decryptEncStringRaw(encStr, encKeyBuffer, macKeyBuffer)
  return decoder.decode(raw)
}

// ─── User Symmetric Key ───────────────────────────────────────────────────────

export async function decryptUserSymmetricKey(encKeyString, masterKeyBuffer) {
  const stretched = await stretchMasterKey(masterKeyBuffer)
  const raw = await decryptEncStringRaw(
    encKeyString,
    stretched.encKey,
    stretched.macKey,
  )
  const bytes = new Uint8Array(raw)

  if (bytes.byteLength !== 64) {
    throw new Error(
      `Invalid decrypted user key length: ${bytes.byteLength}; expected 64.`,
    )
  }

  return {
    encKey: bytes.slice(0, 32).buffer,
    macKey: bytes.slice(32, 64).buffer,
  }
}

// ─── RSA: Organisation-Key Decryption ─────────────────────────────────────────

/**
 * RSA Private Key entschlüsseln
 * Profile.PrivateKey = AES-CBC-256-HMAC (Typ 2) verschlüsselt mit User Symmetric Key
 */
export async function decryptRsaPrivateKey(encPrivateKeyStr, userKey) {
  const rawPkcs8 = await decryptEncStringRaw(encPrivateKeyStr, userKey.encKey, userKey.macKey)
  // Zuerst SHA-1 versuchen (Bitwarden-Standard), dann SHA-256 als Fallback
  for (const hash of ['SHA-1', 'SHA-256']) {
    try {
      return await crypto.subtle.importKey(
        'pkcs8', rawPkcs8, { name: 'RSA-OAEP', hash }, false, ['decrypt'],
      )
    } catch { /* nächsten Hash versuchen */ }
  }
  throw new Error('RSA Private Key konnte nicht importiert werden')
}

/**
 * Organisations-Keys entschlüsseln
 * org.Key = RSA-OAEP (Typ 4 oder 6) verschlüsselt mit User RSA Public Key
 * Ergebnis: Map { orgId → { encKey, macKey } }
 */
export async function decryptOrgKeys(organizations = [], rsaPrivateKey) {
  const keys = {}
  await Promise.allSettled(organizations.map(async (org) => {
    try {
      const parsed = parseEncString(org.Key)
      if (!parsed || !parsed.ct) return
      const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsaPrivateKey, parsed.ct)
      const bytes = new Uint8Array(raw)
      keys[org.Id] = { encKey: bytes.slice(0, 32).buffer, macKey: bytes.slice(32, 64).buffer }
    } catch (e) {
      console.warn(`[nc_bitwarden] Org-Key ${org.Id} nicht entschlüsselbar:`, e.message)
    }
  }))
  return keys
}

// ─── Encryption ───────────────────────────────────────────────────────────────

export async function encryptBuffer(buffer, encKeyBuffer, macKeyBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encKey = await crypto.subtle.importKey('raw', encKeyBuffer, { name: 'AES-CBC' }, false, ['encrypt'])
  const ct = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, encKey, buffer)
  const combined = new Uint8Array(iv.byteLength + ct.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ct), iv.byteLength)
  const macKey = await crypto.subtle.importKey('raw', macKeyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', macKey, combined)
  return `2.${bufferToB64(iv.buffer)}|${bufferToB64(ct)}|${bufferToB64(mac)}`
}

export async function encryptString(plaintext, encKeyBuffer, macKeyBuffer) {
  if (!plaintext) return null
  return encryptBuffer(encoder.encode(plaintext).buffer, encKeyBuffer, macKeyBuffer)
}

/** Erstellt den zufälligen 512-Bit-Benutzerschlüssel eines neuen Tresors. */
export function generateUserSymmetricKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(64))
  return {
    encKey: bytes.slice(0, 32).buffer,
    macKey: bytes.slice(32, 64).buffer,
  }
}

/**
 * Wandelt einen zweigeteilten Bitwarden-Schlüssel in 64 Rohbytes um.
 */
export function symmetricKeyToBuffer(key) {
  if (!key?.encKey || !key?.macKey) {
    throw new Error(
      'Ungültiger symmetrischer Schlüssel.',
    )
  }

  const raw = new Uint8Array(64)

  raw.set(new Uint8Array(key.encKey), 0)
  raw.set(new Uint8Array(key.macKey), 32)

  return raw.buffer
}

/**
 * Verschlüsselt einen 64-Byte-Anhangsschlüssel mit dem
 * Benutzer- oder Organisationsschlüssel des Eintrags.
 */
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

/**
 * Entschlüsselt einen gespeicherten Anhangsschlüssel.
 */
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

/**
 * Bitwarden EncArrayBuffer:
 *
 * Byte 0      : Verschlüsselungstyp 2
 * Byte 1–16   : IV
 * Byte 17–48  : HMAC-SHA256
 * ab Byte 49  : AES-CBC-Ciphertext
 */
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

  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    key.encKey,
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  )

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

  const macKey = await crypto.subtle.importKey(
    'raw',
    key.macKey,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
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

/**
 * Entschlüsselt ein Bitwarden-EncArrayBuffer vollständig im Browser.
 */
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

  const authenticatedData = new Uint8Array(
    iv.byteLength + ciphertext.byteLength,
  )

  authenticatedData.set(iv, 0)
  authenticatedData.set(
    ciphertext,
    iv.byteLength,
  )

  const macKey = await crypto.subtle.importKey(
    'raw',
    key.macKey,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['verify'],
  )

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

  const decryptionKey = await crypto.subtle.importKey(
    'raw',
    key.encKey,
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  )

  return crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    decryptionKey,
    ciphertext,
  )
}

/** Verschlüsselt den Benutzerschlüssel mit dem gestreckten Master-Key. */
export async function encryptUserSymmetricKey(userKey, masterKeyBuffer) {
  const raw = new Uint8Array(64)
  raw.set(new Uint8Array(userKey.encKey), 0)
  raw.set(new Uint8Array(userKey.macKey), 32)
  const stretched = await stretchMasterKey(masterKeyBuffer)
  return encryptBuffer(raw.buffer, stretched.encKey, stretched.macKey)
}

/** Erstellt das RSA-OAEP-Schlüsselpaar für Organisations-Tresore. */
export async function generateEncryptedRsaKeyPair(userKey) {
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
    crypto.subtle.exportKey('spki', keyPair.publicKey),
    crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
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

// ─── Vault Item Decryption ────────────────────────────────────────────────────

/**
 * dec() fängt Fehler ab und gibt '' zurück statt zu crashen.
 * Org-Ciphers nutzen orgKey statt userKey.
 *
 * @param {Object} cipher  – Cipher-Objekt aus Bitwarden Sync
 * @param {Object} userKey – { encKey, macKey } des eingeloggten Benutzers
 * @param {Object} orgKeys – Map { orgId → { encKey, macKey } } (kann leer sein)
 */
export async function decryptCipher(cipher, userKey, orgKeys = {}) {
  const organizationId =
    cipher.OrganizationId
    ?? cipher.organizationId
    ?? null

  let key = userKey

  if (organizationId) {
    key = orgKeys[organizationId]
      ?? Object.entries(orgKeys).find(([id]) =>
        String(id).toLowerCase()
          === String(organizationId).toLowerCase(),
      )?.[1]
      ?? null
  }

  if (!key?.encKey || !key?.macKey) {
    throw new Error(
      organizationId
        ? `No organization key is available for cipher ${cipher.Id ?? cipher.id ?? ''}.`
        : 'The user encryption key is unavailable.',
    )
  }

  const decryptionErrors = []

  function recordDecryptionError(field, exception) {
    if (decryptionErrors.length >= 32) {
      return
    }

    decryptionErrors.push({
      field,
      message: exception?.message ?? String(exception),
    })
  }

  const dec = async (value, field = 'encrypted field') => {
    if (!value) return ''

    try {
      return await decryptEncString(
        value,
        key.encKey,
        key.macKey,
      )
    } catch (exception) {
      recordDecryptionError(field, exception)
      console.warn(
        `[nc_bitwarden] Decryption failed for ${field}:`,
        exception?.message ?? exception,
      )
      return ''
    }
  }

  /*
   * Vaultwarden berechnet die effektiven Rechte pro Cipher.
   * Diese Werte dürfen beim Entschlüsseln nicht verloren gehen.
   *
   * Persönliche Einträge gelten bei älteren Serverantworten
   * weiterhin als vollständig verwendbar. Bei einem
   * Organisationseintrag ohne Berechtigungsfelder verwenden
   * wir dagegen bewusst die sichere Standardeinstellung false.
   */
  const personalItem = !String(
    organizationId ?? '',
  ).trim()

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

  const canDelete = Boolean(
    rawPermissions.Delete
    ?? rawPermissions.delete
    ?? canEdit,
  )

  const canRestore = Boolean(
    rawPermissions.Restore
    ?? rawPermissions.restore
    ?? canDelete,
  )

  const base = {
    id: cipher.Id,
    type: cipher.Type,
    folderId: cipher.FolderId,
    collectionIds: Array.isArray(cipher.CollectionIds)
      ? cipher.CollectionIds
      : [],
    favorite: cipher.Favorite,
    reprompt: Number(
      cipher.Reprompt
      ?? cipher.reprompt
      ?? 0,
    ) || 0,
    name: await dec(cipher.Name),
    notes: await dec(cipher.Notes),
    revisionDate: cipher.RevisionDate,
    passwordRevisionDate:
      cipher.PasswordRevisionDate ?? null,
    creationDate: cipher.CreationDate ?? null,

    deletedDate:
      cipher.DeletedDate
      ?? cipher.deletedDate
      ?? null,

    organizationId,
    edit: canEdit,
    viewPassword: canViewPassword,
    permissions: {
      delete: canDelete,
      restore: canRestore,
    },
  }

  const rawPasswordHistory = Array.isArray(
    cipher.PasswordHistory,
  )
    ? cipher.PasswordHistory
    : (
      Array.isArray(cipher.passwordHistory)
        ? cipher.passwordHistory
        : []
    )

  base.passwordHistory = (
    await Promise.all(
      rawPasswordHistory.map(async entry => ({
        password: await dec(
          entry.Password
          ?? entry.password
          ?? '',
        ),
        lastUsedDate:
          entry.LastUsedDate
          ?? entry.lastUsedDate
          ?? null,
      })),
    )
  ).filter(entry => entry.password)

  const rawAttachments = Array.isArray(cipher.Attachments)
    ? cipher.Attachments
    : []

  base.attachments = await Promise.all(
    rawAttachments.map(async attachment => {
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

      const fileName = await dec(encryptedFileName)

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
        recordDecryptionError('attachment key', exception)
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

  switch (cipher.Type) {
    case 1: {
      const login = cipher.Login ?? {}
      const decryptCredentialValue = async value => {
        if (value === null || value === undefined) {
          return ''
        }

        if (typeof value !== 'string') {
          return String(value)
        }

        return /^[0-6]\./.test(value)
          ? dec(value)
          : value
      }

      const rawCredentials =
        login.Fido2Credentials
        ?? login.Fido2credentials
        ?? []

      base.login = {
        username: await dec(login.Username),
        password: await dec(login.Password),
        totp: await dec(login.Totp),
        uris: await Promise.all(
          (login.Uris ?? []).map(async uri => ({
            uri: await dec(uri.Uri),
            match: uri.Match,
          })),
        ),
        passwordRevisionDate:
          login.PasswordRevisionDate
          ?? cipher.PasswordRevisionDate
          ?? null,
        fido2Credentials: await Promise.all(
          rawCredentials.map(async credential => ({
            credentialId: await decryptCredentialValue(
              credential.CredentialId,
            ),
            keyType: await decryptCredentialValue(
              credential.KeyType,
            ),
            keyAlgorithm: await decryptCredentialValue(
              credential.KeyAlgorithm,
            ),
            keyCurve: await decryptCredentialValue(
              credential.KeyCurve,
            ),
            keyValue: await decryptCredentialValue(
              credential.KeyValue,
            ),
            rpId: await decryptCredentialValue(
              credential.RpId,
            ),
            rpName: await decryptCredentialValue(
              credential.RpName,
            ),
            userHandle: await decryptCredentialValue(
              credential.UserHandle,
            ),
            userName: await decryptCredentialValue(
              credential.UserName,
            ),
            userDisplayName:
              await decryptCredentialValue(
                credential.UserDisplayName,
              ),
            counter: await decryptCredentialValue(
              credential.Counter,
            ),
            discoverable:
              await decryptCredentialValue(
                credential.Discoverable,
              ),
            creationDate:
              credential.CreationDate
              ?? credential.creationDate
              ?? null,
          })),
        ),
      }
      break
    }
    case 2: break // Secure Note – nur Name + Notes, kein weiteres Objekt
    case 3: {
      const card = cipher.Card ?? {}
      base.card = {
        cardholderName: await dec(card.CardholderName),
        brand: await dec(card.Brand),
        number: await dec(card.Number),
        expMonth: await dec(card.ExpMonth),
        expYear: await dec(card.ExpYear),
        code: await dec(card.Code),
      }
      break
    }
    case 4: {
      const id = cipher.Identity ?? {}
      base.identity = {
        title: await dec(id.Title),
        firstName: await dec(id.FirstName),
        middleName: await dec(id.MiddleName),
        lastName: await dec(id.LastName),
        username: await dec(id.Username),
        company: await dec(id.Company),
        email: await dec(id.Email),
        phone: await dec(id.Phone),
        address1: await dec(id.Address1),
        address2: await dec(id.Address2),
        address3: await dec(id.Address3),
        city: await dec(id.City),
        state: await dec(id.State),
        postalCode: await dec(id.PostalCode),
        country: await dec(id.Country),
        ssn: await dec(id.Ssn),
        passportNumber: await dec(id.PassportNumber),
        licenseNumber: await dec(id.LicenseNumber),
      }
      break
    }
    case 5: {
      const sshKey = cipher.SshKey ?? cipher.SSHKey ?? {}
      base.sshKey = {
        privateKey: await dec(
          sshKey.PrivateKey ?? sshKey.privateKey,
        ),
        publicKey: await dec(
          sshKey.PublicKey ?? sshKey.publicKey,
        ),
        keyFingerprint: await dec(
          sshKey.KeyFingerprint ?? sshKey.keyFingerprint,
        ),
      }
      break
    }
  }

  if (cipher.Fields?.length) {
    base.fields = await Promise.all(cipher.Fields.map(async f => ({
      type: f.Type,
      name: await dec(f.Name),
      value: await dec(f.Value),
      linkedId: f.LinkedId ?? null,
    })))
  }

  base.decryptionErrors = decryptionErrors
  base.decryptionFailed = decryptionErrors.length > 0

  if (base.decryptionFailed) {
    base.edit = false
    base.viewPassword = false
    base.permissions = {
      delete: false,
      restore: false,
    }
  }

  return base
}
