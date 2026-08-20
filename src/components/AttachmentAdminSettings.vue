<template>
  <NcSettingsSection
    :name="t(
      'nc_bitwarden',
      'Attachments',
    )"
    :description="t(
      'nc_bitwarden',
      'Configure the maximum permitted size per attachment.',
    )"
  >
    <div class="warden-attachment-admin">
      <NcTextField
        v-model="maxMb"
        type="number"
        :min="1"
        :max="MAX_ATTACHMENT_MAX_MB"
        :label="t(
          'nc_bitwarden',
          'Maximum size per attachment (MiB)',
        )"
        :disabled="loading || saving"
      />

      <p class="warden-attachment-admin__hint">
        {
        t(
        'nc_bitwarden',
        'Permitted values: 1 to 50 MiB. The default is 25 MiB.',
        )
        }
      </p>

      <NcButton
        variant="primary"
        :disabled="loading || saving"
        @click="save"
      >
        {
        saving
        ? t('nc_bitwarden', 'Saving…')
        : t('nc_bitwarden', 'Save')
        }
      </NcButton>

      <p
        v-if="message"
        class="warden-attachment-admin__message"
        :class="{
          'warden-attachment-admin__message--error':
            hasError,
        }"
      >
        { message }
      </p>
    </div>
  </NcSettingsSection>
</template>

<script setup>

import { onMounted, ref } from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcSettingsSection from '@nextcloud/vue/components/NcSettingsSection'
import NcTextField from '@nextcloud/vue/components/NcTextField'

import {
  DEFAULT_ATTACHMENT_MAX_MB,
  MAX_ATTACHMENT_MAX_MB,
  loadAttachmentLimit,
  saveAttachmentLimit,
} from '../services/attachmentLimit.js'

const maxMb = ref(
  DEFAULT_ATTACHMENT_MAX_MB,
)

const loading = ref(true)
const saving = ref(false)
const message = ref('')
const hasError = ref(false)

function exceptionMessage(exception) {
  return (
    exception?.response?.data?.error
    || exception?.response?.data?.message
    || exception?.message
    || t(
      'nc_bitwarden',
      'The setting could not be saved.',
    )
  )
}

async function load() {
  loading.value = true
  message.value = ''
  hasError.value = false

  try {
    const settings =
      await loadAttachmentLimit(true)

    maxMb.value = settings.maxMb
  } catch (exception) {
    hasError.value = true
    message.value = exceptionMessage(exception)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  message.value = ''
  hasError.value = false

  try {
    const settings =
      await saveAttachmentLimit(maxMb.value)

    maxMb.value = settings.maxMb

    message.value = t(
      'nc_bitwarden',
      'The attachment size limit was saved.',
    )
  } catch (exception) {
    hasError.value = true
    message.value = exceptionMessage(exception)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.warden-attachment-admin {
  display: flex;
  max-width: 520px;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.warden-attachment-admin :deep(.input-field) {
  width: 100%;
}

.warden-attachment-admin__hint {
  margin: 0;
  color: var(--color-text-maxcontrast);
}

.warden-attachment-admin__message {
  margin: 0;
  color: var(--color-success);
}

.warden-attachment-admin__message--error {
  color: var(--color-error);
}
</style>
