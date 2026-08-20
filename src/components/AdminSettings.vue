<template>
  <div class="bw-settings">
    <NcNoteCard
      v-if="error"
      type="error"
    >
      {{ error }}
    </NcNoteCard>

    <section class="bw-settings__section">
      <h3>{{ t('nc_bitwarden', 'Server and login') }}</h3>

      <p class="bw-settings__desc">
        {{ t('nc_bitwarden', 'Choose the default server and login methods for all users.') }}
      </p>

      <div class="bw-settings__options">
        <NcCheckboxRadioSwitch
          v-model="form.server_type"
          value="cloud_us"
          name="admin_server_type"
          type="radio"
          :disabled="loading || saving"
        >
          ☁️ {{ t('nc_bitwarden', 'Cloud server (US)') }} – <code>bitwarden.com</code>
        </NcCheckboxRadioSwitch>

        <NcCheckboxRadioSwitch
          v-model="form.server_type"
          value="cloud_eu"
          name="admin_server_type"
          type="radio"
          :disabled="loading || saving"
        >
          🇪🇺 {{ t('nc_bitwarden', 'Cloud server (EU)') }} – <code>bitwarden.eu</code>
        </NcCheckboxRadioSwitch>

        <NcCheckboxRadioSwitch
          v-model="form.server_type"
          value="selfhosted"
          name="admin_server_type"
          type="radio"
          :disabled="loading || saving"
        >
          🏠 {{ t('nc_bitwarden', 'Self-hosted Vaultwarden server') }}
        </NcCheckboxRadioSwitch>
      </div>

      <div
        v-if="form.server_type === 'selfhosted'"
        class="bw-settings__custom"
      >
        <NcTextField
          v-model="form.custom_url"
          :label="t('nc_bitwarden', 'Server URL')"
          placeholder="https://vault.example.com"
          :helper-text="urlError || t('nc_bitwarden', 'Base URL without /api or /identity')"
          :disabled="loading || saving"
        />
      </div>

      <div class="bw-settings__switches">
        <NcCheckboxRadioSwitch
          v-model="form.sso_enabled"
          class="bw-settings__compact-switch"
          type="switch"
          :disabled="loading || saving || form.server_type !== 'selfhosted'"
          :description="t('nc_bitwarden', 'Users sign in with SSO first; the master password is requested only afterwards.')"
        >
          {{ t('nc_bitwarden', 'Use SSO login') }}
        </NcCheckboxRadioSwitch>

        <NcNoteCard type="info">
          {{ t('nc_bitwarden', 'SSO support in Warden is implemented only for self-hosted Vaultwarden servers.') }}
        </NcNoteCard>

        <NcCheckboxRadioSwitch
          v-model="form.passkey_unlock_enabled"
          class="bw-settings__compact-switch"
          type="switch"
          :disabled="
            loading
              || saving
              || form.server_type !== 'selfhosted'
              || !form.sso_enabled
          "
          :description="
            t(
              'nc_bitwarden',
              'Users may enroll a compatible security key and unlock the vault after SSO without entering the master password.',
            )
          "
        >
          {{
            t(
              'nc_bitwarden',
              'Allow passkey-based vault unlock',
            )
          }}
        </NcCheckboxRadioSwitch>

        <NcNoteCard type="info">
          <p>
            {{
              t(
                'nc_bitwarden',
                'Passkey vault unlock requires self-hosted Vaultwarden SSO.',
              )
            }}
          </p>

          <p>
            {{
              t(
                'nc_bitwarden',
                'Existing passkey configurations remain stored while this option is disabled.',
              )
            }}
          </p>
        </NcNoteCard>

        <NcCheckboxRadioSwitch
          v-model="form.classic_login_allowed"
          class="bw-settings__compact-switch"
          type="switch"
          :disabled="loading || saving || !form.sso_enabled"
          :description="t('nc_bitwarden', 'When disabled, users can only sign in through SSO. Email, password login and the regular TOTP field are unavailable.')"
        >
          {{ t('nc_bitwarden', 'Allow classic login') }}
        </NcCheckboxRadioSwitch>

        <div class="bw-settings__override-option">
          <NcCheckboxRadioSwitch
            v-model="form.allow_user_override"
            class="bw-settings__compact-switch"
            type="switch"
            :disabled="loading || saving || !form.classic_login_allowed"
          >
            <span class="bw-settings__override-label">
              {{
                t(
                  'nc_bitwarden',
                  'Allow users to choose another server for classic login',
                )
              }}
            </span>
          </NcCheckboxRadioSwitch>

          <p
            class="bw-settings__override-description"
            :class="{
              'bw-settings__override-description--disabled':
                !form.classic_login_allowed,
            }"
          >
            <span>
              {{
                t(
                  'nc_bitwarden',
                  'This setting applies only to classic login.',
                )
              }}
            </span>

            <span>
              {{
                t(
                  'nc_bitwarden',
                  'SSO always uses the server configured by the administrator.',
                )
              }}
            </span>
          </p>
        </div>

        <div class="bw-settings__tab-policy">
          <label for="bw-tab-unlock-mode">
            {{
              t(
                'nc_bitwarden',
                'Browser tab unlock behavior',
              )
            }}
          </label>

          <select
            id="bw-tab-unlock-mode"
            v-model="form.tab_unlock_mode"
            :disabled="loading || saving"
          >
            <option value="forced_enabled">
              {{
                t(
                  'nc_bitwarden',
                  'Always enabled',
                )
              }}
            </option>

            <option value="forced_disabled">
              {{
                t(
                  'nc_bitwarden',
                  'Always disabled',
                )
              }}
            </option>

            <option value="user_choice">
              {{
                t(
                  'nc_bitwarden',
                  'Users may choose',
                )
              }}
            </option>
          </select>

          <p class="bw-settings__desc">
            {{
              t(
                'nc_bitwarden',
                'Choose whether the browser tab stays unlocked and whether users may change the option.',
              )
            }}
          </p>

          <NcCheckboxRadioSwitch
            v-if="form.tab_unlock_mode === 'user_choice'"
            v-model="form.tab_unlock_default"
            type="switch"
            :disabled="loading || saving"
          >
            {{
              t(
                'nc_bitwarden',
                'Keep unlocked by default when users may choose',
              )
            }}
          </NcCheckboxRadioSwitch>
        </div>
      </div>

      <div class="bw-settings__attachment-limit">
        <h4>
          {{ t('nc_bitwarden', 'Attachments') }}
        </h4>

        <p class="bw-settings__desc">
          {{
            t(
              'nc_bitwarden',
              'Configure the maximum permitted size per attachment.',
            )
          }}
        </p>

        <NcTextField
          v-model.number="attachmentMaxMb"
          class="bw-settings__attachment-limit-input"
          type="number"
          min="1"
          :max="MAX_ATTACHMENT_MAX_MB"
          step="1"
          :label="
            t(
              'nc_bitwarden',
              'Maximum size per attachment (MiB)',
            )
          "
          :helper-text="
            attachmentLimitError
              || t(
                'nc_bitwarden',
                'Permitted values: 1 to 50 MiB. The default is 25 MiB.',
              )
          "
          :disabled="
            loading
              || saving
              || attachmentLimitLoading
          "
        />
      </div>

      <NcNoteCard
        v-if="savedSection === 'server'"
        type="success"
      >
        {{ t('nc_bitwarden', 'Administrator settings saved') }}
      </NcNoteCard>

      <NcButton
        variant="primary"
        :disabled="loading || saving || !!urlError || attachmentLimitLoading || !!attachmentLimitError"
        @click="save('server')"
      >
        {{ buttonText('server') }}
      </NcButton>
    </section>

    <section class="bw-settings__section">
      <h3>{{ t('nc_bitwarden', 'Master password policy for new SSO users') }}</h3>

      <p class="bw-settings__desc">
        {{ t('nc_bitwarden', 'These rules apply only when a new SSO user creates a master password. Existing master passwords are not changed.') }}
      </p>

      <NcTextField
        v-model="form.sso_password_min_length"
        class="bw-settings__policy-length"
        type="number"
        min="12"
        max="128"
        step="1"
        :label="t('nc_bitwarden', 'Minimum length')"
        :helper-text="policyError"
        :disabled="loading || saving"
      />

      <div class="bw-settings__policy-options">
        <NcCheckboxRadioSwitch
          v-model="form.sso_password_require_lower"
          class="bw-settings__compact-switch"
          type="switch"
          :disabled="loading || saving"
        >
          {{ t('nc_bitwarden', 'Require lowercase letter') }}
        </NcCheckboxRadioSwitch>

        <NcCheckboxRadioSwitch
          v-model="form.sso_password_require_upper"
          class="bw-settings__compact-switch"
          type="switch"
          :disabled="loading || saving"
        >
          {{ t('nc_bitwarden', 'Require uppercase letter') }}
        </NcCheckboxRadioSwitch>

        <NcCheckboxRadioSwitch
          v-model="form.sso_password_require_number"
          class="bw-settings__compact-switch"
          type="switch"
          :disabled="loading || saving"
        >
          {{ t('nc_bitwarden', 'Require number') }}
        </NcCheckboxRadioSwitch>

        <NcCheckboxRadioSwitch
          v-model="form.sso_password_require_special"
          class="bw-settings__compact-switch"
          type="switch"
          :disabled="loading || saving"
        >
          {{ t('nc_bitwarden', 'Require special character') }}
        </NcCheckboxRadioSwitch>
      </div>

      <NcNoteCard
        v-if="savedSection === 'policy'"
        type="success"
      >
        {{ t('nc_bitwarden', 'Administrator settings saved') }}
      </NcNoteCard>

      <NcButton
        variant="primary"
        :disabled="loading || saving || !!policyError"
        @click="save('policy')"
      >
        {{ buttonText('policy') }}
      </NcButton>
    </section>

    <section class="bw-settings__section">
      <h3>{{ t('nc_bitwarden', 'Notice for users without an organization') }}</h3>

      <p class="bw-settings__desc">
        {{ t('nc_bitwarden', 'This notice is shown only after a new user completes the initial SSO setup and only while the vault has no organization membership.') }}
      </p>

      <NcCheckboxRadioSwitch
        v-model="form.organization_notice_enabled"
        class="bw-settings__compact-switch"
        type="switch"
        :disabled="loading || saving"
      >
        {{ t('nc_bitwarden', 'Show notice while no organization is assigned') }}
      </NcCheckboxRadioSwitch>

      <div class="bw-settings__notice-fields">
        <NcTextField
          v-model="form.organization_notice_title"
          :label="t('nc_bitwarden', 'Notice title')"
          maxlength="160"
          :placeholder="t('nc_bitwarden', 'Not assigned to an organization yet')"
          :disabled="loading || saving"
        />

        <label class="bw-settings__textarea-label">
          <span>{{ t('nc_bitwarden', 'Notice text') }}</span>
          <textarea
            v-model="form.organization_notice_message"
            rows="4"
            maxlength="2000"
            :placeholder="t('nc_bitwarden', 'Your personal vault is ready. Contact support so your account can be assigned to the correct organization.')"
            :disabled="loading || saving"
          />
        </label>

        <NcTextField
          v-model="form.organization_notice_support_url"
          type="url"
          :label="t('nc_bitwarden', 'Support URL')"
          placeholder="https://support.example.com"
          :helper-text="supportUrlError"
          :disabled="loading || saving"
        />

        <NcTextField
          v-model="form.organization_notice_support_label"
          :label="t('nc_bitwarden', 'Support link label')"
          maxlength="120"
          :placeholder="t('nc_bitwarden', 'Contact support')"
          :disabled="loading || saving"
        />

        <NcTextField
          v-model="form.organization_notice_support_email"
          type="email"
          :label="t('nc_bitwarden', 'Support email address')"
          placeholder="support@example.com"
          :helper-text="supportEmailError"
          :disabled="loading || saving"
        />
      </div>

      <NcNoteCard
        v-if="savedSection === 'notice'"
        type="success"
      >
        {{ t('nc_bitwarden', 'Administrator settings saved') }}
      </NcNoteCard>

      <NcButton
        variant="primary"
        :disabled="loading || saving || !!supportUrlError || !!supportEmailError"
        @click="save('notice')"
      >
        {{ buttonText('notice') }}
      </NcButton>
    </section>
  </div>
