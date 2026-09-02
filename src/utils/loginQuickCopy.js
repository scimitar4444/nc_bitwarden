import { generateTotpPair } from './totp.js'

export const LOGIN_QUICK_COPY_PASSWORD = 'password'
export const LOGIN_QUICK_COPY_TOTP = 'totp'

function loginValue(item, type) {
  if (Number(item?.type) !== 1) {
    return ''
  }

  return String(
    item?.login?.[type]
    ?? '',
  )
}

export function canQuickCopyLoginValue(
  item,
  type,
  canViewPassword,
) {
  if (!canViewPassword) {
    return false
  }

  if (
    type !== LOGIN_QUICK_COPY_PASSWORD
    && type !== LOGIN_QUICK_COPY_TOTP
  ) {
    return false
  }

  return loginValue(item, type).trim().length > 0
}

export async function loginQuickCopyValue(
  item,
  type,
  timestamp = Date.now(),
) {
  const value = loginValue(item, type)

  if (!value) {
    return ''
  }

  if (type === LOGIN_QUICK_COPY_PASSWORD) {
    return value
  }

  if (type === LOGIN_QUICK_COPY_TOTP) {
    const result = await generateTotpPair(
      value,
      timestamp,
    )

    return result.currentCode
  }

  return ''
}
