<template>
  <div
    class="bw-login"
    :class="{
      'bw-login--embedded': embedded,
    }"
  >
    <div class="bw-login__card">
      <img
        src="../../img/app.svg"
        class="bw-login__logo"
        :alt="providerLabel"
      >

      <h2>{{ unlockTitle }}</h2>

      <NcNoteCard
        v-if="reauthenticate"
        type="info"
      >
        {{
          t(
            'nc_bitwarden',
            'Your open vault and unsaved changes will remain unchanged while you sign in again.',
          )
        }}
      </NcNoteCard>

      <NcNoteCard
        v-if="error"
        type="error"
      >
        {{ error }}
      </NcNoteCard>

      <NcNoteCard
        v-if="info"
        type="info"
      >
        {{ info }}
      </NcNoteCard>

      <NcNoteCard
        v-if="masterPasswordSetupRequired"
        type="warning"
        class="bw-login__password-loss-warning"
      >
        <div class="bw-login__password-loss-warning-content">
          <strong>
            {{
              t(
                'nc_bitwarden',
                'Important: No password reset is possible.',
              )
            }}
          </strong>

          <span>
            {{
              t(
                'nc_bitwarden',
                'If you lose this master password, the vault can no longer be decrypted. The Vaultwarden user must then be deleted and created again. Personal vault data will be lost.',
              )
            }}
          </span>
        </div>

        <label class="bw-login__password-loss-acknowledgement">
          <input
            v-model="masterPasswordLossAcknowledged"
            type="checkbox"
            :disabled="loading"
          >

          <span>
            {{
              t(
                'nc_bitwarden',
                'I understand that the master password cannot be reset and that losing it requires deleting and recreating my Vaultwarden account.',
              )
            }}
          </span>
        </label>
      </NcNoteCard>

      <NcNoteCard
        v-if="showSsoStartHint"
        type="info"
      >
        {{
          t(
            'nc_bitwarden',
            'Sign in with SSO first. The master password will only be requested after successful SSO authentication.',
          )
        }}
      </NcNoteCard>

      <template v-if="classicMode">
        <div class="bw-login__field">
          <NcTextField
            v-model="email"
            :label="t('nc_bitwarden', 'Email')"
            type="email"
            autocomplete="username"
            :disabled="loading"
          />
        </div>
      </template>

      <NcButton
        v-if="showPasskeyUnlock"
        variant="primary"
        :disabled="loading || passkeyUnlockLoading"
        wide
        class="bw-login__passkey-action"
        @click="unlockSsoResultWithPasskey"
      >
        <template #icon>
          <NcLoadingIcon
            v-if="passkeyUnlockLoading"
            :size="20"
          />
        </template>

        {{
          passkeyUnlockLoading
            ? t('nc_bitwarden', 'Unlocking with passkey…')
            : t('nc_bitwarden', 'Unlock with passkey')
        }}
      </NcButton>

      <p
        v-if="showPasskeyUnlock"
        class="bw-login__unlock-separator"
      >
        {{ t('nc_bitwarden', 'Use master password instead') }}
      </p>

      <div
        v-if="showMasterPasswordSection"
        class="bw-login__field"
      >
        <NcPasswordField
          v-model="masterPassword"
          :label="masterPasswordLabel"
          :autocomplete="
            masterPasswordSetupRequired
              ? 'new-password'
              : 'current-password'
          "
          :disabled="loading"
          @keyup.enter="submitPrimary"
        />
      </div>

      <div
        v-if="masterPasswordSetupRequired"
        class="bw-login__field"
      >
        <NcPasswordField
          v-model="confirmMasterPassword"
          :label="t('nc_bitwarden', 'Repeat master password')"
          autocomplete="new-password"
          :disabled="loading"
          @keyup.enter="submitPrimary"
        />
      </div>

      <ul
        v-if="masterPasswordSetupRequired"
        class="bw-login__policy"
      >
        <li :class="{ 'bw-login__policy-ok': passwordPolicyChecks.length }">
          {{
            t(
              'nc_bitwarden',
              'At least {count} characters',
              { count: effectivePasswordPolicy.min_length },
            )
          }}
        </li>
        <li
          v-if="effectivePasswordPolicy.require_lower"
          :class="{ 'bw-login__policy-ok': passwordPolicyChecks.lower }"
        >
          {{ t('nc_bitwarden', 'At least one lowercase letter') }}
        </li>
        <li
          v-if="effectivePasswordPolicy.require_upper"
          :class="{ 'bw-login__policy-ok': passwordPolicyChecks.upper }"
        >
          {{ t('nc_bitwarden', 'At least one uppercase letter') }}
        </li>
        <li
          v-if="effectivePasswordPolicy.require_number"
          :class="{ 'bw-login__policy-ok': passwordPolicyChecks.number }"
        >
          {{ t('nc_bitwarden', 'At least one number') }}
        </li>
        <li
          v-if="effectivePasswordPolicy.require_special"
          :class="{ 'bw-login__policy-ok': passwordPolicyChecks.special }"
        >
          {{ t('nc_bitwarden', 'At least one special character') }}
        </li>
        <li :class="{ 'bw-login__policy-ok': passwordPolicyChecks.match }">
          {{ t('nc_bitwarden', 'Passwords match') }}
        </li>
      </ul>

      <div
        v-if="classicMode"
        class="bw-login__field"
      >
        <NcTextField
          v-model="classicTwoFactorToken"
          :label="
            t(
              'nc_bitwarden',
              'Authenticator code (if enabled)',
            )
          "
          inputmode="numeric"
          autocomplete="one-time-code"
          :disabled="loading"
          @keyup.enter="submitPrimary"
        />
      </div>

      <div
        v-if="!classicMode && ssoTwoFactorRequired"
        class="bw-login__field"
      >
        <NcTextField
          v-model="ssoTwoFactorToken"
          :label="
            t(
              'nc_bitwarden',
              'Vaultwarden authenticator code',
            )
          "
          inputmode="numeric"
          autocomplete="one-time-code"
          :disabled="loading"
          @keyup.enter="submitPrimary"
        />
      </div>

      <label
        v-if="showMasterPasswordSection"
        class="bw-login__remember"
      >
        <input
          v-model="keepUnlocked"
          type="checkbox"
          :disabled="
            loading
              || tabUnlockMode !== 'user_choice'
          "
        >

        <span>
          {{
            t(
              'nc_bitwarden',
              'Keep unlocked in this browser tab',
            )
          }}
        </span>
      </label>

      <small
        v-if="
          showMasterPasswordSection
            && tabUnlockMode !== 'user_choice'
        "
        class="bw-login__admin-policy"
      >
        {{
          t(
            'nc_bitwarden',
            'This setting is enforced by the administrator.',
          )
        }}
      </small>

      <NcButton
        :variant="showPasskeyUnlock ? 'secondary' : 'primary'"
        :disabled="primaryDisabled"
        wide
        class="bw-login__primary-action"
        @click="submitPrimary"
      >
        <template #icon>
          <NcLoadingIcon
            v-if="loading"
            :size="20"
          />
        </template>

        {{ primaryLabel }}
      </NcButton>

      <NcButton
        v-if="ssoEnabled && classicLoginAllowed"
        class="bw-login__alternative"
        variant="secondary"
        :disabled="loading"
        wide
        @click="toggleLoginMode"
      >
        {{
          classicMode
            ? t('nc_bitwarden', 'Use SSO login')
            : t('nc_bitwarden', 'Use classic login')
        }}
      </NcButton>

      <p class="bw-login__hint">
        <LockOutlineIcon :size="16" />

        <span v-if="classicMode">
          {{
            t(
              'nc_bitwarden',
              'Your master password never leaves this browser. Only the derived hash is used for authentication.',
            )
          }}
        </span>

        <span v-else>
          {{
            t(
              'nc_bitwarden',
              'SSO authenticates your account. Your master password is used only in this browser to decrypt the vault.',
            )
          }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcPasswordField from '@nextcloud/vue/components/NcPasswordField'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import LockOutlineIcon from 'vue-material-design-icons/LockOutline.vue'
import { VaultwardenApi } from '../services/api.js'
import {
  decryptUserSymmetricKey,
  makeMasterPasswordHash,
} from '../services/crypto.js'
import {
  deriveMasterKey,
} from '../services/kdf.js'
import {
  unlockUserKeyWithPasskey,
} from '../services/passkeyPrf.js'
import {
  completeInitialSsoSetup,
} from '../services/ssoOnboarding.js'
import {
  isExpectedAccount,
} from '../utils/sessionExpiry.js'
import {
  shouldAutoStartSso,
} from '../utils/ssoLogin.js'

const props = defineProps({
  embedded: {
    type: Boolean,
    default: false,
  },
  expectedEmail: {
    type: String,
    default: '',
  },
  reauthenticate: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'logged-in',
  'session-restored',
])

const email = ref('')
const masterPassword = ref('')
const confirmMasterPassword = ref('')
const classicTwoFactorToken = ref('')
const ssoTwoFactorToken = ref('')

const classicTwoFactorRequired = ref(false)
const ssoTwoFactorRequired = ref(false)
const pendingSsoResult = ref(null)
const masterPasswordSetupRequired = ref(false)
const masterPasswordPolicy = ref({
  min_length: 12,
  require_lower: false,
  require_upper: false,
  require_number: false,
  require_special: false,
})

const keepUnlocked = ref(true)
const tabUnlockMode = ref('user_choice')

const effectiveKeepUnlocked = computed(() => {
  if (tabUnlockMode.value === 'forced_enabled') {
    return true
  }

  if (tabUnlockMode.value === 'forced_disabled') {
    return false
  }

  return keepUnlocked.value
})

function applyTabUnlockSettings(settings) {
  const mode = settings.tab_unlock_mode

  tabUnlockMode.value = [
    'forced_enabled',
    'forced_disabled',
    'user_choice',
  ].includes(mode)
    ? mode
    : 'user_choice'

  if (tabUnlockMode.value === 'forced_enabled') {
    keepUnlocked.value = true
  } else if (tabUnlockMode.value === 'forced_disabled') {
    keepUnlocked.value = false
  } else {
    keepUnlocked.value
      = settings.tab_unlock_default !== false
  }
}
const masterPasswordLossAcknowledged = ref(false)
const loading = ref(false)
const error = ref('')
const info = ref('')

const passkeyUnlockConfig = ref(null)
const passkeyUnlockLoading = ref(false)
const passkeyUnlockEnabled = ref(false)

const serverType = ref('')
const customUrl = ref('')
const ssoEnabled = ref(false)
const classicLoginAllowed = ref(true)
const classicMode = ref(true)

let ssoPopup = null

function toPascal(value) {
  if (Array.isArray(value)) {
    return value.map(toPascal)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key[0].toUpperCase() + key.slice(1),
        toPascal(item),
      ]),
    )
  }

  return value
}