</template>

<script setup>
import {
  computed,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import { VaultwardenApi } from '../services/api.js'

import {
  DEFAULT_ATTACHMENT_MAX_MB,
  MAX_ATTACHMENT_MAX_MB,
  loadAttachmentLimit,
  saveAttachmentLimit,
} from '../services/attachmentLimit.js'
function defaultSettings() {
  return {
    server_type: 'cloud_us',
    custom_url: '',
    allow_user_override: true,
    sso_enabled: false,
    classic_login_allowed: true,
    passkey_unlock_enabled: false,
    tab_unlock_mode: 'user_choice',
    tab_unlock_default: true,
    sso_password_min_length: 12,
    sso_password_require_lower: false,
    sso_password_require_upper: false,
    sso_password_require_number: false,
    sso_password_require_special: false,
    organization_notice_enabled: false,
    organization_notice_title: '',
    organization_notice_message: '',
    organization_notice_support_url: '',
    organization_notice_support_label: '',
    organization_notice_support_email: '',
  }
}

const form = reactive(defaultSettings())
const persisted = reactive(defaultSettings())

const loading = ref(true)
const savingSection = ref('')
const savedSection = ref('')
const error = ref('')
const saving = computed(() => savingSection.value !== '')

const attachmentMaxMb = ref(
  DEFAULT_ATTACHMENT_MAX_MB,
)

const attachmentLimitLoading = ref(true)

const attachmentLimitError = computed(() => {
  const value = Number(attachmentMaxMb.value)

  if (
    !Number.isInteger(value)
    || value < 1
    || value > MAX_ATTACHMENT_MAX_MB
  ) {
    return t(
      'nc_bitwarden',
      'The attachment size must be a whole number between 1 and 50 MiB.',
    )
  }

  return ''
})

const urlError = computed(() => {
  if (form.server_type !== 'selfhosted' || !form.custom_url) {
    return ''
  }

  try {
    const parsedUrl = new URL(form.custom_url)
    return parsedUrl.protocol === 'https:'
      ? ''
      : t('nc_bitwarden', 'Only HTTPS URLs are allowed')
  } catch {
    return t('nc_bitwarden', 'Invalid URL')
  }
})

const policyError = computed(() => {
  const minLength = Number(form.sso_password_min_length)
  if (!Number.isInteger(minLength) || minLength < 12 || minLength > 128) {
    return t('nc_bitwarden', 'The minimum length must be between 12 and 128 characters.')
  }
  return ''
})

const supportUrlError = computed(() => {
  const value = form.organization_notice_support_url.trim()
  if (!value) return ''

  try {
    const parsedUrl = new URL(value)
    return ['http:', 'https:'].includes(parsedUrl.protocol)
      ? ''
      : t('nc_bitwarden', 'Only HTTP or HTTPS support URLs are allowed')
  } catch {
    return t('nc_bitwarden', 'Enter a valid support URL')
  }
})

const supportEmailError = computed(() => {
  const value = form.organization_notice_support_email.trim()
  if (!value) return ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? ''
    : t('nc_bitwarden', 'Enter a valid support email address')
})

watch(() => form.sso_enabled, (enabled) => {
  if (!enabled) {
    form.classic_login_allowed = true
    form.passkey_unlock_enabled = false
  }
})

watch(() => form.server_type, (serverType) => {
  if (serverType !== 'selfhosted') {
    form.passkey_unlock_enabled = false
  }
})

watch(() => form.classic_login_allowed, (enabled) => {
  if (!enabled) {
    form.allow_user_override = false
  }
})

onMounted(async () => {
  try {
    const settings = await VaultwardenApi.getAdminSettings()
    const normalized = {
      ...defaultSettings(),
      ...settings,
      classic_login_allowed: settings.classic_login_allowed !== false,
      passkey_unlock_enabled:
        settings.passkey_unlock_enabled === true,
      tab_unlock_mode: [
        'forced_enabled',
        'forced_disabled',
        'user_choice',
      ].includes(settings.tab_unlock_mode)
        ? settings.tab_unlock_mode
        : 'user_choice',
      tab_unlock_default: settings.tab_unlock_default !== false,
      sso_password_min_length: Number(settings.sso_password_min_length ?? 12),
      organization_notice_enabled: settings.organization_notice_enabled === true,
    }
    Object.assign(form, normalized)
    Object.assign(persisted, normalized)
  } catch {
    error.value = t('nc_bitwarden', 'Administrator settings could not be loaded')
  } finally {
    loading.value = false
  }
})

function buttonText(section) {
  return savingSection.value === section
    ? t('nc_bitwarden', 'Saving…')
    : t('nc_bitwarden', 'Save')
}

function payloadForSection(section) {
  const payload = { ...persisted }

  if (section === 'server') {
    Object.assign(payload, {
      server_type: form.server_type,
      custom_url: form.custom_url.trim(),
      allow_user_override: form.allow_user_override,
      sso_enabled: form.sso_enabled,
      classic_login_allowed: form.classic_login_allowed,
      passkey_unlock_enabled: form.passkey_unlock_enabled,
      tab_unlock_mode: form.tab_unlock_mode,
      tab_unlock_default: form.tab_unlock_default,
    })

    if (payload.server_type !== 'selfhosted') {
      payload.sso_enabled = false
      payload.passkey_unlock_enabled = false
    }
    if (!payload.sso_enabled) {
      payload.classic_login_allowed = true
      payload.passkey_unlock_enabled = false
    }
    if (!payload.classic_login_allowed) {
      payload.allow_user_override = false
    }
  }

  if (section === 'policy') {
    Object.assign(payload, {
      sso_password_min_length: Number(form.sso_password_min_length),
      sso_password_require_lower: form.sso_password_require_lower,
      sso_password_require_upper: form.sso_password_require_upper,
      sso_password_require_number: form.sso_password_require_number,
      sso_password_require_special: form.sso_password_require_special,
    })
  }

  if (section === 'notice') {
    Object.assign(payload, {
      organization_notice_enabled: form.organization_notice_enabled,
      organization_notice_title: form.organization_notice_title.trim(),
      organization_notice_message: form.organization_notice_message.trim(),
      organization_notice_support_url: form.organization_notice_support_url.trim(),
      organization_notice_support_label: form.organization_notice_support_label.trim(),
      organization_notice_support_email: form.organization_notice_support_email.trim(),
    })
  }

  return payload
}

async function save(section) {

  if (
    section === 'server'
    && attachmentLimitError.value
  ) {
    return
  }

  if (section === 'server' && urlError.value) return
  if (section === 'policy' && policyError.value) return
  if (
    section === 'notice'
    && (supportUrlError.value || supportEmailError.value)
  ) return

  const payload = payloadForSection(section)
  savingSection.value = section
  savedSection.value = ''
  error.value = ''

  try {
    await VaultwardenApi.saveAdminSettings(payload)

    if (section === 'server') {
      const attachmentSettings =
        await saveAttachmentLimit(
          attachmentMaxMb.value,
        )

      attachmentMaxMb.value =
        attachmentSettings.maxMb
    }

    Object.assign(persisted, payload)

    if (section === 'server') {
      Object.assign(form, {
        server_type: payload.server_type,
        custom_url: payload.custom_url,
        allow_user_override: payload.allow_user_override,
        sso_enabled: payload.sso_enabled,
        classic_login_allowed: payload.classic_login_allowed,
        passkey_unlock_enabled:
          payload.passkey_unlock_enabled,
        tab_unlock_mode: payload.tab_unlock_mode,
        tab_unlock_default: payload.tab_unlock_default,
      })
    }

    savedSection.value = section
    setTimeout(() => {
      if (savedSection.value === section) {
        savedSection.value = ''
      }
    }, 3000)
  } catch (exception) {
    error.value = exception.response?.data?.error
      ?? t('nc_bitwarden', 'Failed to save administrator settings')
  } finally {
    savingSection.value = ''
  }
}

async function loadAttachmentAdminSetting() {
  attachmentLimitLoading.value = true

  try {
    const settings =
      await loadAttachmentLimit(true)

    attachmentMaxMb.value = settings.maxMb
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Attachment limit '
        + 'could not be loaded:',
      exception,
    )

    error.value =
      exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || t(
        'nc_bitwarden',
        'The attachment size limit could not be loaded.',
      )
  } finally {
    attachmentLimitLoading.value = false
  }
}

