<template>
  <div
    class="bw-detail"
    :class="{
      'bw-detail--trash': trashMode,
    }"
  >
    <header class="bw-detail__header">
      <div class="bw-detail__title">
        <span
          v-if="advancedMode"
          class="bw-detail__eyebrow"
        >
          {{ t('nc_bitwarden', 'Item') }}
        </span>

        <h2>
          {{ itemName }}
        </h2>

        <div
          v-if="metadataParts.length"
          class="bw-detail__meta"
        >
          <template
            v-for="(part, index) in metadataParts"
            :key="`${part}-${index}`"
          >
            <span
              v-if="index > 0"
              class="bw-detail__meta-separator"
              aria-hidden="true"
            >·</span>

            <span>{{ part }}</span>
          </template>
        </div>
      </div>

      <div class="bw-detail__actions">
        <template v-if="trashMode">
          <NcButton
            v-if="canRestoreItem"
            :title="
              t(
                'nc_bitwarden',
                'Restore item',
              )
            "
            :aria-label="
              t(
                'nc_bitwarden',
                'Restore item',
              )
            "
            @click="$emit('restore', item)"
          >
            <RestoreIcon :size="18" />
          </NcButton>

          <NcButton
            v-if="advancedMode && canDeleteItem"
            variant="error"
            :title="
              t(
                'nc_bitwarden',
                'Delete item permanently',
              )
            "
            :aria-label="
              t(
                'nc_bitwarden',
                'Delete item permanently',
              )
            "
            @click="
              $emit(
                'delete-permanent',
                item,
              )
            "
          >
            <DeleteOutlineIcon :size="18" />
          </NcButton>
        </template>

        <template v-else>
          <NcButton
            v-if="canQuickCopyTotp"
            :title="quickCopyTitle('totp')"
            :aria-label="quickCopyTitle('totp')"
            @click="copyLoginValue('totp', $event)"
          >
            <CheckIcon
              v-if="quickCopyAction === 'totp'"
              class="bw-detail__quick-copy-check"
              :size="18"
            />
            <ClockOutlineIcon v-else :size="18" />
          </NcButton>

          <NcButton
            v-if="canQuickCopyPassword"
            :title="quickCopyTitle('password')"
            :aria-label="quickCopyTitle('password')"
            @click="copyLoginValue('password', $event)"
          >
            <CheckIcon
              v-if="quickCopyAction === 'password'"
              class="bw-detail__quick-copy-check"
              :size="18"
            />
            <ContentCopyIcon v-else :size="18" />
          </NcButton>

          <NcButton
            v-if="canEditItem"
            :title="
              t(
                'nc_bitwarden',
                'Edit item',
              )
            "
            :aria-label="
              t(
                'nc_bitwarden',
                'Edit item',
              )
            "
            @click="$emit('edit', item)"
          >
            <PencilOutlineIcon :size="18" />
          </NcButton>

          <NcButton
            v-if="advancedMode && canDeleteItem"
            variant="error"
            :title="
              t(
                'nc_bitwarden',
                'Move item to trash',
              )
            "
            :aria-label="
              t(
                'nc_bitwarden',
                'Move item to trash',
              )
            "
            @click="confirmDelete"
          >
            <DeleteOutlineIcon :size="18" />
          </NcButton>
        </template>

        <span
          class="bw-detail__quick-copy-status"
          aria-live="polite"
        >{{ quickCopyMessage }}</span>
      </div>
    </header>

    <div
      v-if="trashMode"
      class="bw-detail__trash-notice"
    >
      <strong>
        {{
          t(
            'nc_bitwarden',
            'This item is in the trash.',
          )
        }}
      </strong>

      <span v-if="item.deletedDate">
        {{
          t(
            'nc_bitwarden',
            'Deleted on {date}',
            {
              date:
                formatPasskeyDate(
                  item.deletedDate,
                ),
            },
          )
        }}
      </span>
    </div>

    <div
      v-if="!advancedMode && hasHiddenAdvancedData"
      class="bw-detail__advanced-notice"
    >
      <div>
        <strong>
          {{ t(
            'nc_bitwarden',
            'This item contains advanced data that is hidden in standard view.',
          ) }}
        </strong>

        <span>
          {{ t(
            'nc_bitwarden',
            'Switch to advanced view to display or edit all data.',
          ) }}
        </span>
      </div>

      <NcButton
        class="bw-detail__advanced-notice-action"
        variant="secondary"
        :title="
          t(
            'nc_bitwarden',
            'Open advanced view',
          )
        "
        :aria-label="
          t(
            'nc_bitwarden',
            'Open advanced view',
          )
        "
        @click="$emit('request-advanced-mode')"
      >
        {{
          t(
            'nc_bitwarden',
            'Show all',
          )
        }}
      </NcButton>
    </div>

    <nav
      v-if="advancedMode"
      class="bw-detail__tabs"
      aria-label="Eintragsbereiche"
    >
      <button
        type="button"
        :class="{
          'bw-detail__tab--active':
            activeDetailTab === 'details',
        }"
        @click="activeDetailTab = 'details'"
      >
        Details
      </button>

      <button
        v-if="Number(item.type) === 1"
        type="button"
        :class="{
          'bw-detail__tab--active':
            activeDetailTab === 'security',
        }"
        @click="activeDetailTab = 'security'"
      >
        Sicherheit
      </button>

      <button
        v-if="!trashMode"
        type="button"
        :class="{
          'bw-detail__tab--active':
            activeDetailTab === 'attachments',
        }"
        @click="activeDetailTab = 'attachments'"
      >
        Anhänge ({{ item.attachments?.length ?? 0 }})
      </button>
    </nav>

    <div
      class="bw-detail__content"
      :class="`bw-detail__content--${activeDetailTab}`"
    >
      <p
        v-if="
          activeDetailTab === 'security'
            && Number(item.type) === 1
            && (
              !canViewPasswordItem
              || (
                !item.login?.password
                && !item.login?.totp
              )
            )
            && !item.login?.fido2Credentials?.length
            && !passwordHistoryEntries.length
        "
        class="
          bw-detail__tab-security
          bw-detail__empty-tab
        "
      >
        Für diesen Eintrag sind keine Sicherheitsdaten vorhanden.
      </p>
      <template v-if="item.type === 1 && item.login">
        <section class="bw-detail__group">
          <div class="bw-detail__group-title">
            {{ t('nc_bitwarden', 'Login credentials') }}
          </div>

          <div class="bw-detail__grid bw-detail__grid--login">
            <FieldRow
              :label="t('nc_bitwarden', 'Username')"
              :value="item.login.username"
              copyable
            />

            <FieldRow
              :label="t('nc_bitwarden', 'Password')"
              :value="item.login.password"
              :copyable="canViewPasswordItem"
              :reveal-blocked="!canViewPasswordItem"
              secret
            />

            <FieldRow
              v-for="(uri, index) in visibleItemUris"
              :key="`${uri.uri}-${index}`"
              :label="
                advancedMode
                  && visibleItemUris.length > 1
                  ? t(
                    'nc_bitwarden',
                    'URL {number}',
                    { number: index + 1 },
                  )
                  : t('nc_bitwarden', 'URL')
              "
              :value="uri.uri"
              :href="uri.uri"
              copyable
              collapsible
              wide
            />
          </div>
        </section>

        <section
          v-if="item.login.fido2Credentials?.length"
          class="
            bw-detail__group
            bw-detail__tab-security
          "
        >
          <div class="bw-detail__group-title">
            {{ t('nc_bitwarden', 'Passkeys') }}
          </div>

          <div class="bw-detail__passkeys">
            <article
              v-for="(
                credential,
                index
              ) in item.login.fido2Credentials"
              :key="
                credential.credentialId
                  || `passkey-${index}`
              "
              class="bw-detail__passkey"
            >
              <strong>
                {{
                  credential.rpName
                    || credential.rpId
                    || t('nc_bitwarden', 'Passkey')
                }}
              </strong>

              <span v-if="credential.rpId">
                {{
                  t(
                    'nc_bitwarden',
                    'Website: {website}',
                    {
                      website: credential.rpId,
                    },
                  )
                }}
              </span>

              <span
                v-if="
                  credential.userDisplayName
                    || credential.userName
                "
              >
                {{
                  t(
                    'nc_bitwarden',
                    'User: {user}',
                    {
                      user:
                        credential.userDisplayName
                        || credential.userName,
                    },
                  )
                }}
              </span>

              <span v-if="credential.creationDate">
                {{
                  t(
                    'nc_bitwarden',
                    'Created: {date}',
                    {
                      date: formatPasskeyDate(
                        credential.creationDate,
                      ),
                    },
                  )
                }}
              </span>
            </article>
          </div>
        </section>

        <TotpDisplay
          v-if="
            canViewPasswordItem
              && item.login.totp
          "
          :secret="item.login.totp"
        />

        <section
          v-if="
            canViewPasswordItem
              && item.login.password
          "
          class="
            bw-detail__group
            bw-detail__security
            bw-detail__tab-security
          "
        >
          <div class="bw-detail__group-title">
            {{ t('nc_bitwarden', 'Password status') }}
          </div>

          <div class="bw-detail__security-grid">
            <div class="bw-detail__security-value">
              <span>{{ t('nc_bitwarden', 'Strength') }}</span>
              <strong :class="`bw-detail__strength--${passwordStrength.id}`">
                {{ passwordStrength.label }}
              </strong>
            </div>

            <div class="bw-detail__security-value">
              <span>{{ t('nc_bitwarden', 'Password age') }}</span>
              <strong class="bw-detail__password-age">
                {{ passwordAgeLabel }}
              </strong>
            </div>
          </div>

          <div
            v-if="passwordWarnings.length"
            class="bw-detail__warning-stack"
          >
            <ul class="bw-detail__warnings">
              <li
                v-for="warning in passwordWarnings"
                :key="warning"
              >
                {{ warning }}
              </li>
            </ul>

            <div
              v-if="reusedPasswordItems.length > 1"
              class="bw-detail__reused-passwords"
            >
              <button
                type="button"
                class="bw-detail__reused-toggle"
                :aria-expanded="
                  reusedPasswordExpanded
                    ? 'true'
                    : 'false'
                "
                @click="
                  reusedPasswordExpanded =
                    !reusedPasswordExpanded
                "
              >
                {{
                  reusedPasswordExpanded
                    ? t(
                      'nc_bitwarden',
                      'Hide affected items',
                    )
                    : t(
                      'nc_bitwarden',
                      'Show affected items',
                    )
                }}
              </button>

              <div
                v-if="reusedPasswordExpanded"
                class="bw-detail__reused-list"
              >
                <p class="bw-detail__reused-heading">
                  {{
                    t(
                      'nc_bitwarden',
                      'This password is also stored in the following items:',
                    )
                  }}
                </p>

                <button
                  v-for="candidate in reusedPasswordItems"
                  :key="candidate.id"
                  type="button"
                  class="bw-detail__reused-item"
                  :class="{
                    'bw-detail__reused-item--current':
                      isCurrentReusedItem(candidate),
                  }"
                  :disabled="
                    isCurrentReusedItem(candidate)
                  "
                  @click="
                    openReusedPasswordItem(candidate)
                  "
                >
                  <span class="bw-detail__reused-item-main">
                    <strong>
                      {{
                        candidate.name
                          || t(
                            'nc_bitwarden',
                            '(no name)',
                          )
                      }}
                    </strong>

                    <span
                      v-if="candidate.login?.username"
                      class="
                        bw-detail__reused-username
                      "
                    >
                      {{ candidate.login.username }}
                    </span>

                    <span
                      v-else
                      class="
                        bw-detail__reused-username
                        bw-detail__reused-username--empty
                      "
                    >
                      {{
                        t(
                          'nc_bitwarden',
                          'No username',
                        )
                      }}
                    </span>
                  </span>

                  <span class="bw-detail__reused-context">
                    {{
                      relatedItemOwnerLabel(candidate)
                    }}

                    <span
                      v-if="
                        isCurrentReusedItem(candidate)
                      "
                      class="
                        bw-detail__reused-current
                      "
                    >
                      ·
                      {{
                        t(
                          'nc_bitwarden',
                          'Current item',
                        )
                      }}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <p
            v-else
            class="bw-detail__security-ok"
          >
            {{
              t(
                'nc_bitwarden',
                'No obvious password risks were detected.',
              )
            }}
          </p>
        </section>
        <section
          v-if="
            canViewPasswordItem
              && passwordHistoryEntries.length
          "
          class="
            bw-detail__group
            bw-detail__password-history
            bw-detail__tab-security
          "
        >
          <div
            class="
              bw-detail__group-title
              bw-detail__password-history-title
            "
          >
            <span>
              {{
                t(
                  'nc_bitwarden',
                  'Password history ({count})',
                  {
                    count:
                      passwordHistoryEntries.length,
                  },
                )
              }}
            </span>

            <button
              type="button"
              class="
                bw-detail__password-history-toggle
              "
              :aria-expanded="
                passwordHistoryExpanded
                  ? 'true'
                  : 'false'
              "
              @click="
                passwordHistoryExpanded =
                  !passwordHistoryExpanded
              "
            >
              {{
                passwordHistoryExpanded
                  ? t(
                    'nc_bitwarden',
                    'Hide password history',
                  )
                  : t(
                    'nc_bitwarden',
                    'Show password history',
                  )
              }}
            </button>
          </div>

          <p class="bw-detail__password-history-hint">
            {{
              t(
                'nc_bitwarden',
                'The five most recently replaced passwords are retained.',
              )
            }}
          </p>

          <div
            v-if="passwordHistoryExpanded"
            class="bw-detail__password-history-list"
          >
            <FieldRow
              v-for="(
                entry,
                index
              ) in passwordHistoryEntries"
              :key="
                `${entry.lastUsedDate ?? 'history'}-${index}`
              "
              :label="
                passwordHistoryLabel(
                  entry,
                  index,
                )
              "
              :value="entry.password"
              :copyable="canViewPasswordItem"
              :reveal-blocked="!canViewPasswordItem"
              secret
              wide
            />
          </div>
        </section>
      </template>

      <section
        v-if="item.type === 3 && item.card"
        class="bw-detail__group"
      >
        <div class="bw-detail__group-title">
          {{ t('nc_bitwarden', 'Card details') }}
        </div>

        <div class="bw-detail__grid">
          <FieldRow
            :label="t('nc_bitwarden', 'Cardholder')"
            :value="item.card.cardholderName"
            copyable
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Card number')"
            :value="item.card.number"
            copyable
            secret
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Expiration date')"
            :value="expirationDate"
            copyable
          />

          <FieldRow
            :label="t('nc_bitwarden', 'CVV')"
            :value="item.card.code"
            copyable
            secret
          />
        </div>
      </section>

      <template v-if="item.type === 4 && item.identity">
        <section class="bw-detail__group">
          <div class="bw-detail__group-title">
            {{ t('nc_bitwarden', 'Personal details') }}
          </div>

          <div class="bw-detail__grid">
            <FieldRow
              :label="t('nc_bitwarden', 'Name')"
              :value="identityName"
              copyable
            />

            <FieldRow
              :label="t('nc_bitwarden', 'Username')"
              :value="item.identity.username"
              copyable
            />

            <FieldRow
              :label="t('nc_bitwarden', 'Company')"
              :value="item.identity.company"
              copyable
            />

            <FieldRow
              :label="t('nc_bitwarden', 'Social security number')"
              :value="item.identity.ssn"
              copyable
              secret
            />

            <FieldRow
              :label="t('nc_bitwarden', 'Passport number')"
              :value="item.identity.passportNumber"
              copyable
              secret
            />

            <FieldRow
              :label="t('nc_bitwarden', 'License number')"
              :value="item.identity.licenseNumber"
              copyable
              secret
            />
          </div>
        </section>

        <section class="bw-detail__group">
          <div class="bw-detail__group-title">
            {{ t('nc_bitwarden', 'Contact and address') }}
          </div>

          <div class="bw-detail__grid">
            <FieldRow
              :label="t('nc_bitwarden', 'Email')"
              :value="item.identity.email"
              copyable
            />

            <FieldRow
              :label="t('nc_bitwarden', 'Phone')"
              :value="item.identity.phone"
              copyable
            />

            <FieldRow
              :label="t('nc_bitwarden', 'Address')"
              :value="identityAddress"
              copyable
              wide
            />
          </div>
        </section>
      </template>

      <section
        v-if="Number(item.type) === 5 && item.sshKey"
        class="bw-detail__group"
      >
        <div class="bw-detail__group-title">
          {{ t('nc_bitwarden', 'SSH key') }}
        </div>

        <div class="bw-detail__grid">
          <FieldRow
            :label="t('nc_bitwarden', 'Algorithm')"
            :value="sshAlgorithm"
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Fingerprint')"
            :value="item.sshKey.keyFingerprint"
            copyable
            wide
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Public key')"
            :value="item.sshKey.publicKey"
            copyable
            wide
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Private key')"
            :value="item.sshKey.privateKey"
            copyable
            secret
            wide
          />
        </div>
      </section>

      <section class="bw-detail__group">
        <div class="bw-detail__group-title">
          {{ notesGroupTitle }}
        </div>

        <div
          class="bw-detail__notes-card"
          :class="{
            'bw-detail__notes-card--editing':
              notesEditing,
          }"
        >
          <template v-if="notesEditing">
            <textarea
              ref="notesTextarea"
              v-model="notesDraft"
              class="bw-detail__notes-textarea"
              :disabled="notesSaving"
              :aria-label="
                t('nc_bitwarden', 'Notes')
              "
              @keydown.esc.prevent="cancelNotesEdit"
              @keydown.ctrl.enter.prevent="
                saveNotesInline
              "
            />

            <div class="bw-detail__notes-editor-actions">
              <NcButton
                :disabled="notesSaving"
                @click="cancelNotesEdit"
              >
                {{
                  t(
                    'nc_bitwarden',
                    'Cancel',
                  )
                }}
              </NcButton>

              <NcButton
                variant="primary"
                :disabled="notesSaving"
                @click="saveNotesInline"
              >
                {{
                  notesSaving
                    ? t(
                      'nc_bitwarden',
                      'Saving…',
                    )
                    : t(
                      'nc_bitwarden',
                      'Save',
                    )
                }}
              </NcButton>
            </div>

            <p
              v-if="notesError"
              class="
                bw-detail__message
                bw-detail__message--error
              "
            >
              {{ notesError }}
            </p>

            <p class="bw-detail__notes-shortcut">
              {{
                t(
                  'nc_bitwarden',
                  'Save with Ctrl+Enter',
                )
              }}
            </p>
          </template>

          <template v-else>
            <p
              v-if="item.notes"
              class="bw-detail__notes-view"
            >
              {{ item.notes }}
            </p>

            <p
              v-else
              class="
                bw-detail__notes-view
                bw-detail__notes-empty
              "
            >
              {{
                t(
                  'nc_bitwarden',
                  'No notes have been entered yet.',
                )
              }}
            </p>

            <div class="bw-detail__notes-actions">
              <button
                v-if="canEditItem"
                type="button"
                class="bw-detail__notes-edit"
                :title="
                  t(
                    'nc_bitwarden',
                    'Edit notes',
                  )
                "
                :aria-label="
                  t(
                    'nc_bitwarden',
                    'Edit notes',
                  )
                "
                @click="startNotesEdit"
              >
                <PencilOutlineIcon :size="16" />
              </button>

              <button
                v-if="item.notes"
                type="button"
                class="bw-detail__copy-notes"
                :title="
                  t(
                    'nc_bitwarden',
                    'Copy notes',
                  )
                "
                :aria-label="
                  t(
                    'nc_bitwarden',
                    'Copy notes',
                  )
                "
                @click="copyNotes"
              >
                <span
                  v-if="notesCopied"
                  class="bw-detail__copy-check"
                >
                  ✓
                </span>

                <ContentCopyIcon
                  v-else
                  :size="16"
                />
              </button>
            </div>

            <p
              v-if="notesMessage"
              class="bw-detail__message"
            >
              {{ notesMessage }}
            </p>
          </template>
        </div>
      </section>

      <section
        v-if="advancedMode && item.fields?.length"
        class="bw-detail__group"
      >
        <div class="bw-detail__group-title">
          {{ t('nc_bitwarden', 'Additional fields') }}
        </div>

        <div class="bw-detail__grid">
          <FieldRow
            v-for="(field, index) in item.fields"
            :key="`${field.name}-${index}`"
            :label="field.name || t(
              'nc_bitwarden',
              'Field {number}',
              { number: index + 1 },
            )"
            :value="customFieldValue(field)"
            :hint="customFieldHint(field)"
            :secret="customFieldIsSecret(field)"
            :reveal-blocked="
              !canRevealCustomField(field)
            "
            :copyable="
              customFieldIsCopyable(field)
            "
            compact
          />
        </div>
      </section>

      <AttachmentManager
        v-if="
          advancedMode
            && item.id
            && !trashMode
        "
        class="bw-detail__tab-attachments"
        :item="item"
        :user-key="userKey"
        :organization-keys="organizationKeys"
        :read-only="!canEditItem"
        @changed="emit('changed', $event.cipherId)"
      />
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
  nextTick,
} from 'vue'
import { t } from '@nextcloud/l10n'
import { copySensitiveText } from '../services/clipboard.js'
import {
  canQuickCopyLoginValue,
  loginQuickCopyValue,
  LOGIN_QUICK_COPY_PASSWORD,
  LOGIN_QUICK_COPY_TOTP,
} from '../utils/loginQuickCopy.js'
import NcButton from '@nextcloud/vue/components/NcButton'
import PencilOutlineIcon from 'vue-material-design-icons/PencilOutline.vue'
import DeleteOutlineIcon from 'vue-material-design-icons/DeleteOutline.vue'