const providerLabel = computed(() => {
  if (
    serverType.value === 'cloud_us'
    || serverType.value === 'cloud_eu'
  ) {
    return t('nc_bitwarden', 'Bitwarden')
  }

  if (serverType.value === 'selfhosted') {
    return t('nc_bitwarden', 'Vaultwarden')
  }

  return t('nc_bitwarden', 'Password vault')
})

const unlockTitle = computed(() => {
  if (props.reauthenticate) {
    return t('nc_bitwarden', 'Sign in again')
  }

  if (
    serverType.value === 'cloud_us'
    || serverType.value === 'cloud_eu'
  ) {
    return t('nc_bitwarden', 'Unlock Bitwarden')
  }

  if (serverType.value === 'selfhosted') {
    return t('nc_bitwarden', 'Unlock Vaultwarden')
  }

  return t('nc_bitwarden', 'Unlock password vault')
})

const showMasterPasswordSection = computed(() => (
  classicMode.value
  || masterPasswordSetupRequired.value
  || pendingSsoResult.value !== null
))

const showPasskeyUnlock = computed(() => (
  !classicMode.value
  && pendingSsoResult.value !== null
  && !masterPasswordSetupRequired.value
  && passkeyUnlockConfig.value !== null
))

const showSsoStartHint = computed(() => (
  !classicMode.value
  && !ssoTwoFactorRequired.value
  && pendingSsoResult.value === null
))

