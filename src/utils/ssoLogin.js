export function shouldAutoStartSso({
  ssoEnabled = false,
  classicLoginAllowed = true,
  hasSsoReturn = false,
  reauthenticate = false,
} = {}) {
  return ssoEnabled === true
    && classicLoginAllowed === false
    && hasSsoReturn === false
    && reauthenticate === false
}