import RestoreIcon from 'vue-material-design-icons/Restore.vue'
import ContentCopyIcon from 'vue-material-design-icons/ContentCopy.vue'
import ClockOutlineIcon from 'vue-material-design-icons/ClockOutline.vue'
import CheckIcon from 'vue-material-design-icons/Check.vue'
import FieldRow from './FieldRow.vue'
import TotpDisplay from './TotpDisplay.vue'
import AttachmentManager from './AttachmentManager.vue'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  userKey: {
    type: Object,
    default: null,
  },
  folders: {
    type: Array,
    default: () => [],
  },
  collections: {
    type: Array,
    default: () => [],
  },
  organizations: {
    type: Array,
    default: () => [],
  },
  organizationKeys: {
    type: Object,
    default: () => ({}),
  },
  items: {
    type: Array,
    default: () => [],
  },

  advancedMode: {
    type: Boolean,
    required: true,
  },

  trashMode: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'edit',
  'delete',
  'changed',
  'save-notes',
  'select-related',
  'request-advanced-mode',

  'restore',
  'delete-permanent',
])

// Stufe 2O-2/2O-3a: effektive Cipher-Rechte
function itemIsPersonal(candidate) {
  return !String(
    candidate?.organizationId
    ?? '',
  ).trim()
}

function canViewPasswordForItem(candidate) {
  return itemIsPersonal(candidate)
    || candidate?.viewPassword === true
}

