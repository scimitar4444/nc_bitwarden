import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canQuickCopyLoginValue,
  loginQuickCopyValue,
  LOGIN_QUICK_COPY_PASSWORD,
  LOGIN_QUICK_COPY_TOTP,
} from '../src/utils/loginQuickCopy.js'

const loginItem = {
  type: 1,
  login: {
    password: ' correct horse battery staple ',
    totp:
      'otpauth://totp/Test'
      + '?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
      + '&digits=8&period=30',
  },
}

test('quick-copy actions require a login value and password visibility', () => {
  assert.equal(
    canQuickCopyLoginValue(
      loginItem,
      LOGIN_QUICK_COPY_PASSWORD,
      true,
    ),
    true,
  )
  assert.equal(
    canQuickCopyLoginValue(
      loginItem,
      LOGIN_QUICK_COPY_TOTP,
      false,
    ),
    false,
  )
  assert.equal(
    canQuickCopyLoginValue(
      { ...loginItem, type: 2 },
      LOGIN_QUICK_COPY_PASSWORD,
      true,
    ),
    false,
  )
  assert.equal(
    canQuickCopyLoginValue(
      {
        type: 1,
        login: { password: '   ' },
      },
      LOGIN_QUICK_COPY_PASSWORD,
      true,
    ),
    false,
  )
})

test('quick-copy resolves passwords and the current TOTP code', async () => {
  assert.equal(
    await loginQuickCopyValue(
      loginItem,
      LOGIN_QUICK_COPY_PASSWORD,
    ),
    ' correct horse battery staple ',
  )

  assert.equal(
    await loginQuickCopyValue(
      loginItem,
      LOGIN_QUICK_COPY_TOTP,
      59_000,
    ),
    '94287082',
  )
})