onMounted(loadAttachmentAdminSetting)

</script>

<style scoped>
.bw-settings {
  max-width: 860px;
  padding: 1rem 2rem 3rem;
}

.bw-settings__section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  background: var(--color-main-background);
}

.bw-settings__section h3 {
  margin-top: 0;
}

.bw-settings__desc {
  margin-bottom: 1rem;
  color: var(--color-text-maxcontrast);
}

.bw-settings__options,
.bw-settings__switches,
.bw-settings__policy-options,
.bw-settings__notice-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 1rem 0;
}

.bw-settings__custom,
.bw-settings__policy-length {
  max-width: 620px;
  margin-bottom: 1rem;
}

.bw-settings__compact-switch {
  display: inline-flex;
  width: fit-content;
  max-width: none;
}

.bw-settings__notice-fields {
  width: 100%;
}

.bw-settings__notice-fields > * {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
}

.bw-settings__notice-fields :deep(.input-field),
.bw-settings__notice-fields :deep(.input-field__main-wrapper) {
  width: 100%;
  max-width: none;
}

.bw-settings__textarea-label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  max-width: none;
  font-weight: 600;
}

.bw-settings__textarea-label textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 140px;
  padding: 0.75rem;
  border: 2px solid var(--color-border-maxcontrast);
  border-radius: var(--border-radius-large);
  background: var(--color-main-background);
  color: var(--color-main-text);
  font: inherit;
  resize: vertical;
}