const personalItem = computed(() =>
  itemIsPersonal(props.item),
)

const canEditItem = computed(() =>
  personalItem.value
    || props.item?.edit === true,
)

const canViewPasswordItem = computed(() =>
  canViewPasswordForItem(props.item),
)

const canQuickCopyPassword = computed(() =>
  canQuickCopyLoginValue(
    props.item,
    LOGIN_QUICK_COPY_PASSWORD,
    canViewPasswordItem.value,
  ),
)

const canQuickCopyTotp = computed(() =>
  canQuickCopyLoginValue(
    props.item,
    LOGIN_QUICK_COPY_TOTP,
    canViewPasswordItem.value,
  ),
)

const canDeleteItem = computed(() =>
  personalItem.value
    || props.item?.permissions?.delete === true,
)

const canRestoreItem = computed(() =>
  personalItem.value
    || props.item?.permissions?.restore === true,
)

const notesMessage = ref('')
const notesCopied = ref(false)
const quickCopyAction = ref('')
const quickCopyMessage = ref('')

const notesEditing = ref(false)
const notesDraft = ref('')
const notesTextarea = ref(null)
const notesSaving = ref(false)
const notesError = ref('')

let inlineNotesMessageTimer = null
let quickCopyTimer = null

function quickCopyTitle(type) {
  const label = type === LOGIN_QUICK_COPY_TOTP
    ? t('nc_bitwarden', 'TOTP')
    : t('nc_bitwarden', 'Password')

  return `${label}: ${t(
    'nc_bitwarden',
    'Copy to clipboard',
  )}`
}