const effectivePasswordPolicy = computed(() => (
  normalizePasswordPolicy(masterPasswordPolicy.value)
))

const passwordPolicyChecks = computed(() => {
  const password = masterPassword.value
  const policy = effectivePasswordPolicy.value

  return {
    length: [...password].length >= policy.min_length,
    lower: !policy.require_lower || /\p{Ll}/u.test(password),
    upper: !policy.require_upper || /\p{Lu}/u.test(password),
    number: !policy.require_number || /\p{N}/u.test(password),
    special: !policy.require_special
      || /[^\p{L}\p{N}\s]/u.test(password),
    match: Boolean(confirmMasterPassword.value)
      && password === confirmMasterPassword.value,
  }
})

const passwordPolicySatisfied = computed(() => (
  Object.values(passwordPolicyChecks.value).every(Boolean)
))

const masterPasswordLabel = computed(() => (
  masterPasswordSetupRequired.value
    ? t('nc_bitwarden', 'Create master password')
    : t('nc_bitwarden', 'Master password')
))

const primaryLabel = computed(() => {
  if (loading.value) {
    return t('nc_bitwarden', 'Processing…')
  }

  if (classicMode.value) {
    return t('nc_bitwarden', 'Unlock')
  }

  if (ssoTwoFactorRequired.value) {
    return t('nc_bitwarden', 'Continue SSO login')
  }

  if (masterPasswordSetupRequired.value) {
    return t(
      'nc_bitwarden',
      'Set master password and open vault',
    )
  }

  if (pendingSsoResult.value) {
    return t('nc_bitwarden', 'Unlock vault')
  }

  return t('nc_bitwarden', 'Sign in with SSO')
})