.bw-settings__textarea-label textarea:focus {
  border-color: var(--color-primary-element);
  outline: none;
}
.bw-settings__override-option {
  width: 100%;
  max-width: 560px;
}

.bw-settings__override-option .bw-settings__compact-switch {
  display: flex;
  width: 100%;
  max-width: 100%;
}

.bw-settings__override-label {
  display: block;
  width: 500px;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.bw-settings__override-description {
  width: 500px;
  max-width: calc(100% - 3.2rem);
  margin: 0.25rem 0 0 3.2rem;
  color: var(--color-text-maxcontrast);
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 1.5;
}

.bw-settings__override-description--disabled {
  opacity: 0.55;
}

.bw-settings__override-description > span {
  display: block;
}

/* START tab unlock policy */
.bw-settings__tab-policy {
  display: flex;
  max-width: 560px;
  flex-direction: column;
  gap: 0.45rem;
  padding-top: 0.4rem;
}

.bw-settings__tab-policy > label {
  font-weight: 600;
}

.bw-settings__tab-policy > select {
  width: 100%;
  min-height: 38px;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}
/* END tab unlock policy */

.bw-settings__attachment-limit {
  margin: 1.25rem 0;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.bw-settings__attachment-limit h4 {
  margin: 0 0 0.35rem;
}

.bw-settings__attachment-limit
.bw-settings__desc {
  margin-top: 0;
}

.bw-settings__attachment-limit-input {
  width: 100%;
  max-width: 520px;
}

</style>