function clearQuickCopyFeedback() {
  if (quickCopyTimer) {
    clearTimeout(quickCopyTimer)
    quickCopyTimer = null
  }

  quickCopyAction.value = ''
  quickCopyMessage.value = ''
}

function showQuickCopyFeedback(type, copied) {
  clearQuickCopyFeedback()

  quickCopyAction.value = copied ? type : ''
  quickCopyMessage.value = copied
    ? (
      type === LOGIN_QUICK_COPY_TOTP
        ? t('nc_bitwarden', 'Current code was copied.')
        : t('nc_bitwarden', 'Password was copied.')
    )
    : (
      type === LOGIN_QUICK_COPY_TOTP
        ? t('nc_bitwarden', 'The code could not be copied.')
        : t('nc_bitwarden', 'Password could not be copied.')
    )

  quickCopyTimer = setTimeout(() => {
    quickCopyAction.value = ''
    quickCopyMessage.value = ''
    quickCopyTimer = null
  }, 1600)
}

async function copyLoginValue(type, event) {
  const actionButton = event?.currentTarget
  const pointerTriggered = Number(event?.detail) > 0
  const allowed = type === LOGIN_QUICK_COPY_TOTP
    ? canQuickCopyTotp.value
    : canQuickCopyPassword.value

  if (!allowed) {
    return
  }

  try {
    const value = await loginQuickCopyValue(
      props.item,
      type,
    )
    const copied = await writeClipboard(value)

    showQuickCopyFeedback(type, copied)
  } catch {
    showQuickCopyFeedback(type, false)
  } finally {
    if (pointerTriggered) {
      actionButton?.blur()
    }
  }
}

watch(
  () => [
    props.item?.id,
    props.item?.notes,
  ],
  ([itemId, notes], previous = []) => {
    const previousItemId = previous[0]

    if (
      !notesEditing.value
      || itemId !== previousItemId
    ) {
      notesDraft.value = String(notes ?? '')
      notesEditing.value = false
      notesSaving.value = false
      notesError.value = ''
    }
  },
  {
    immediate: true,
  },
)

function startNotesEdit() {
  if (!canEditItem.value) {
    return
  }

  notesDraft.value = String(
    props.item?.notes ?? '',
  )

  notesError.value = ''
  notesEditing.value = true

  nextTick(() => {
    const textarea = notesTextarea.value

    textarea?.focus()

    if (
      textarea
      && typeof textarea.setSelectionRange
        === 'function'
    ) {
      const end = textarea.value.length
      textarea.setSelectionRange(end, end)
    }
  })
}

function cancelNotesEdit() {
  if (notesSaving.value) {
    return
  }

  notesDraft.value = String(
    props.item?.notes ?? '',
  )

  notesError.value = ''
  notesEditing.value = false
}

function showInlineNotesMessage(message) {
  notesMessage.value = message

  if (inlineNotesMessageTimer) {
    clearTimeout(inlineNotesMessageTimer)
  }

  inlineNotesMessageTimer = setTimeout(() => {
    notesMessage.value = ''
    inlineNotesMessageTimer = null
  }, 2500)
}