const primaryDisabled = computed(() => {
  if (
    masterPasswordSetupRequired.value
    && !masterPasswordLossAcknowledged.value
  ) {
    return true
  }

  if (loading.value) {
    return true
  }

  if (classicMode.value) {
    return (
      !email.value.trim()
      || !masterPassword.value
      || (
        classicTwoFactorRequired.value
        && !classicTwoFactorToken.value.trim()
      )
    )
  }

  if (ssoTwoFactorRequired.value) {
    return !ssoTwoFactorToken.value.trim()
  }

  if (masterPasswordSetupRequired.value) {
    return !passwordPolicySatisfied.value
  }

  if (pendingSsoResult.value) {
    return !masterPassword.value
  }

  return false
})

onMounted(async () => {
  window.addEventListener('message', handleSsoMessage)

  const ssoReturn = consumeSsoReturn()

  if (ssoReturn.handledByOpener) {
    return
  }

  const [
    settingsResult,
    profileResult,
  ] = await Promise.allSettled([
    VaultwardenApi.getSettings(),
    VaultwardenApi.getCurrentUserProfile(),
  ])

  let useNextcloudEmail = true

  if (settingsResult.status === 'fulfilled') {
    const settings = settingsResult.value ?? {}

    serverType.value = settings.server_type ?? ''
    customUrl.value = settings.custom_url ?? ''
    ssoEnabled.value = settings.sso_enabled === true
    passkeyUnlockEnabled.value
      = settings.passkey_unlock_enabled === true
    classicLoginAllowed.value
      = settings.classic_login_allowed !== false

    applyTabUnlockSettings(settings)

    classicMode.value = !ssoEnabled.value

    useNextcloudEmail
      = settings.use_nextcloud_email !== false

    if (!useNextcloudEmail) {
      const configuredEmail = settings.login_email?.trim()

      if (configuredEmail) {
        email.value = configuredEmail
      }
    }
  } else {
    console.warn(
      '[nc_bitwarden] Settings could not be loaded:',
      settingsResult.reason,
    )
  }

  if (
    useNextcloudEmail
    && profileResult.status === 'fulfilled'
  ) {
    const profileEmail
      = profileResult.value?.email?.trim()

    if (!email.value && profileEmail) {
      email.value = profileEmail
    }
  } else if (
    useNextcloudEmail
    && profileResult.status === 'rejected'
  ) {
    console.warn(
      '[nc_bitwarden] Nextcloud email could not be loaded:',
      profileResult.reason,
    )
  }

  if (ssoReturn.status) {
    await processSsoStatus(ssoReturn.status)
    return
  }

  if (
    shouldAutoStartSso({
      ssoEnabled: ssoEnabled.value,
      classicLoginAllowed:
        classicLoginAllowed.value,
      hasSsoReturn: Boolean(ssoReturn.status),
      reauthenticate: props.reauthenticate,
    })
  ) {
    await startSsoLogin({
      redirectInPlace: true,
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleSsoMessage)

  if (ssoPopup && !ssoPopup.closed) {
    ssoPopup.close()
  }
})

function consumeSsoReturn() {
  const url = new URL(window.location.href)
  const status = url.searchParams.get('sso')

  if (!status) {
    return {
      handledByOpener: false,
      status: '',
    }
  }

  url.searchParams.delete('sso')
  window.history.replaceState(
    {},
    document.title,
    url.pathname + url.search + url.hash,
  )

  if (window.opener && window.opener !== window) {
    window.opener.postMessage(
      {
        source: 'warden-sso',
        status,
      },
      window.location.origin,
    )

    window.close()
    return {
      handledByOpener: true,
      status,
    }
  }

  return {
    handledByOpener: false,
    status,
  }
}

async function handleSsoMessage(event) {
  if (
    event.origin !== window.location.origin
    || event.data?.source !== 'warden-sso'
  ) {
    return
  }

  await processSsoStatus(event.data.status)
}

async function processSsoStatus(status) {
  error.value = ''
  info.value = ''

  if (status === 'twofactor') {
    ssoTwoFactorRequired.value = true
    ssoTwoFactorToken.value = ''

    info.value = t(
      'nc_bitwarden',
      'Two-step login is also enabled for this Vaultwarden account.',
    )

    return
  }

  if (status === 'complete') {
    await loadSsoResult()
    return
  }

  error.value = t(
    'nc_bitwarden',
    'SSO login failed. Please try again.',
  )
}

function toggleLoginMode() {
  classicMode.value = !classicMode.value
  error.value = ''
  info.value = ''

  classicTwoFactorRequired.value = false
  classicTwoFactorToken.value = ''
  ssoTwoFactorRequired.value = false
  ssoTwoFactorToken.value = ''
  pendingSsoResult.value = null
  masterPasswordSetupRequired.value = false
  masterPasswordPolicy.value = normalizePasswordPolicy({})
  masterPassword.value = ''
  confirmMasterPassword.value = ''
}

async function submitPrimary() {
  if (
    masterPasswordSetupRequired.value
    && !masterPasswordLossAcknowledged.value
  ) {
    return
  }

  if (classicMode.value) {
    await doClassicLogin()
    return
  }

  if (ssoTwoFactorRequired.value) {
    await completeSsoTwoFactor()
    return
  }

  if (masterPasswordSetupRequired.value) {
    await createInitialMasterPassword()
    return
  }

  if (pendingSsoResult.value) {
    await unlockSsoResult()
    return
  }

  await startSsoLogin()
}

async function startSsoLogin(options = {}) {
  const redirectInPlace
    = options?.redirectInPlace === true

  error.value = ''
  info.value = redirectInPlace
    ? t(
        'nc_bitwarden',
        'Signing in…',
      )
    : ''
  masterPassword.value = ''
  confirmMasterPassword.value = ''
  masterPasswordSetupRequired.value = false
  masterPasswordPolicy.value = normalizePasswordPolicy({})

  if (!redirectInPlace) {
    const width = 720
    const height = 760
    const left = Math.max(
      0,
      Math.round(
        window.screenX
          + (window.outerWidth - width) / 2,
      ),
    )
    const top = Math.max(
      0,
      Math.round(
        window.screenY
          + (window.outerHeight - height) / 2,
      ),
    )

    ssoPopup = window.open(
      'about:blank',
      'warden-sso-login',
      [
        'popup=yes',
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        'resizable=yes',
        'scrollbars=yes',
      ].join(','),
    )

    if (!ssoPopup) {
      error.value = t(
        'nc_bitwarden',
        'The SSO window was blocked by the browser.',
      )
      return
    }
  }

  loading.value = true

  try {
    const result = await VaultwardenApi.startSso()
    const authorizationUrl = String(
      result?.url ?? '',
    )

    if (!authorizationUrl.startsWith('https://')) {
      throw new Error(
        t(
          'nc_bitwarden',
          'SSO login failed. Please try again.',
        ),
      )
    }

    if (redirectInPlace) {
      window.location.assign(authorizationUrl)
      return
    }

    if (ssoPopup.closed) {
      throw new Error(
        t(
          'nc_bitwarden',
          'The SSO window was blocked by the browser.',
        ),
      )
    }

    ssoPopup.location.href = authorizationUrl
    ssoPopup.focus()
  } catch (exception) {
    if (ssoPopup && !ssoPopup.closed) {
      ssoPopup.close()
    }

    ssoPopup = null

    error.value = exception.response?.data?.error
      ?? exception.message
      ?? t(
        'nc_bitwarden',
        'SSO login failed. Please try again.',
      )
  } finally {
    loading.value = false
  }
}

async function completeSsoTwoFactor() {
  error.value = ''
  info.value = ''
  loading.value = true

  try {
    await VaultwardenApi.completeSsoTwoFactor(
      ssoTwoFactorToken.value.trim(),
    )

    ssoTwoFactorRequired.value = false
    ssoTwoFactorToken.value = ''

    await loadSsoResult()
  } catch (exception) {
    error.value = exception.response?.data?.error
      ?? exception.message
      ?? t(
        'nc_bitwarden',
        'The authenticator code is invalid or has expired.',
      )
  } finally {
    loading.value = false
  }
}

async function loadPasskeyUnlockConfig() {
  passkeyUnlockConfig.value = null

  if (!passkeyUnlockEnabled.value) {
    return
  }

  try {
    const config
      = await VaultwardenApi.getPasskeyUnlockConfig()

    if (
      config.enabled === true
      && config.configured === true
    ) {
      passkeyUnlockConfig.value = config
    }
  } catch (exception) {
    console.warn(
      '[nc_bitwarden] Passkey unlock configuration could not be loaded:',
      exception,
    )
  }
}

async function loadSsoResult() {
  loading.value = true

  try {
    const result = await VaultwardenApi.getSsoResult()

    pendingSsoResult.value = result
    email.value = result.email?.trim() ?? email.value
    masterPasswordSetupRequired.value
      = result.requiresMasterPasswordSetup === true
    masterPasswordPolicy.value = normalizePasswordPolicy(
      result.masterPasswordPolicy ?? {},
    )

    if (props.reauthenticate) {
      await assertReauthenticationAccount(result.email)

      if (result.requiresMasterPasswordSetup === true) {
        await clearUnexpectedSession()

        throw new Error(
          t(
            'nc_bitwarden',
            'The existing vault session could not be renewed. Lock Warden and sign in again.',
          ),
        )
      }

      pendingSsoResult.value = null

      emit('session-restored', {
        email: result.email?.trim() ?? '',
      })
      return
    }

    if (masterPasswordSetupRequired.value) {
      confirmMasterPassword.value = ''
      info.value = t(
        'nc_bitwarden',
        'This is your first SSO login. Create a master password to encrypt the vault.',
      )
      return
    }

    await loadPasskeyUnlockConfig()

    if (masterPassword.value) {
      await unlockSsoResult()
      return
    }

    info.value = passkeyUnlockConfig.value
      ? t(
          'nc_bitwarden',
          'Passkey unlock is available. Use your security key or enter the master password.',
        )
      : t(
          'nc_bitwarden',
          'SSO login was successful. Enter your master password to unlock the vault.',
        )
  } catch (exception) {
    error.value = exception.response?.data?.error
      ?? exception.message
      ?? t(
        'nc_bitwarden',
        'The SSO result could not be loaded.',
      )
  } finally {
    loading.value = false
  }
}

async function createInitialMasterPassword() {
  if (!pendingSsoResult.value) {
    return
  }

  error.value = ''
  info.value = ''

  if (!passwordPolicySatisfied.value) {
    error.value = t(
      'nc_bitwarden',
      'The master password does not meet the configured policy.',
    )
    return
  }

  loading.value = true

  try {
    const result = pendingSsoResult.value
    const completedSetup = await completeInitialSsoSetup({
      email: result.email,
      masterPassword: masterPassword.value,
      loginData: result.loginData ?? {},
      setMasterPassword: payload => (
        VaultwardenApi.setMasterPassword(payload)
      ),
    })

    pendingSsoResult.value = null
    masterPasswordSetupRequired.value = false
    masterPassword.value = ''
    confirmMasterPassword.value = ''

    emit('logged-in', {
      masterKey: completedSetup.masterKey,
      keepUnlocked: effectiveKeepUnlocked.value,
      newSsoUser: completedSetup.newSsoUser,
    })
  } catch (exception) {
    error.value = exception.response?.data?.error
      ?? exception.message
      ?? t(
        'nc_bitwarden',
        'The master password could not be created.',
      )

    console.error(
      '[nc_bitwarden] Initial master password setup failed:',
      exception,
    )
  } finally {
    loading.value = false
  }
}

async function unlockSsoResultWithPasskey() {
  if (
    !pendingSsoResult.value
    || !passkeyUnlockConfig.value
  ) {
    return
  }

  error.value = ''
  info.value = ''
  loading.value = true
  passkeyUnlockLoading.value = true

  try {
    const result = pendingSsoResult.value
    const ssoEmail = result.email?.trim() ?? ''

    if (!ssoEmail) {
      throw new Error(
        t(
          'nc_bitwarden',
          'Vaultwarden did not return an email address.',
        ),
      )
    }

    const currentConfig
      = await VaultwardenApi.getPasskeyUnlockConfig()

    if (
      currentConfig.enabled !== true
      || currentConfig.configured !== true
    ) {
      const disabledError = new Error(
        t(
          'nc_bitwarden',
          'Passkey vault unlock is disabled by the administrator.',
        ),
      )

      disabledError.code = 'feature_disabled'
      throw disabledError
    }

    passkeyUnlockConfig.value = currentConfig

    const userKey = await unlockUserKeyWithPasskey(
      currentConfig,
      {
        email: ssoEmail,
        serverType: serverType.value,
        customUrl: customUrl.value,
      },
    )

    pendingSsoResult.value = null
    masterPassword.value = ''

    emit('logged-in', {
      masterKey: userKey,
      keepUnlocked: effectiveKeepUnlocked.value,
    })
  } catch (exception) {
    const messages = {
      cancelled: t(
        'nc_bitwarden',
        'The passkey operation was cancelled or timed out.',
      ),
      account_mismatch: t(
        'nc_bitwarden',
        'The configured passkey does not belong to this vault account.',
      ),
      prf_output_unavailable: t(
        'nc_bitwarden',
        'The security key did not return a usable PRF result.',
      ),
      decrypt_failed: t(
        'nc_bitwarden',
        'The encrypted passkey key could not be decrypted.',
      ),
      invalid_config: t(
        'nc_bitwarden',
        'The saved passkey configuration is invalid.',
      ),
      feature_disabled: t(
        'nc_bitwarden',
        'Passkey vault unlock is disabled by the administrator.',
      ),
    }

    error.value = messages[exception.code]
      ?? exception.message
      ?? t(
        'nc_bitwarden',
        'Passkey unlock failed.',
      )

    console.error(
      '[nc_bitwarden] SSO passkey unlock failed:',
      exception,
    )
  } finally {
    passkeyUnlockLoading.value = false
    loading.value = false
  }
}

async function unlockSsoResult() {
  if (!pendingSsoResult.value) {
    return
  }

  error.value = ''
  info.value = ''
  loading.value = true

  try {
    const result = pendingSsoResult.value
    const loginData = toPascal(result.loginData ?? {})
    const ssoEmail = result.email?.trim() ?? ''

    if (!ssoEmail) {
      throw new Error(
        t(
          'nc_bitwarden',
          'Vaultwarden did not return an email address.',
        ),
      )
    }

    const masterKeyBuffer = await deriveMasterKey(
      masterPassword.value,
      ssoEmail,
      loginData,
    )

    const encryptedUserKey = loginData.Key

    if (!encryptedUserKey) {
      throw new Error(
        t(
          'nc_bitwarden',
          'Vaultwarden did not return a user key.',
        ),
      )
    }

    const userKey = await decryptUserSymmetricKey(
      encryptedUserKey,
      masterKeyBuffer,
    )

    pendingSsoResult.value = null
    masterPassword.value = ''

    emit('logged-in', {
      masterKey: userKey,
      loginData,
      keepUnlocked: effectiveKeepUnlocked.value,
    })
  } catch (exception) {
    error.value = exception?.code === 'unsupported_kdf'
      ? exception.message
      : t(
        'nc_bitwarden',
        'The master password is incorrect.',
      )

    console.error(
      '[nc_bitwarden] SSO vault unlock failed:',
      exception,
    )
  } finally {
    loading.value = false
  }
}

async function doClassicLogin() {
  error.value = ''
  info.value = ''
  loading.value = true

  try {
    const normalizedEmail = email.value.trim()
    const kdfParams = await VaultwardenApi.prelogin(
      normalizedEmail,
    )

    const masterKeyBuffer = await deriveMasterKey(
      masterPassword.value,
      normalizedEmail,
      kdfParams,
    )

    const passwordHash = await makeMasterPasswordHash(
      masterKeyBuffer,
      masterPassword.value,
    )

    const submittedTwoFactorToken
      = classicTwoFactorToken.value.trim()

    const loginData = toPascal(
      await VaultwardenApi.login(
        normalizedEmail,
        passwordHash,
        submittedTwoFactorToken || null,
      ),
    )

    if (loginData.TwoFactorRequired) {
      const providers = loginData.TwoFactorProviders ?? []

      if (!providers.map(Number).includes(0)) {
        throw new Error(
          t(
            'nc_bitwarden',
            'Two-factor authentication is required, but TOTP is not available.',
          ),
        )
      }

      classicTwoFactorRequired.value = true
      classicTwoFactorToken.value = ''

      error.value = submittedTwoFactorToken
        ? t(
          'nc_bitwarden',
          'The authenticator code is invalid or has expired.',
        )
        : t(
          'nc_bitwarden',
          'Enter the code from your authenticator app.',
        )

      return
    }

    const encryptedUserKey = loginData.Key

    if (!encryptedUserKey) {
      throw new Error(
        t(
          'nc_bitwarden',
          'No user key was returned. Check your email address and password.',
        ),
      )
    }

    const userKey = await decryptUserSymmetricKey(
      encryptedUserKey,
      masterKeyBuffer,
    )

    if (props.reauthenticate) {
      await assertReauthenticationAccount(normalizedEmail)

      classicTwoFactorToken.value = ''
      classicTwoFactorRequired.value = false
      masterPassword.value = ''

      emit('session-restored', {
        email: normalizedEmail,
        masterKey: userKey,
        keepUnlocked: effectiveKeepUnlocked.value,
      })
      return
    }

    classicTwoFactorToken.value = ''
    classicTwoFactorRequired.value = false
    masterPassword.value = ''

    emit('logged-in', {
      masterKey: userKey,
      loginData,
      keepUnlocked: effectiveKeepUnlocked.value,
    })
  } catch (exception) {
    const serverMessage
      = exception.response?.data?.error
      ?? exception.response?.data?.message

    error.value = serverMessage
      ?? exception.message
      ?? t('nc_bitwarden', 'Sign-in failed')

    console.error(
      '[nc_bitwarden] Classic login failed:',
      exception,
    )
  } finally {
    loading.value = false
  }
}

async function clearUnexpectedSession() {
  try {
    await VaultwardenApi.logout()
  } catch (exception) {
    console.warn(
      '[nc_bitwarden] Unexpected session could not be cleared:',
      exception,
    )
  }
}

async function assertReauthenticationAccount(actualEmail) {
  if (
    isExpectedAccount(
      props.expectedEmail,
      actualEmail,
    )
  ) {
    return
  }

  await clearUnexpectedSession()

  throw new Error(
    t(
      'nc_bitwarden',
      'A different vault account was returned. Your open vault was left unchanged. Sign in with the original account.',
    ),
  )
}

function normalizePasswordPolicy(policy) {
  const minLength = Number(
    policy.min_length
      ?? policy.minLength
      ?? 12,
  )

  return {
    min_length: Number.isInteger(minLength)
      ? Math.min(128, Math.max(12, minLength))
      : 12,
    require_lower: policy.require_lower === true
      || policy.requireLower === true,
    require_upper: policy.require_upper === true
      || policy.requireUpper === true,
    require_number: policy.require_number === true
      || policy.requireNumber === true,
    require_special: policy.require_special === true
      || policy.requireSpecial === true,
  }
}

</script>

<style scoped>
.bw-login {
  display: flex;
  height: 100%;
  padding: 2rem;
  align-items: center;
  justify-content: center;
}

.bw-login__card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  border-radius: var(--border-radius-large);
  background: var(--color-main-background);
  box-shadow: var(--box-shadow);
}

.bw-login--embedded {
  height: auto;
  padding: 0;
}

.bw-login--embedded .bw-login__card {
  max-width: none;
  padding: 0;
  box-shadow: none;
}

.bw-login__logo {
  display: block;
  width: 64px;
  margin: 0 auto 0.6rem;
}

.bw-login__card h2 {
  margin: 0 0 0.9rem;
  text-align: center;
  font-size: 1.65rem;
  line-height: 1.2;
}

.bw-login__field {
  margin-bottom: 0.8rem;
}

.bw-login__remember {
  display: flex;
  margin: 0.15rem 0 1rem;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.bw-login__remember input {
  width: 18px;
  height: 18px;
}

.bw-login__alternative {
  margin-top: 0.65rem;
}

.bw-login__policy {
  margin: -0.15rem 0 1rem;
  padding: 0;
  list-style: none;
  color: var(--color-text-maxcontrast);
  font-size: 0.86rem;
}

.bw-login__policy li::before {
  content: '○';
  display: inline-block;
  width: 1.35rem;
}

.bw-login__policy li.bw-login__policy-ok {
  color: #087a37;
  font-weight: 700;
}

.bw-login__policy li.bw-login__policy-ok::before {
  content: '✓';
}

.bw-login__hint {
  display: flex;
  margin-top: 1rem;
  align-items: flex-start;
  justify-content: center;
  gap: 0.35rem;
  color: var(--color-text-maxcontrast);
  text-align: center;
  font-size: 0.8rem;
}

.bw-login__hint svg {
  flex: 0 0 auto;
  margin-top: 0.1rem;
}
.bw-login__passkey-action {
  margin-bottom: 0.65rem;
}

.bw-login__unlock-separator {
  margin: 0.2rem 0 0.8rem;
  color: var(--color-text-maxcontrast);
  text-align: center;
  font-size: 0.85rem;
}

/* START master password loss warning */
.bw-login__card {
  max-width: 500px;
}

.bw-login__password-loss-warning {
  width: 100%;
  box-sizing: border-box;
  text-align: left;
}

.bw-login__password-loss-warning-content {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  line-height: 1.4;
}

.bw-login__password-loss-warning-content strong {
  font-weight: 700;
}

.bw-login__password-loss-warning-content span {
  font-size: 0.9rem;
}

.bw-login__password-loss-acknowledgement {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-top: 0.7rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.35;
}

.bw-login__password-loss-acknowledgement input {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  margin: 0.05rem 0 0;
  cursor: pointer;
}

.bw-login__password-loss-acknowledgement input:disabled {
  cursor: default;
}

.bw-login__primary-action {
  min-height: 38px;
}

.bw-login__primary-action :deep(.button-vue__text) {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}
/* END master password loss warning */

/* START admin tab policy */
.bw-login__admin-policy {
  display: block;
  margin: -0.35rem 0 0.35rem 1.65rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
  line-height: 1.3;
}
/* END admin tab policy */

</style>
