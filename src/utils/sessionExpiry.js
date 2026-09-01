export const WARDEN_SESSION_EXPIRED_EVENT
  = 'nc-bitwarden:session-expired'

const PUBLIC_API_PATHS = new Set([
  'login',
  'logout',
  'prelogin',
  'refresh',
  'sso/result',
  'sso/two-factor',
])

function requestPath(url) {
  if (typeof url !== 'string' || url === '') {
    return ''
  }

  try {
    return new URL(url, 'https://warden.invalid').pathname
  } catch {
    return ''
  }
}

export function isProtectedWardenApiUrl(url) {
  const path = requestPath(url)
  const marker = '/apps/nc_bitwarden/api/'
  const markerIndex = path.indexOf(marker)

  if (markerIndex < 0) {
    return false
  }

  const endpoint = path
    .slice(markerIndex + marker.length)
    .replace(/^\/+|\/+$/gu, '')

  return endpoint !== '' && !PUBLIC_API_PATHS.has(endpoint)
}

export function isWardenSessionExpiredError(exception) {
  return Number(exception?.response?.status) === 401
    && isProtectedWardenApiUrl(exception?.config?.url)
}

export function shouldRestartLoginAfterInitialSessionExpiry({
  restoringSession = false,
  isLoggedIn = false,
  hasUserKey = false,
} = {}) {
  return restoringSession === true
    && isLoggedIn === true
    && hasUserKey === true
}

export function normalizeAccountEmail(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : ''
}

export function isExpectedAccount(expectedEmail, actualEmail) {
  const expected = normalizeAccountEmail(expectedEmail)
  const actual = normalizeAccountEmail(actualEmail)

  return expected === '' || (
    actual !== ''
    && expected === actual
  )
}