function saveNotesInline() {
  if (!canEditItem.value) {
    notesEditing.value = false
    return
  }

  if (notesSaving.value) {
    return
  }

  const currentNotes = String(
    props.item?.notes ?? '',
  )

  if (notesDraft.value === currentNotes) {
    notesEditing.value = false
    notesError.value = ''
    return
  }

  notesSaving.value = true
  notesError.value = ''

  emit('save-notes', {
    item: props.item,
    notes: notesDraft.value,

    resolve(updatedItem) {
      notesSaving.value = false
      notesEditing.value = false
      notesError.value = ''

      notesDraft.value = String(
        updatedItem?.notes
        ?? notesDraft.value,
      )

      showInlineNotesMessage(
        t(
          'nc_bitwarden',
          'Notes saved.',
        ),
      )
    },

    reject(exception) {
      notesSaving.value = false

      notesError.value =
        exception?.response?.data?.error
        || exception?.response?.data?.message
        || exception?.message
        || t(
          'nc_bitwarden',
          'The notes could not be saved.',
        )

      nextTick(() => {
        notesTextarea.value?.focus()
      })
    },
  })
}

const activeDetailTab = ref('details')

watch(
  () => props.advancedMode,
  advancedMode => {
    if (!advancedMode) {
      activeDetailTab.value = 'details'
    }
  },
  {
    immediate: true,
  },
)

const passwordHistoryExpanded = ref(false)

const passwordHistoryEntries = computed(() => {
  if (!canViewPasswordItem.value) {
    return []
  }

  return Array.isArray(props.item?.passwordHistory)
    ? props.item.passwordHistory.filter(
      entry => Boolean(entry?.password),
    )
    : []
})

watch(
  () => props.item?.id,
  () => {
    passwordHistoryExpanded.value = false
  },
)

function passwordHistoryLabel(entry, index) {
  const value =
    entry?.lastUsedDate
    ?? entry?.LastUsedDate
    ?? null

  if (value) {
    return t(
      'nc_bitwarden',
      'Last used: {date}',
      {
        date: formatPasskeyDate(value),
      },
    )
  }

  return t(
    'nc_bitwarden',
    'Previous password {number}',
    {
      number: index + 1,
    },
  )
}

watch(
  () => props.item?.id,
  () => {
    activeDetailTab.value = 'details'
  },
)

watch(
  () => props.item?.type,
  value => {
    if (
      Number(value) !== 1
      && activeDetailTab.value === 'security'
    ) {
      activeDetailTab.value = 'details'
    }
  },
)

const itemName = computed(() =>
  props.item.name || t('nc_bitwarden', '(no name)'),
)

const visibleItemUris = computed(() => {
  const uris = props.item.login?.uris ?? []

  return props.advancedMode
    ? uris
    : uris.slice(0, 1)
})

const hasHiddenAdvancedData = computed(() => (
  Boolean(
    props.item.login
      ?.fido2Credentials
      ?.length,
  )
  || Boolean(
    props.item.attachments?.length,
  )
  || Boolean(
    props.item.fields?.length,
  )
  || Boolean(
    props.item.passwordHistory?.length,
  )
  || (
    props.item.login?.uris
    ?? []
  ).length > 1
  || (
    props.item.login?.uris
    ?? []
  ).some(uri =>
    uri?.match !== null
      && uri?.match !== undefined,
  )
))

const itemTypeLabel = computed(() => ({
  1: t('nc_bitwarden', 'Login'),
  2: t('nc_bitwarden', 'Secure note'),
  3: t('nc_bitwarden', 'Card'),
  4: t('nc_bitwarden', 'Identity'),
  5: t('nc_bitwarden', 'SSH key'),
})[Number(props.item.type)] ?? '')

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function formatPasskeyDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value ?? '')
  }

  return new Intl.DateTimeFormat(
    'de-DE',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

const metadataParts = computed(() => {
  const parts = []

  if (itemTypeLabel.value) {
    parts.push(itemTypeLabel.value)
  }

  const itemOrganizationId =
    props.item.organizationId
    ?? props.item.OrganizationId
    ?? null

  const organization = props.organizations.find(
    candidate =>
      normalizeId(candidate.id)
        === normalizeId(itemOrganizationId),
  )

  if (organization?.name) {
    parts.push(organization.name)
  } else if (!normalizeId(itemOrganizationId)) {
    parts.push(
      t('nc_bitwarden', 'Personal vault'),
    )
  }

  const collectionNames = (
    props.item.collectionIds ?? []
  )
    .map(collectionId =>
      props.collections.find(
        candidate =>
          normalizeId(candidate.id)
            === normalizeId(collectionId),
      )?.name,
    )
    .filter(Boolean)

  if (collectionNames.length) {
    parts.push(collectionNames.join(', '))
  }

  const folder = props.folders.find(
    candidate =>
      normalizeId(candidate.id)
        === normalizeId(props.item.folderId),
  )

  if (folder?.name) {
    parts.push(folder.name)
  }

  if (props.item.favorite) {
    parts.push(
      t('nc_bitwarden', 'Favorite'),
    )
  }

  return parts
})

let notesTimer = null

const expirationDate = computed(() => {
  const month = props.item.card?.expMonth
  const year = props.item.card?.expYear

  if (!month && !year) {
    return ''
  }

  return [
    month,
    year,
  ].filter(Boolean).join('/')
})

const identityName = computed(() =>
  [
    props.item.identity?.title,
    props.item.identity?.firstName,
    props.item.identity?.middleName,
    props.item.identity?.lastName,
  ]
    .filter(Boolean)
    .join(' '),
)

const identityAddress = computed(() =>
  [
    props.item.identity?.address1,
    props.item.identity?.address2,
    props.item.identity?.address3,
    [
      props.item.identity?.postalCode,
      props.item.identity?.city,
    ].filter(Boolean).join(' '),
    props.item.identity?.state,
    props.item.identity?.country,
  ]
    .filter(Boolean)
    .join('\n'),
)

const sshAlgorithm = computed(() =>
  String(props.item.sshKey?.publicKey ?? '')
    .trim()
    .split(/\s+/)[0]
    || t('nc_bitwarden', 'Not provided'),
)

const notesGroupTitle = computed(() =>
  Number(props.item.type) === 2
    ? t('nc_bitwarden', 'Secure note')
    : t('nc_bitwarden', 'Notes'),
)

const passwordStrength = computed(() => {
  const password = canViewPasswordItem.value
    ? String(
      props.item.login?.password ?? '',
    )
    : ''

  let score = 0

  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (
    /(.)\1{3,}/.test(password)
    || /(?:1234|abcd|qwerty|password)/i.test(password)
  ) {
    score = Math.max(0, score - 2)
  }

  if (score <= 2) {
    return {
      id: 'weak',
      label: t('nc_bitwarden', 'Weak'),
    }
  }

  if (score <= 4) {
    return {
      id: 'fair',
      label: t('nc_bitwarden', 'Fair'),
    }
  }

  if (score <= 6) {
    return {
      id: 'good',
      label: t('nc_bitwarden', 'Good'),
    }
  }

  return {
    id: 'strong',
    label: t('nc_bitwarden', 'Strong'),
  }
})

const passwordAgeDays = computed(() => {
  /*
   * Vaultwarden liefert passwordRevisionDate normalerweise
   * innerhalb des Login-Objekts.
   *
   * Bei älteren, durch Warden erstellten Einträgen fehlt dieses
   * Feld möglicherweise. In diesem Fall wird als bestmögliche
   * Näherung das Erstellungs- oder Änderungsdatum verwendet.
   */
  const revisionDate =
    props.item.login?.passwordRevisionDate
    ?? props.item.login?.PasswordRevisionDate
    ?? props.item.passwordRevisionDate
    ?? props.item.PasswordRevisionDate
    ?? props.item.creationDate
    ?? props.item.CreationDate
    ?? props.item.revisionDate
    ?? props.item.RevisionDate
    ?? ''

  const timestamp = Date.parse(revisionDate)

  if (Number.isNaN(timestamp)) {
    return null
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - timestamp)
      / 86400000,
    ),
  )
})

const passwordAgeLabel = computed(() => {
  if (passwordAgeDays.value === null) {
    return t('nc_bitwarden', 'Unknown')
  }

  if (passwordAgeDays.value === 0) {
    return t('nc_bitwarden', 'Changed today')
  }

  return t(
    'nc_bitwarden',
    '{count} days',
    { count: passwordAgeDays.value },
  )
})

const reusedPasswordItems = computed(() => {
  if (!canViewPasswordItem.value) {
    return []
  }

  const password = String(
    props.item.login?.password ?? '',
  )

  if (!password) {
    return []
  }

  return props.items
    .filter(candidate =>
      Number(candidate.type) === 1
      && !candidate.deletedDate
      && canViewPasswordForItem(candidate)
      && String(
        candidate.login?.password ?? '',
      ) === password,
    )
    .sort((left, right) =>
      String(left.name ?? '').localeCompare(
        String(right.name ?? ''),
        undefined,
        {
          sensitivity: 'base',
          numeric: true,
        },
      ),
    )
})

const reusedPasswordCount = computed(
  () => reusedPasswordItems.value.length,
)

const reusedPasswordExpanded = ref(false)

watch(
  () => props.item?.id,
  () => {
    reusedPasswordExpanded.value = false
  },
)

function relatedItemOwnerLabel(candidate) {
  const organizationId =
    candidate?.organizationId
    ?? candidate?.OrganizationId
    ?? null

  if (!normalizeId(organizationId)) {
    return t(
      'nc_bitwarden',
      'Personal vault',
    )
  }

  return (
    props.organizations.find(organization =>
      normalizeId(organization.id)
        === normalizeId(organizationId),
    )?.name
    || t(
      'nc_bitwarden',
      'Organization',
    )
  )
}

function isCurrentReusedItem(candidate) {
  return (
    normalizeId(candidate?.id)
      === normalizeId(props.item?.id)
  )
}

function openReusedPasswordItem(candidate) {
  if (isCurrentReusedItem(candidate)) {
    return
  }

  reusedPasswordExpanded.value = false
  emit('select-related', candidate)
}

const insecureUrlCount = computed(() =>
  (props.item.login?.uris ?? []).filter(uri =>
    /^http:\/\//i.test(
      String(uri.uri ?? '').trim(),
    ),
  ).length,
)

const passwordWarnings = computed(() => {
  const warnings = []

  if (passwordStrength.value.id === 'weak') {
    warnings.push(
      t('nc_bitwarden', 'This password is weak.'),
    )
  }

  if (reusedPasswordCount.value > 1) {
    warnings.push(
      t(
        'nc_bitwarden',
        'This password is reused in {count} items.',
        { count: reusedPasswordCount.value },
      ),
    )
  }

  if (
    passwordAgeDays.value !== null
    && passwordAgeDays.value >= 180
  ) {
    warnings.push(
      t(
        'nc_bitwarden',
        'This password has not been changed for at least 180 days.',
      ),
    )
  }

  if (insecureUrlCount.value > 0) {
    warnings.push(
      t(
        'nc_bitwarden',
        '{count} unencrypted HTTP URLs are stored.',
        { count: insecureUrlCount.value },
      ),
    )
  }

  return warnings
})

const linkedSecretIds = new Set([
  101,
  303,
  305,
  412,
  414,
  415,
])

const linkedFieldLabels = {
  100: t('nc_bitwarden', 'Username'),
  101: t('nc_bitwarden', 'Password'),
  300: t('nc_bitwarden', 'Cardholder'),
  301: t('nc_bitwarden', 'Expiration month'),
  302: t('nc_bitwarden', 'Expiration year'),
  303: t('nc_bitwarden', 'CVV'),
  304: t('nc_bitwarden', 'Card brand'),
  305: t('nc_bitwarden', 'Card number'),
  400: t('nc_bitwarden', 'Title'),
  401: t('nc_bitwarden', 'Middle name'),
  402: t('nc_bitwarden', 'Address line 1'),
  403: t('nc_bitwarden', 'Address line 2'),
  404: t('nc_bitwarden', 'Address line 3'),
  405: t('nc_bitwarden', 'City'),
  406: t('nc_bitwarden', 'State / region'),
  407: t('nc_bitwarden', 'Postal code'),
  408: t('nc_bitwarden', 'Country'),
  409: t('nc_bitwarden', 'Company'),
  410: t('nc_bitwarden', 'Email'),
  411: t('nc_bitwarden', 'Phone'),
  412: t('nc_bitwarden', 'Social security number'),
  413: t('nc_bitwarden', 'Username'),
  414: t('nc_bitwarden', 'Passport number'),
  415: t('nc_bitwarden', 'License number'),
  416: t('nc_bitwarden', 'First name'),
  417: t('nc_bitwarden', 'Last name'),
  418: t('nc_bitwarden', 'Full name'),
}

function linkedFieldLabel(linkedId) {
  const label = linkedFieldLabels[Number(linkedId)]

  return label
    ?? t('nc_bitwarden', 'Unavailable linked field')
}

function linkedFieldValue(linkedId) {
  const identity = props.item.identity ?? {}
  const fullName = [
    identity.firstName,
    identity.middleName,
    identity.lastName,
  ].filter(Boolean).join(' ')

  return {
    100: props.item.login?.username,
    101: props.item.login?.password,
    300: props.item.card?.cardholderName,
    301: props.item.card?.expMonth,
    302: props.item.card?.expYear,
    303: props.item.card?.code,
    304: props.item.card?.brand,
    305: props.item.card?.number,
    400: identity.title,
    401: identity.middleName,
    402: identity.address1,
    403: identity.address2,
    404: identity.address3,
    405: identity.city,
    406: identity.state,
    407: identity.postalCode,
    408: identity.country,
    409: identity.company,
    410: identity.email,
    411: identity.phone,
    412: identity.ssn,
    413: identity.username,
    414: identity.passportNumber,
    415: identity.licenseNumber,
    416: identity.firstName,
    417: identity.lastName,
    418: fullName,
  }[Number(linkedId)] ?? ''
}

function customFieldValue(field) {
  if (Number(field.type) === 2) {
    return String(field.value ?? '').toLowerCase() === 'true'
      ? t('nc_bitwarden', 'Yes')
      : t('nc_bitwarden', 'No')
  }

  if (Number(field.type) === 3) {
    return linkedFieldValue(field.linkedId)
  }

  return String(field.value ?? '')
}

function customFieldIsSecret(field) {
  return Number(field.type) === 1
    || (
      Number(field.type) === 3
      && linkedSecretIds.has(Number(field.linkedId))
    )
}

function canRevealCustomField(field) {
  return (
    !customFieldIsSecret(field)
    || canViewPasswordItem.value
  )
}

function customFieldIsCopyable(field) {
  if (Number(field.type) === 2) {
    return false
  }

  return canRevealCustomField(field)
}

function customFieldHint(field) {
  const type = Number(field.type)

  if (type === 3) {
    return t(
      'nc_bitwarden',
      'Linked to {field}',
      {
        field: linkedFieldLabel(field.linkedId),
      },
    )
  }

  return {
    0: t('nc_bitwarden', 'Text'),
    1: t('nc_bitwarden', 'Hidden'),
    2: t('nc_bitwarden', 'Boolean'),
  }[type] ?? t('nc_bitwarden', 'Text')
}

function confirmDelete() {
  if (!canDeleteItem.value) {
    return
  }

  // Bestätigung und API-Aufruf erfolgen zentral
  // in App.vue.
  emit('delete', props.item)
}

async function writeClipboard(value) {
  try {
    return await copySensitiveText(value)
  } catch {
    return false
  }
}

async function copyNotes() {
  const copied = await writeClipboard(
    String(props.item.notes ?? ''),
  )

  notesCopied.value = copied
  notesMessage.value = copied
    ? ''
    : t(
      'nc_bitwarden',
      'Notes could not be copied.',
    )

  if (notesTimer) {
    clearTimeout(notesTimer)
  }

  clearQuickCopyFeedback()

  notesTimer = setTimeout(() => {
    notesCopied.value = false
    notesMessage.value = ''
  }, 1600)
}

onBeforeUnmount(() => {

  if (inlineNotesMessageTimer) {
    clearTimeout(inlineNotesMessageTimer)
    inlineNotesMessageTimer = null
  }

  if (notesTimer) {
    clearTimeout(notesTimer)
  }

  notesCopied.value = false
})
</script>

<style scoped>
.bw-detail {
  height: 100%;
  overflow-y: auto;
  background: var(--color-main-background);
}

.bw-detail__header {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-main-background);
}

.bw-detail__title {
  min-width: 0;
}

.bw-detail__eyebrow {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bw-detail__title h2 {
  overflow: hidden;
  margin: 0;
  font-size: 1.35rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-detail__meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.4rem;
  margin-top: 0.25rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.78rem;
}

.bw-detail__meta-separator {
  opacity: 0.7;
}

.bw-detail__actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
}

.bw-detail__quick-copy-check {
  color: var(--color-success);
}

.bw-detail__quick-copy-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.bw-detail__content {
  padding-bottom: 1rem;
}

.bw-detail__group {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin: 0.7rem 1rem;
  padding: 0.85rem;
  border: 0;
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
}

.bw-detail__group-title {
  color: var(--color-text-maxcontrast);
  font-size: 0.9rem;
  font-weight: 650;
}

.bw-detail__grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(230px, 1fr)
  );
  gap: 0.65rem;
}

.bw-detail__grid--login {
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
}

.bw-detail__grid :deep(.bw-field-card) {
  border-color: transparent;
  box-shadow:
    0 1px 2px
    var(
      --color-box-shadow,
      rgba(0, 0, 0, 0.08)
    );
}

.bw-detail__notes-card {
  position: relative;
  min-height: 90px;
  padding: 0.85rem 3.25rem 0.85rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-detail__notes-card p {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.5;
  white-space: pre-wrap;
}

.bw-detail__copy-notes {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-detail__copy-check {
  color: var(--color-success);
  font-size: 1.05rem;
  font-weight: 700;
}

.bw-detail__copy-notes:hover,
.bw-detail__copy-notes:focus-visible {
  border-color: var(--color-border);
  background: var(--color-background-hover);
  color: var(--color-primary-element);
}

.bw-detail__message {
  margin: 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
}

.bw-detail__security-grid {
  display: grid;
  grid-template-columns: repeat(
    2,
    minmax(0, 1fr)
  );
  gap: 0.65rem;
}

.bw-detail__security-value {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.65rem;
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-detail__security-value span {
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
}

.bw-detail__strength--weak {
  color: var(--color-error);
}

.bw-detail__strength--fair {
  color: var(--color-warning);
}

.bw-detail__strength--good,
.bw-detail__strength--strong,
.bw-detail__security-ok {
  color: var(--color-success);
}

.bw-detail__warnings {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--color-warning);
  font-size: 0.85rem;
}

.bw-detail__security-ok {
  margin: 0;
  font-size: 0.85rem;
}

@media (max-width: 700px) {
  .bw-detail__header {
    align-items: flex-start;
  }

  .bw-detail__grid,
  .bw-detail__grid--login,
  .bw-detail__security-grid {
    grid-template-columns: 1fr;
  }

  .bw-detail__group {
    margin-right: 0.5rem;
    margin-left: 0.5rem;
  }
}

/* kontrastreicher Passwortstatus */

.bw-detail__security-value {
  gap: 0.4rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border-dark);
}

.bw-detail__security-value span {
  color: var(--color-main-text);
  font-weight: 600;
  opacity: 0.8;
}

.bw-detail__security-value strong {
  display: inline-flex;
  width: fit-content;
  min-height: 1.8rem;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border: 2px solid var(--color-border-dark);
  border-radius: 999px;
  color: var(--color-main-text) !important;
  font-weight: 700;
}

.bw-detail__strength--weak {
  border-color: var(--color-error) !important;
  background:
    color-mix(
      in srgb,
      var(--color-error) 30%,
      var(--color-main-background)
    );
}

.bw-detail__strength--fair {
  border-color: var(--color-warning) !important;
  background:
    color-mix(
      in srgb,
      var(--color-warning) 34%,
      var(--color-main-background)
    );
}

.bw-detail__strength--good,
.bw-detail__strength--strong {
  border-color: var(--color-success) !important;
  background:
    color-mix(
      in srgb,
      var(--color-success) 32%,
      var(--color-main-background)
    );
}

.bw-detail__password-age {
  border-color: var(--color-primary-element) !important;
  background:
    color-mix(
      in srgb,
      var(--color-primary-element) 22%,
      var(--color-main-background)
    );
}

.bw-detail__warnings {
  margin: 0;
  padding: 0.7rem 0.9rem 0.7rem 2rem;
  border-left: 5px solid var(--color-warning);
  border-radius: var(--border-radius);
  background:
    color-mix(
      in srgb,
      var(--color-warning) 26%,
      var(--color-main-background)
    );
  color: var(--color-main-text);
  font-weight: 600;
}

.bw-detail__security-ok {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border-left: 5px solid var(--color-success);
  border-radius: var(--border-radius);
  background:
    color-mix(
      in srgb,
      var(--color-success) 26%,
      var(--color-main-background)
    );
  color: var(--color-main-text) !important;
  font-weight: 600;
}

/* Passkeys */

.bw-detail__passkeys {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.bw-detail__passkey {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-detail__passkey strong {
  color: var(--color-main-text);
}

.bw-detail__passkey span {
  color: var(--color-text-maxcontrast);
  font-size: 0.82rem;
}

.bw-detail__tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.55rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-main-background);
}

.bw-detail__tabs button {
  min-width: 0;
  flex: 1 1 0;
  padding: 0.55rem 0.75rem;
  border: 0;
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
  color: var(--color-main-text);
  font-weight: 600;
  cursor: pointer;
}

.bw-detail__tabs button:hover,
.bw-detail__tabs button:focus-visible {
  background: var(--color-background-hover);
}

.bw-detail__tabs .bw-detail__tab--active {
  background: var(--color-primary-element-light);
  color: var(
    --color-primary-element-light-text,
    var(--color-main-text)
  );
  box-shadow: inset 0 -3px 0 var(--color-primary-element);
}

.bw-detail__content--details
  > .bw-detail__tab-security,
.bw-detail__content--details
  > .bw-detail__tab-attachments {
  display: none !important;
}

.bw-detail__content--security
  > :not(.bw-detail__tab-security) {
  display: none !important;
}

.bw-detail__content--attachments
  > :not(.bw-detail__tab-attachments) {
  display: none !important;
}

.bw-detail__empty-tab {
  margin: 1rem;
  padding: 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  color: var(--color-text-maxcontrast);
  background: var(--color-background-hover);
}

.bw-detail__tab-attachments {
  margin: 1rem;
}

@media (max-width: 680px) {
  .bw-detail__tabs {
    overflow-x: auto;
  }

  .bw-detail__tabs button {
    min-width: max-content;
  }
}

.bw-detail__notes-card {
  padding: 0.85rem;
}

.bw-detail__notes-view {
  min-height: 56px;
  padding-right: 5.25rem;
}

.bw-detail__notes-empty {
  color: var(--color-text-maxcontrast);
  font-style: italic;
}

.bw-detail__notes-actions {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.bw-detail__notes-actions
.bw-detail__copy-notes {
  position: static;
  inset: auto;
}

.bw-detail__notes-edit {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-detail__notes-edit:hover,
.bw-detail__notes-edit:focus-visible {
  border-color: var(--color-border);
  background: var(--color-background-hover);
  color: var(--color-primary-element);
}

.bw-detail__notes-card--editing {
  min-height: 180px;
}

.bw-detail__notes-textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 130px;
  padding: 0.75rem;
  resize: vertical;
  border: 1px solid var(--color-border-maxcontrast);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  font: inherit;
  line-height: 1.5;
}

.bw-detail__notes-textarea:focus {
  border-color: var(--color-primary-element);
  outline: 2px solid
    color-mix(
      in srgb,
      var(--color-primary-element) 25%,
      transparent
    );
}

.bw-detail__notes-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.65rem;
}

.bw-detail__notes-shortcut {
  margin: 0.5rem 0 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  text-align: right;
}

.bw-detail__message--error {
  color: var(--color-error);
}

.bw-detail__warning-stack {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bw-detail__reused-passwords {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.bw-detail__reused-toggle {
  align-self: flex-start;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-primary-element);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.bw-detail__reused-toggle:hover,
.bw-detail__reused-toggle:focus-visible {
  border-color: var(--color-primary-element);
  background: var(--color-background-hover);
}

.bw-detail__reused-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bw-detail__reused-heading {
  margin: 0 0 0.2rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.85rem;
}

.bw-detail__reused-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.bw-detail__reused-item:not(:disabled):hover,
.bw-detail__reused-item:not(:disabled):focus-visible {
  border-color: var(--color-primary-element);
  background: var(--color-background-hover);
}

.bw-detail__reused-item--current {
  border-style: dashed;
  cursor: default;
  opacity: 0.78;
}

.bw-detail__reused-item-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.bw-detail__reused-item-main strong,
.bw-detail__reused-username {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-detail__reused-username,
.bw-detail__reused-context {
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
}

.bw-detail__reused-username--empty {
  font-style: italic;
}

.bw-detail__reused-context {
  flex: 0 0 auto;
  text-align: right;
}

.bw-detail__reused-current {
  font-weight: 600;
}

.bw-detail__password-history {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bw-detail__password-history-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.bw-detail__password-history-toggle {
  flex: 0 0 auto;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-primary-element);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.bw-detail__password-history-toggle:hover,
.bw-detail__password-history-toggle:focus-visible {
  border-color: var(--color-primary-element);
  background: var(--color-background-hover);
}

.bw-detail__password-history-hint {
  margin: 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.85rem;
}

.bw-detail__password-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding-top: 0.25rem;
}

.bw-detail__trash-notice {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0.75rem 1rem 0;
  padding: 0.75rem 0.9rem;
  border-left: 5px solid var(--color-warning);
  border-radius: var(--border-radius);
  background:
    color-mix(
      in srgb,
      var(--color-warning) 18%,
      var(--color-main-background)
    );
}

.bw-detail__trash-notice span {
  color: var(--color-text-maxcontrast);
  font-size: 0.82rem;
}

.bw-detail--trash .bw-detail__notes-edit,
.bw-detail--trash .bw-detail__notes-editor-actions,
.bw-detail--trash .bw-detail__tab-attachments {
  display: none !important;
}

.bw-detail__advanced-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.75rem 1rem 0;
  padding: 0.8rem 0.9rem;
  border:
    1px solid
    var(--color-border-dark);
  border-radius:
    var(--border-radius-large);
  background:
    var(--color-background-hover);
}

.bw-detail__advanced-notice > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.2rem;
}

.bw-detail__advanced-notice span {
  color:
    var(--color-text-maxcontrast);
  font-size: 0.82rem;
}

@media (max-width: 680px) {
  .bw-detail__advanced-notice {
    align-items: stretch;
    flex-direction: column;
  }
}

/* Stage 2D notice layout */
.bw-detail__advanced-notice {
  display: grid;
  grid-template-areas:
    "title title"
    "description action";
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  column-gap: 1rem;
  row-gap: 0.25rem;
}

.bw-detail__advanced-notice > div {
  display: contents;
}

.bw-detail__advanced-notice > div > strong {
  min-width: 0;
  grid-area: title;
}

.bw-detail__advanced-notice > div > span {
  min-width: 0;
  grid-area: description;
}

.bw-detail__advanced-notice-action {
  grid-area: action;
  align-self: end;
  justify-self: end;
  margin-top: 0.15rem;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .bw-detail__advanced-notice {
    grid-template-areas:
      "title"
      "description"
      "action";
    grid-template-columns: minmax(0, 1fr);
  }

  .bw-detail__advanced-notice-action {
    justify-self: start;
  }
}

</style>
