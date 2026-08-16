<template>
  <NcDialog
    v-if="!headless"
    :name="isEdit
      ? t('nc_bitwarden', 'Edit item')
      : t('nc_bitwarden', 'New item')"
    size="large"
    @closing="requestClose"
  >
    <div class="bw-form">
      <div class="bw-form__sticky-header">
        <div class="bw-form__header-row">
          <div class="bw-form__field bw-form__type-field">
            <label class="bw-form__label">
              {{ t('nc_bitwarden', 'Type') }}
            </label>

            <div class="bw-form__radio-group">
              <NcCheckboxRadioSwitch
                v-for="typeOption in visibleTypeOptions"
                :key="typeOption.id"
                v-model="selectedType"
                :value="typeOption.id"
                name="item_type"
                type="radio"
                :disabled="
                  isEdit
                    || (
                      !advancedMode
                      && ![1, 2].includes(typeOption.id)
                    )
                "
              >
                <span class="bw-form__type-option">
                  <component
                    :is="typeOption.icon"
                    :size="18"
                  />
                  {{ typeOption.label }}
                </span>
              </NcCheckboxRadioSwitch>
            </div>
          </div>

          <span
            v-if="hasUnsavedChanges"
            class="bw-form__changed-indicator bw-form__unsaved-hidden"
          >
            {{ t('nc_bitwarden', 'Unsaved changes') }}
          </span>
        </div>

        <div
          v-if="advancedMode"
          class="bw-form__tabs"
          role="tablist"
          :aria-label="t('nc_bitwarden', 'Item sections')"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'assignment'"
            :class="{
              'bw-form__tab--active':
                activeTab === 'assignment',
              'bw-form__tab--warning':
                tabHasIssue('assignment'),
            }"
            @click="activeTab = 'assignment'"
          >
            {{ t('nc_bitwarden', 'Assignment') }}
          </button>

          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'content'"
            :class="{
              'bw-form__tab--active':
                activeTab === 'content',
              'bw-form__tab--warning':
                tabHasIssue('content')
                || tabHasIssue('fields'),
            }"
            @click="activeTab = 'content'"
          >
            {{ t('nc_bitwarden', 'Content') }}
            <span v-if="form.fields.length">
              ({{ form.fields.length }})
            </span>
          </button>

          <button
            v-if="Number(selectedType) === 1"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'security'"
            :class="{
              'bw-form__tab--active':
                activeTab === 'security',
            }"
            @click="activeTab = 'security'"
          >
            {{ t('nc_bitwarden', 'Security') }}
            <span v-if="form.passkeys.length">
              ({{ form.passkeys.length }})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'attachments'"
            :class="{
              'bw-form__tab--active':
                activeTab === 'attachments',
            }"
            @click="activeTab = 'attachments'"
          >
            {{ t('nc_bitwarden', 'Attachments') }} ({{ formAttachments.length }})
          </button>
        </div>
      </div>

      <div class="bw-form__scroll-area">
        <section
          v-show="
            !advancedMode
              || activeTab === 'assignment'
          "
          class="bw-form__tab-panel"
          role="tabpanel"
        >
          <NcTextField
            v-model="form.name"
            :label="t('nc_bitwarden', 'Name *')"
            class="bw-form__field"
          />

          <div class="bw-form__field">
            <label
              class="bw-form__label"
              for="bw-item-organization"
            >
              {{ t('nc_bitwarden', 'Vault / organization') }}
            </label>

            <select
              id="bw-item-organization"
              v-model="form.organizationId"
              class="bw-form__select"
              :disabled="passwordRestricted"
            >
              <option value="">
                {{ t('nc_bitwarden', 'Personal vault') }}
              </option>

              <option
                v-for="organization in organizationOptions"
                :key="organization.id"
                :value="organization.id"
              >
                {{ organization.name }}
              </option>
            </select>
          </div>

          <NcNoteCard
            v-if="selectedType === 5 && form.organizationId"
            type="warning"
            class="bw-form__ssh-organization-warning"
          >
            {{
              t(
                'nc_bitwarden',
                'Saving this SSH key in an organization shares the private key with all authorized members.',
              )
            }}
          </NcNoteCard>

          <div
            v-if="form.organizationId"
            class="bw-form__field"
          >
            <label
              class="bw-form__label"
              for="bw-item-collection-search"
            >
              {{ t('nc_bitwarden', 'Collections') }}
            </label>

            <div class="bw-form__collection-search">
              <MagnifyIcon :size="18" />

              <input
                id="bw-item-collection-search"
                v-model="collectionSearch"
                type="search"
                :placeholder="t('nc_bitwarden', 'Search collections…')"
                :disabled="passwordRestricted"
                autocomplete="off"
              >

              <button
                v-if="collectionSearch"
                type="button"
                :title="t('nc_bitwarden', 'Clear collection search')"
                :aria-label="t('nc_bitwarden', 'Clear collection search')"
                @click="collectionSearch = ''"
              >
                <CloseIcon :size="17" />
              </button>
            </div>

            <div class="bw-form__collection-summary">
              {{ t(
                'nc_bitwarden',
                'Selected: {selected} · Results: {results} · Total: {total}',
                {
                  selected: selectedCollections.length,
                  results: collectionResults.length,
                  total: availableCollections.length,
                },
              ) }}
            </div>

            <div class="bw-form__collections">
              <section
                v-if="selectedCollections.length > 0"
                class="bw-form__collection-group"
              >
                <h4>{{ t('nc_bitwarden', 'Selected') }}</h4>

                <label
                  v-for="collection in selectedCollections"
                  :key="`selected-${collection.id}`"
                  class="bw-form__collection"
                >
                  <input
                    v-model="form.collectionIds"
                    type="checkbox"
                    :value="collection.id"
                    :disabled="passwordRestricted || collection.readOnly"
                  >

                  <span class="bw-form__collection-text">
                    <strong>{{ collectionParts(collection).label }}</strong>
                    <small v-if="collectionParts(collection).parent">
                      {{ collectionParts(collection).parent }}
                    </small>
                  </span>
                </label>
              </section>

              <section class="bw-form__collection-group">
                <h4>
                  {{ collectionSearch
                    ? t('nc_bitwarden', 'Results')
                    : t('nc_bitwarden', 'Available')
                  }}
                </h4>

                <label
                  v-for="collection in collectionResults"
                  :key="`result-${collection.id}`"
                  class="bw-form__collection"
                >
                  <input
                    v-model="form.collectionIds"
                    type="checkbox"
                    :value="collection.id"
                    :disabled="passwordRestricted || collection.readOnly"
                  >

                  <span class="bw-form__collection-text">
                    <strong>{{ collectionParts(collection).label }}</strong>
                    <small v-if="collectionParts(collection).parent">
                      {{ collectionParts(collection).parent }}
                    </small>
                  </span>
                </label>

                <p
                  v-if="collectionResults.length === 0"
                  class="bw-form__collection-empty"
                >
                  {{ t(
                    'nc_bitwarden',
                    'No matching writable collection was found.',
                  ) }}
                </p>
              </section>
            </div>

            <small class="bw-form__hint">
              {{ t(
                'nc_bitwarden',
                'The full path is searched. An organization item must be assigned to at least one collection.',
              ) }}
            </small>
          </div>

          <div
            v-if="!form.organizationId"
            class="bw-form__field"
          >
            <label
              class="bw-form__label"
              for="bw-item-folder"
            >
              {{ t('nc_bitwarden', 'Personal folder') }}
            </label>

            <select
              id="bw-item-folder"
              v-model="form.folderId"
              class="bw-form__select"
            >
              <option value="">
                {{ t('nc_bitwarden', 'No personal folder selected') }}
              </option>
              <option
                v-for="folder in sortedFolders"
                :key="folder.id"
                :value="folder.id"
              >
                {{ folder.name }}
              </option>
            </select>
          </div>
        </section>

        <section
          v-show="
            !advancedMode
              || activeTab === 'content'
          "
          class="bw-form__tab-panel bw-form__tab-panel--content"
          role="tabpanel"
        >
          <template v-if="selectedType === 1">
            <NcTextField
              v-model="form.username"
              :label="t('nc_bitwarden', 'Username')"
              class="bw-form__field"
            />
            <template v-if="!passwordRestricted">
              <NcPasswordField
                v-model="form.password"
                :label="t('nc_bitwarden', 'Password')"
                class="bw-form__field"
              />

              <div class="bw-form__full-width">
                <PasswordGenerator
                  v-model="form.password"
                  :preferences="generatorPreferences"
                />
              </div>
            </template>

            <NcNoteCard
              v-else
              type="info"
              class="bw-form__full-width"
            >
              {{
                t(
                  'nc_bitwarden',
                  'Password access is restricted for this item. The password and hidden fields remain unchanged.',
                )
              }}
            </NcNoteCard>
            <div class="bw-form__full-width">
              <label class="bw-form__label">
                {{
                  advancedMode
                    ? t('nc_bitwarden', 'URLs')
                    : t('nc_bitwarden', 'URL')
                }}
              </label>

              <div class="bw-form__uri-list">
                <div
                  v-for="(
                    loginUri,
                    index
                  ) in visibleLoginUris"
                  :key="`login-uri-${index}`"
                  class="bw-form__uri-row"
                >
                  <NcTextField
                    v-model="loginUri.uri"
                    :label="
                      advancedMode
                        ? t(
                          'nc_bitwarden',
                          'URL {number}',
                          { number: index + 1 },
                        )
                        : t(
                          'nc_bitwarden',
                          'URL',
                        )
                    "
                    class="bw-form__uri-input"
                  />

                  <button
                    v-if="advancedMode"
                    type="button"
                    class="bw-form__uri-advanced"
                    :aria-expanded="loginUri.advanced"
                    @click="
                      loginUri.advanced = !loginUri.advanced
                    "
                  >
                    {{
                      loginUri.advanced
                        ? t(
                          'nc_bitwarden',
                          'Hide advanced settings',
                        )
                        : t(
                          'nc_bitwarden',
                          'Advanced',
                        )
                    }}
                  </button>

                  <div
                    v-if="
                      advancedMode
                        && loginUri.advanced
                    "
                    class="bw-form__uri-match"
                  >
                    <label :for="`bw-uri-match-${index}`">
                      {{
                        t(
                          'nc_bitwarden',
                          'Match detection',
                        )
                      }}
                    </label>

                    <select
                      :id="`bw-uri-match-${index}`"
                      v-model="loginUri.match"
                      class="bw-form__select"
                    >
                      <option :value="null">
                        {{
                          t(
                            'nc_bitwarden',
                            'Default match detection',
                          )
                        }}
                      </option>
                      <option :value="0">
                        {{ t('nc_bitwarden', 'Base domain') }}
                      </option>
                      <option :value="1">
                        {{ t('nc_bitwarden', 'Host') }}
                      </option>
                      <option :value="2">
                        {{ t('nc_bitwarden', 'Starts with') }}
                      </option>
                      <option :value="3">
                        {{ t('nc_bitwarden', 'Exact') }}
                      </option>
                      <option :value="4">
                        {{
                          t(
                            'nc_bitwarden',
                            'Regular expression',
                          )
                        }}
                      </option>
                      <option :value="5">
                        {{ t('nc_bitwarden', 'Never') }}
                      </option>
                    </select>
                  </div>

                  <button
                    v-if="advancedMode"
                    type="button"
                    class="bw-form__uri-remove"
                    :title="
                      t(
                        'nc_bitwarden',
                        'Remove URL {number}',
                        { number: index + 1 },
                      )
                    "
                    :aria-label="
                      t(
                        'nc_bitwarden',
                        'Remove URL {number}',
                        { number: index + 1 },
                      )
                    "
                    @click="removeLoginUri(index)"
                  >
                    ×
                  </button>
                </div>
              </div>

              <NcButton
                v-if="advancedMode"
                variant="secondary"
                @click="addLoginUri"
              >
                {{ t('nc_bitwarden', 'Add URL') }}
              </NcButton>
            </div>

            <NcPasswordField
              v-if="
                !advancedMode
                  && !passwordRestricted
              "
              v-model="form.totp"
              :label="
                t(
                  'nc_bitwarden',
                  'TOTP (optional)',
                )
              "
              class="bw-form__field"
              autocomplete="off"
            />
          </template>

          <template v-if="selectedType === 3">
            <NcTextField v-model="form.cardholderName" :label="t('nc_bitwarden', 'Cardholder')" class="bw-form__field" />
            <NcTextField v-model="form.cardBrand" :label="t('nc_bitwarden', 'Card brand')" class="bw-form__field" />
            <NcTextField v-model="form.cardNumber" :label="t('nc_bitwarden', 'Card number')" class="bw-form__field" />
            <NcTextField v-model="form.expMonth" :label="t('nc_bitwarden', 'Month (MM)')" class="bw-form__field" />
            <NcTextField v-model="form.expYear" :label="t('nc_bitwarden', 'Year (YYYY)')" class="bw-form__field" />
            <NcTextField v-model="form.cvv" :label="t('nc_bitwarden', 'CVV')" class="bw-form__field" />
          </template>

          <template v-if="selectedType === 4">
            <NcTextField v-model="form.title" :label="t('nc_bitwarden', 'Title')" class="bw-form__field" />
            <NcTextField v-model="form.firstName" :label="t('nc_bitwarden', 'First name')" class="bw-form__field" />
            <NcTextField v-model="form.middleName" :label="t('nc_bitwarden', 'Middle name')" class="bw-form__field" />
            <NcTextField v-model="form.lastName" :label="t('nc_bitwarden', 'Last name')" class="bw-form__field" />
            <NcTextField v-model="form.idUsername" :label="t('nc_bitwarden', 'Username')" class="bw-form__field" />
            <NcTextField v-model="form.company" :label="t('nc_bitwarden', 'Company')" class="bw-form__field" />
            <NcTextField v-model="form.idEmail" :label="t('nc_bitwarden', 'Email')" class="bw-form__field" />
            <NcTextField v-model="form.phone" :label="t('nc_bitwarden', 'Phone')" class="bw-form__field" />
            <NcTextField v-model="form.address" :label="t('nc_bitwarden', 'Address line 1')" class="bw-form__field" />
            <NcTextField v-model="form.address2" :label="t('nc_bitwarden', 'Address line 2')" class="bw-form__field" />
            <NcTextField v-model="form.address3" :label="t('nc_bitwarden', 'Address line 3')" class="bw-form__field" />
            <NcTextField v-model="form.city" :label="t('nc_bitwarden', 'City')" class="bw-form__field" />
            <NcTextField v-model="form.state" :label="t('nc_bitwarden', 'State / region')" class="bw-form__field" />
            <NcTextField v-model="form.postalCode" :label="t('nc_bitwarden', 'Postal code')" class="bw-form__field" />
            <NcTextField v-model="form.country" :label="t('nc_bitwarden', 'Country')" class="bw-form__field" />
            <NcTextField v-model="form.ssn" :label="t('nc_bitwarden', 'Social security number')" class="bw-form__field" />
            <NcTextField v-model="form.passportNumber" :label="t('nc_bitwarden', 'Passport number')" class="bw-form__field" />
            <NcTextField v-model="form.licenseNumber" :label="t('nc_bitwarden', 'License number')" class="bw-form__field" />
          </template>

          <div
            v-if="selectedType === 5"
            class="bw-form__full-width"
          >
            <SshKeyGenerator
              v-model:private-key="form.sshPrivateKey"
              v-model:public-key="form.sshPublicKey"
              v-model:fingerprint="form.sshFingerprint"
            />
          </div>

          <div class="bw-form__field bw-form__full-width">
            <label class="bw-form__label">
              {{ selectedType === 2
                ? t('nc_bitwarden', 'Note')
                : t('nc_bitwarden', 'Notes')
              }}
            </label>
            <textarea
              v-model="form.notes"
              class="bw-form__textarea"
              rows="6"
            />
          </div>

          <NcCheckboxRadioSwitch
            v-model="form.favorite"
            type="checkbox"
            class="bw-form__full-width"
          >
            {{ t('nc_bitwarden', 'Mark as favorite') }}
          </NcCheckboxRadioSwitch>
        </section>

        <section
          v-show="
            advancedMode
              && activeTab === 'security'
          "
          class="bw-form__tab-panel"
          role="tabpanel"
        >
          <template v-if="Number(selectedType) === 1">
            <div
              v-if="!passwordRestricted"
              class="bw-form__security-summary"
            >
              <div class="bw-form__security-value">
                <span>{{ t('nc_bitwarden', 'Password strength') }}</span>
                <strong
                  :class="
                    `bw-form__strength--${currentPasswordStrength.id}`
                  "
                >
                  {{ currentPasswordStrength.label }}
                </strong>
              </div>

              <div class="bw-form__security-value">
                <span>{{ t('nc_bitwarden', 'Password age') }}</span>
                <strong>{{ formPasswordAgeLabel }}</strong>
              </div>
            </div>

            <div
              v-if="!passwordRestricted"
              class="bw-form__totp-editor"
            >
              <div class="bw-form__passkeys-title">
                {{
                  t(
                    'nc_bitwarden',
                    'Authenticator key (TOTP)',
                  )
                }}
              </div>

              <NcPasswordField
                v-model="form.totp"
                :label="
                  t(
                    'nc_bitwarden',
                    'TOTP (optional)',
                  )
                "
                class="
                  bw-form__field
                  bw-form__full-width
                "
              />

              <p class="bw-form__passkey-hint">
                {{
                  t(
                    'nc_bitwarden',
                    'Enter a Base32 secret or the complete otpauth URI.',
                  )
                }}
              </p>
            </div>

            <div class="bw-form__passkeys">
              <div class="bw-form__passkeys-title">
                {{ t('nc_bitwarden', 'Stored passkeys') }}
              </div>

              <article
                v-for="(
                  credential,
                  index
                ) in form.passkeys"
                :key="
                  credential.credentialId
                    || `passkey-${index}`
                "
                class="bw-form__passkey"
              >
                <div class="bw-form__passkey-info">
                  <strong>
                    {{
                      credential.rpName
                        || credential.rpId
                        || t('nc_bitwarden', 'Passkey')
                    }}
                  </strong>

                  <span v-if="credential.rpId">
                    {{ credential.rpId }}
                  </span>

                  <span
                    v-if="
                      credential.userDisplayName
                        || credential.userName
                    "
                  >
                    {{
                      credential.userDisplayName
                        || credential.userName
                    }}
                  </span>
                </div>

                <button
                  type="button"
                  class="bw-form__passkey-remove"
                  @click="removePasskey(index)"
                >
                  {{ t('nc_bitwarden', 'Remove') }}
                </button>
              </article>

              <p
                v-if="!form.passkeys.length"
                class="bw-form__passkey-empty"
              >
                {{ t('nc_bitwarden', 'No passkey is stored in this item.') }}
              </p>

              <p class="bw-form__passkey-hint">
                {{
                  t(
                    'nc_bitwarden',
                    'New website passkeys must still be created with a compatible Bitwarden browser extension. Removing a stored passkey takes effect when the item is saved.',
                  )
                }}
              </p>
            </div>
          </template>
        </section>

        <section
          v-show="
            advancedMode
              && activeTab === 'attachments'
          "
          class="bw-form__tab-panel"
          role="tabpanel"
        >
          <AttachmentManager
            v-if="isEdit && attachmentItem.id"
            :item="attachmentItem"
            :user-key="userKey"
            :organization-keys="organizationKeys"
            :read-only="
              isEdit
                && item?.edit === false
            "
            @changed="handleAttachmentsChanged"
          />

          <NcNoteCard
            v-else
            type="info"
          >
            {{
              t(
                'nc_bitwarden',
                'Save this item before adding attachments.',
              )
            }}
          </NcNoteCard>
        </section>

        <section
          v-show="
            advancedMode
              && activeTab === 'content'
          "
          class="bw-form__tab-panel"
          role="tabpanel"
        >
          <NcNoteCard
            v-if="invalidLinkedFieldCount > 0"
            type="warning"
          >
            {{ t(
              'nc_bitwarden',
              'One or more linked fields are not available for this item type. Edit or delete them before saving.',
            ) }}
          </NcNoteCard>

          <div
            v-if="form.fields.length"
            class="bw-form__custom-fields"
          >
            <article
              v-for="(field, index) in form.fields"
              :key="field.localId"
              class="bw-form__custom-field"
              :class="{
                'bw-form__custom-field--editing':
                  fieldEditor.open && fieldEditor.index === index,
              }"
            >
              <span
                class="bw-form__custom-field-grip"
                aria-hidden="true"
              >⋮⋮</span>

              <div class="bw-form__custom-field-summary">
                <div class="bw-form__custom-field-title">
                  <strong>
                    {{ field.name || t('nc_bitwarden', 'Unnamed field') }}
                  </strong>
                  <span class="bw-form__custom-field-type">
                    {{ customFieldTypeLabel(field.type) }}
                  </span>
                </div>
                <small>{{ customFieldPreview(field) }}</small>
              </div>

              <div class="bw-form__custom-field-actions">
                <button
                  type="button"
                  :disabled="index === 0"
                  :title="t('nc_bitwarden', 'Move field up')"
                  :aria-label="t('nc_bitwarden', 'Move field up')"
                  @click="moveCustomField(index, -1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  :disabled="index === form.fields.length - 1"
                  :title="t('nc_bitwarden', 'Move field down')"
                  :aria-label="t('nc_bitwarden', 'Move field down')"
                  @click="moveCustomField(index, 1)"
                >
                  ↓
                </button>
                <button
                  type="button"
                  :title="t('nc_bitwarden', 'Edit')"
                  :aria-label="t('nc_bitwarden', 'Edit')"
                  :disabled="
                    customFieldIsProtected(field)
                  "
                  @click="editCustomField(index)"
                >
                  ✎
                </button>
                <button
                  type="button"
                  class="bw-form__danger-button"
                  :title="t('nc_bitwarden', 'Delete')"
                  :aria-label="t('nc_bitwarden', 'Delete')"
                  :disabled="
                    customFieldIsProtected(field)
                  "
                  @click="removeCustomField(index)"
                >
                  ×
                </button>
              </div>
            </article>
          </div>

          <p
            v-else
            class="bw-form__empty-fields"
          >
            {{ t('nc_bitwarden', 'No additional fields have been added.') }}
          </p>

          <NcButton
            v-if="!fieldEditor.open"
            variant="secondary"
            @click="openCustomFieldEditor"
          >
            {{ t('nc_bitwarden', 'Add field') }}
          </NcButton>

          <div
            v-else
            class="bw-form__field-editor"
          >
            <h4>
              {{ fieldEditor.index === null
                ? t('nc_bitwarden', 'Add field')
                : t('nc_bitwarden', 'Edit field')
              }}
            </h4>

            <div class="bw-form__field">
              <label class="bw-form__label" for="bw-custom-field-type">
                {{ t('nc_bitwarden', 'Field type') }}
              </label>
              <select
                id="bw-custom-field-type"
                v-model.number="fieldEditor.type"
                class="bw-form__select"
              >
                <option
                  v-for="option in customFieldTypeOptions"
                  :key="option.value"
                  :value="option.value"
                  :disabled="
                    passwordRestricted
                      && option.value === FIELD_TYPE_HIDDEN
                  "
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <NcTextField
              v-model="fieldEditor.name"
              :label="t('nc_bitwarden', 'Field name *')"
              class="bw-form__field"
            />

            <NcTextField
              v-if="fieldEditor.type === FIELD_TYPE_TEXT"
              v-model="fieldEditor.value"
              :label="t('nc_bitwarden', 'Value')"
              class="bw-form__field"
            />

            <NcPasswordField
              v-else-if="fieldEditor.type === FIELD_TYPE_HIDDEN"
              v-model="fieldEditor.value"
              :label="t('nc_bitwarden', 'Value')"
              class="bw-form__field"
            />

            <NcCheckboxRadioSwitch
              v-else-if="fieldEditor.type === FIELD_TYPE_BOOLEAN"
              v-model="fieldEditor.booleanValue"
              type="checkbox"
            >
              {{ t('nc_bitwarden', 'Enabled') }}
            </NcCheckboxRadioSwitch>

            <div
              v-else-if="fieldEditor.type === FIELD_TYPE_LINKED"
              class="bw-form__field"
            >
              <label class="bw-form__label" for="bw-linked-field">
                {{ t('nc_bitwarden', 'Linked standard field') }}
              </label>
              <select
                id="bw-linked-field"
                v-model.number="fieldEditor.linkedId"
                class="bw-form__select"
              >
                <option
                  v-for="option in linkedFieldOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div class="bw-form__editor-actions">
              <NcButton @click="cancelCustomFieldEditor">
                {{ t('nc_bitwarden', 'Cancel') }}
              </NcButton>
              <NcButton
                variant="primary"
                :disabled="!canApplyCustomField"
                @click="applyCustomField"
              >
                {{ t('nc_bitwarden', 'Apply field') }}
              </NcButton>
            </div>
          </div>
        </section>

        <div
          v-if="error"
          class="bw-form__error"
          role="alert"
          aria-live="assertive"
        >
          {{ error }}
        </div>
      </div>
    </div>

    <template #actions>
      <NcButton @click="requestClose">
        {{ t('nc_bitwarden', 'Cancel') }}
      </NcButton>
      <NcButton
        variant="primary"
        :disabled="saving || !canSave"
        @click="save"
      >
        {{ saving
          ? t('nc_bitwarden', 'Saving…')
          : t('nc_bitwarden', 'Save')
        }}
      </NcButton>
    </template>
  </NcDialog>
</template>

<script setup>
import PasswordGenerator from './PasswordGenerator.vue'
import SshKeyGenerator from './SshKeyGenerator.vue'
import AttachmentManager from './AttachmentManager.vue'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import NcPasswordField from '@nextcloud/vue/components/NcPasswordField'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import KeyOutlineIcon from 'vue-material-design-icons/KeyOutline.vue'
import NoteTextOutlineIcon from 'vue-material-design-icons/NoteTextOutline.vue'
import CreditCardOutlineIcon from 'vue-material-design-icons/CreditCardOutline.vue'
import IdentityOutlineIcon from 'vue-material-design-icons/CardAccountDetailsOutline.vue'
import MagnifyIcon from 'vue-material-design-icons/Magnify.vue'
import CloseIcon from 'vue-material-design-icons/Close.vue'
import { VaultwardenApi } from '../services/api.js'
import {
  decryptCipher,
  encryptString,
} from '../services/crypto.js'
import {
  copyCipherAttachments,
} from '../services/attachments.js'
import {
  collectionMatchesQuery,
  collectionNameParts,
} from '../utils/collectionSearch.js'

const props = defineProps({
  userKey: { type: Object, required: true },
  item: { type: Object, default: null },
  folders: { type: Array, default: () => [] },
  collections: { type: Array, default: () => [] },
  organizations: { type: Array, default: () => [] },
  organizationKeys: { type: Object, default: () => ({}) },
  defaultItemType: { type: Number, default: 1 },
  defaultOrganizationId: { type: String, default: '' },
  defaultCollectionId: { type: String, default: '' },

  transferOrganizationId: {
    type: String,
    default: '',
  },

  transferCollectionId: {
    type: String,
    default: '',
  },

  autoSave: {
    type: Boolean,
    default: false,
  },

  headless: {
    type: Boolean,
    default: false,
  },

  advancedMode: {
    type: Boolean,
    required: true,
  },

  generatorPreferences: { type: Object, default: () => ({}) },
})
const emit = defineEmits([
  'saved',
  'close',
  'attachments-changed',
  'auto-save-failed',
])
const FIELD_TYPE_TEXT = 0
const FIELD_TYPE_HIDDEN = 1
const FIELD_TYPE_BOOLEAN = 2
const FIELD_TYPE_LINKED = 3

const saving = ref(false)
const error = ref('')
const collectionSearch = ref('')
const activeTab = ref('assignment')
const isEdit = computed(() => Boolean(props.item?.id))

/*
 * Stufe 2O-3b:
 * Ein Benutzer darf den übrigen Eintrag bearbeiten, ohne dass
 * Passwort oder verborgene benutzerdefinierte Felder in sichtbare
 * Editoren übernommen werden.
 */
const passwordRestricted = computed(() =>
  isEdit.value
    && (
      props.item?.viewPassword
      ?? props.item?.ViewPassword
    ) === false,
)

const requestedInitialType = Number(
  props.item?.type
    ?? props.defaultItemType
    ?? 1,
)

const selectedType = ref(
  props.advancedMode
    || isEdit.value
    || [1, 2].includes(requestedInitialType)
    ? requestedInitialType
    : 1,
)
const formAttachments = ref(
  isEdit.value
    ? [...(props.item?.attachments ?? [])]
    : [],
)

watch(selectedType, value => {
  if (
    Number(value) !== 1
    && activeTab.value === 'security'
  ) {
    activeTab.value = 'content'
  }
})
let nextFieldId = 1

function localFieldId() {
  const value = nextFieldId
  nextFieldId += 1
  return `field-${value}`
}

function normalizeCustomField(field = {}) {
  const type = Number(field.type ?? 0)
  return {
    localId: localFieldId(),
    type: [0, 1, 2, 3].includes(type) ? type : 0,
    name: String(field.name ?? ''),
    value: type === FIELD_TYPE_BOOLEAN
      ? String(field.value ?? '').toLowerCase() === 'true'
      : String(field.value ?? ''),
    linkedId: field.linkedId === null || field.linkedId === undefined
      ? null
      : Number(field.linkedId),
  }
}

function normalizeLoginUri(entry = {}) {
  const rawMatch =
    entry.match
    ?? entry.Match
    ?? null

  const numericMatch = rawMatch === null || rawMatch === ''
    ? null
    : Number(rawMatch)

  return {
    uri: String(
      entry.uri
      ?? entry.Uri
      ?? '',
    ),
    match: [0, 1, 2, 3, 4, 5].includes(numericMatch)
      ? numericMatch
      : null,
    advanced: numericMatch !== null,
  }
}

const initialOrganizationId =
  props.transferOrganizationId
  || props.item?.organizationId
  || props.defaultOrganizationId
  || ''

const initialCollectionIds =
  props.transferCollectionId
    ? [props.transferCollectionId]
    : (
      props.item
        ? [...(props.item.collectionIds ?? [])]
        : (
          initialOrganizationId
              && props.defaultCollectionId
            ? [props.defaultCollectionId]
            : []
        )
    )

const form = reactive({
  name: props.item?.name ?? '',
  organizationId: initialOrganizationId,
  collectionIds: [...initialCollectionIds],
  folderId: props.item?.folderId ?? '',
  favorite: Boolean(props.item?.favorite),
  reprompt: Number(
    props.item?.reprompt
    ?? props.item?.Reprompt
    ?? 0,
  ) || 0,
  username: props.item?.login?.username ?? '',

  /*
   * Das vorhandene Passwort bleibt ausschließlich in props.item
   * und wird nicht an ein sichtbares Formularfeld gebunden.
   */
  password: passwordRestricted.value
    ? ''
    : (props.item?.login?.password ?? ''),

  uris: (
    props.item?.login?.uris?.length
      ? props.item.login.uris
      : [{}]
  ).map(normalizeLoginUri),
  totp: passwordRestricted.value
    ? ''
    : (props.item?.login?.totp ?? ''),
  passkeys: (
    props.item?.login?.fido2Credentials
    ?? []
  ).map(credential => ({
    ...credential,
  })),
  notes: props.item?.notes ?? '',
  cardholderName: props.item?.card?.cardholderName ?? '',
  cardBrand: props.item?.card?.brand ?? '',
  cardNumber: props.item?.card?.number ?? '',
  expMonth: props.item?.card?.expMonth ?? '',
  expYear: props.item?.card?.expYear ?? '',
  cvv: props.item?.card?.code ?? '',
  title: props.item?.identity?.title ?? '',
  firstName: props.item?.identity?.firstName ?? '',
  middleName: props.item?.identity?.middleName ?? '',
  lastName: props.item?.identity?.lastName ?? '',
  idUsername: props.item?.identity?.username ?? '',
  idEmail: props.item?.identity?.email ?? '',
  phone: props.item?.identity?.phone ?? '',
  address: props.item?.identity?.address1 ?? '',
  address2: props.item?.identity?.address2 ?? '',
  address3: props.item?.identity?.address3 ?? '',
  city: props.item?.identity?.city ?? '',
  state: props.item?.identity?.state ?? '',
  postalCode: props.item?.identity?.postalCode ?? '',
  country: props.item?.identity?.country ?? '',
  ssn: props.item?.identity?.ssn ?? '',
  passportNumber: props.item?.identity?.passportNumber ?? '',
  licenseNumber: props.item?.identity?.licenseNumber ?? '',
  company: props.item?.identity?.company ?? '',
  sshPrivateKey: props.item?.sshKey?.privateKey ?? '',
  sshPublicKey: props.item?.sshKey?.publicKey ?? '',
  sshFingerprint: props.item?.sshKey?.keyFingerprint ?? '',
  fields: (props.item?.fields ?? []).map(normalizeCustomField),
})

/*
 * Snapshot aller bereits vorhandenen verborgenen Felder.
 * Die localId bleibt auch bei einer Sortierung erhalten.
 */
const protectedHiddenFieldSnapshots = new Map(
  passwordRestricted.value
    ? form.fields
      .filter(field =>
        Number(field.type) === FIELD_TYPE_HIDDEN,
      )
      .map(field => [
        field.localId,
        JSON.stringify({
          type: Number(field.type),
          name: String(field.name ?? ''),
          value: String(field.value ?? ''),
          linkedId: field.linkedId ?? null,
        }),
      ])
    : [],
)

const visibleLoginUris = computed(() => (
  props.advancedMode
    ? form.uris
    : form.uris.slice(0, 1)
))

const attachmentItem = computed(() => ({
  ...(props.item ?? {}),
  attachments: formAttachments.value,
}))

function handleAttachmentsChanged(payload) {
  formAttachments.value = [
    ...(payload?.attachments ?? []),
  ]

  emit('attachments-changed', payload)
}

function addLoginUri() {
  form.uris.push(
    normalizeLoginUri(),
  )
}

function removeLoginUri(index) {
  if (form.uris.length <= 1) {
    form.uris[0] = normalizeLoginUri()
    return
  }

  form.uris.splice(index, 1)
}

const currentPasswordStrength = computed(() => {
  const password = String(form.password ?? '')
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

const formPasswordAgeLabel = computed(() => {
  if (!isEdit.value) {
    return t(
      'nc_bitwarden',
      'Set when the item is saved',
    )
  }

  if (
    String(form.password ?? '')
      !== String(props.item?.login?.password ?? '')
  ) {
    return t(
      'nc_bitwarden',
      'Updated when the item is saved',
    )
  }

  const revisionDate =
    props.item?.login?.passwordRevisionDate
    ?? props.item?.passwordRevisionDate
    ?? props.item?.creationDate
    ?? props.item?.revisionDate
    ?? ''

  const timestamp = Date.parse(revisionDate)

  if (Number.isNaN(timestamp)) {
    return t('nc_bitwarden', 'Unknown')
  }

  const days = Math.max(
    0,
    Math.floor(
      (Date.now() - timestamp) / 86400000,
    ),
  )

  return days === 0
    ? t('nc_bitwarden', 'Changed today')
    : t(
      'nc_bitwarden',
      '{count} days',
      { count: days },
    )
})

const fieldEditor = reactive({
  open: false,
  index: null,
  type: FIELD_TYPE_TEXT,
  name: '',
  value: '',
  booleanValue: false,
  linkedId: null,
})

let allowCloseWithoutPrompt = false

function serializedEditorState() {
  return {
    open: Boolean(fieldEditor.open),
    index: fieldEditor.index,
    type: Number(fieldEditor.type),
    name: String(fieldEditor.name ?? ''),
    value: String(fieldEditor.value ?? ''),
    booleanValue: Boolean(fieldEditor.booleanValue),
    linkedId: fieldEditor.linkedId === null
      ? null
      : Number(fieldEditor.linkedId),
  }
}

function serializedFormState() {
  return JSON.stringify({
    selectedType: Number(selectedType.value),
    form: {
      ...form,
      collectionIds: [...form.collectionIds],
      uris: form.uris.map(loginUri => ({
        uri: String(loginUri.uri ?? ''),
        match: loginUri.match === null
          ? null
          : Number(loginUri.match),
      })),
      fields: form.fields.map(field => ({
        localId: field.localId,
        type: Number(field.type),
        name: String(field.name ?? ''),
        value:
          passwordRestricted.value
            && Number(field.type) === FIELD_TYPE_HIDDEN
            ? '__protected_hidden_field__'
            : (
              field.type === FIELD_TYPE_BOOLEAN
                ? Boolean(field.value)
                : String(field.value ?? '')
            ),
        linkedId: field.linkedId === null
          ? null
          : Number(field.linkedId),
      })),
    },
    fieldEditor: serializedEditorState(),
  })
}

const initialFormState = serializedFormState()
const hasUnsavedChanges = computed(() =>
  serializedFormState() !== initialFormState,
)

const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
const typeOptions = [
  { id: 1, label: t('nc_bitwarden', 'Login'), icon: KeyOutlineIcon },
  { id: 2, label: t('nc_bitwarden', 'Secure note'), icon: NoteTextOutlineIcon },
  { id: 3, label: t('nc_bitwarden', 'Card'), icon: CreditCardOutlineIcon },
  { id: 4, label: t('nc_bitwarden', 'Identity'), icon: IdentityOutlineIcon },
  { id: 5, label: t('nc_bitwarden', 'SSH key'), icon: KeyOutlineIcon },
]

const visibleTypeOptions = computed(() => {
  if (props.advancedMode) {
    return typeOptions
  }

  if (isEdit.value) {
    return typeOptions.filter(
      option =>
        option.id === Number(selectedType.value),
    )
  }

  const visibleIds = new Set([
    1,
    2,
    Number(selectedType.value),
  ])

  return typeOptions.filter(
    option => visibleIds.has(option.id),
  )
})

const linkedFieldsByType = {
  1: [
    [100, t('nc_bitwarden', 'Username')], [101, t('nc_bitwarden', 'Password')],
  ],
  3: [
    [300, t('nc_bitwarden', 'Cardholder')], [301, t('nc_bitwarden', 'Expiration month')], [302, t('nc_bitwarden', 'Expiration year')],
    [303, t('nc_bitwarden', 'CVV')], [304, t('nc_bitwarden', 'Card brand')], [305, t('nc_bitwarden', 'Card number')],
  ],
  4: [
    [400, t('nc_bitwarden', 'Title')], [401, t('nc_bitwarden', 'Middle name')], [402, t('nc_bitwarden', 'Address line 1')],
    [403, t('nc_bitwarden', 'Address line 2')], [404, t('nc_bitwarden', 'Address line 3')], [405, t('nc_bitwarden', 'City')],
    [406, t('nc_bitwarden', 'State / region')], [407, t('nc_bitwarden', 'Postal code')], [408, t('nc_bitwarden', 'Country')],
    [409, t('nc_bitwarden', 'Company')], [410, t('nc_bitwarden', 'Email')], [411, t('nc_bitwarden', 'Phone')],
    [412, t('nc_bitwarden', 'Social security number')], [413, t('nc_bitwarden', 'Username')],
    [414, t('nc_bitwarden', 'Passport number')], [415, t('nc_bitwarden', 'License number')],
    [416, t('nc_bitwarden', 'First name')], [417, t('nc_bitwarden', 'Last name')], [418, t('nc_bitwarden', 'Full name')],
  ],
}

const linkedFieldOptions = computed(() =>
  (linkedFieldsByType[selectedType.value] ?? []).map(([value, label]) => ({
    value,
    label,
  })),
)

const customFieldTypeOptions = computed(() => {
  const options = [
    { value: FIELD_TYPE_TEXT, label: t('nc_bitwarden', 'Text') },
    { value: FIELD_TYPE_HIDDEN, label: t('nc_bitwarden', 'Hidden') },
    { value: FIELD_TYPE_BOOLEAN, label: t('nc_bitwarden', 'Boolean') },
  ]
  if (linkedFieldOptions.value.length) {
    options.push({ value: FIELD_TYPE_LINKED, label: t('nc_bitwarden', 'Linked') })
  }
  return options
})

const validLinkedIds = computed(() => new Set(linkedFieldOptions.value.map(option => option.value)))
const invalidLinkedFieldCount = computed(() => form.fields.filter(field => (
  field.type === FIELD_TYPE_LINKED && !validLinkedIds.value.has(Number(field.linkedId))
)).length)

const canApplyCustomField = computed(() => (
  fieldEditor.name.trim().length > 0
  && (
    fieldEditor.type !== FIELD_TYPE_LINKED
    || validLinkedIds.value.has(Number(fieldEditor.linkedId))
  )
))

const sortedFolders = computed(() => [...props.folders].sort((a, b) => nameCollator.compare(a.name ?? '', b.name ?? '')))
const organizationOptions = computed(() => props.organizations.filter(organization => {
  const id = normalizeId(organization.id)
  return id === normalizeId(form.organizationId) || props.collections.some(collection => normalizeId(collection.organizationId) === id && !collection.readOnly)
}).sort((a, b) => nameCollator.compare(a.name ?? '', b.name ?? '')))
const availableCollections = computed(() => props.collections.filter(collection => normalizeId(collection.organizationId) === normalizeId(form.organizationId)).filter(collection => !collection.readOnly || collectionIsSelected(collection.id)).sort((a, b) => nameCollator.compare(a.name ?? '', b.name ?? '')))
const selectedCollections = computed(() => availableCollections.value.filter(collection => collectionIsSelected(collection.id)))
const collectionResults = computed(() => availableCollections.value.filter(collection => !collectionIsSelected(collection.id)).filter(collection => !collection.readOnly).filter(collection => collectionMatchesQuery(collection, collectionSearch.value)))

const canSave = computed(() => {
  if (props.item?.decryptionFailed) return false
  if (!form.name.trim() || fieldEditor.open || invalidLinkedFieldCount.value > 0) return false
  if (form.organizationId && targetCollectionIds().length === 0) return false
  if (selectedType.value === 5) {
    return Boolean(form.sshPrivateKey.trim() && form.sshPublicKey.trim() && form.sshFingerprint.trim() && getEncryptionKey())
  }
  return Boolean(getEncryptionKey())
})

// Clear assignments when the item owner changes.
watch(
  () => form.organizationId,
  (nextOrganizationId, previousOrganizationId) => {
    if (
      normalizeId(nextOrganizationId)
        === normalizeId(previousOrganizationId)
    ) {
      return
    }

    form.collectionIds = []
    collectionSearch.value = ''

    if (nextOrganizationId) {
      form.folderId = ''
    }
  },
)

function tabHasIssue(tabId) {
  return tabId === 'fields'
    && invalidLinkedFieldCount.value > 0
}

function requestClose() {
  if (
    !allowCloseWithoutPrompt
    && hasUnsavedChanges.value
    && !confirm(
      t(
        'nc_bitwarden',
        'Discard unsaved changes?',
      ),
    )
  ) {
    return
  }

  allowCloseWithoutPrompt = true
  emit('close')
}

function handleBeforeUnload(event) {
  if (
    allowCloseWithoutPrompt
    || !hasUnsavedChanges.value
  ) {
    return
  }

  event.preventDefault()
  event.returnValue = ''
}

function handleKeydown(event) {
  if (
    (event.ctrlKey || event.metaKey)
    && event.key.toLowerCase() === 's'
  ) {
    event.preventDefault()

    if (canSave.value && !saving.value) {
      save()
    }
  }
}

onMounted(() => {
  window.addEventListener(
    'beforeunload',
    handleBeforeUnload,
  )
  window.addEventListener(
    'keydown',
    handleKeydown,
  )
})

onBeforeUnmount(() => {
  window.removeEventListener(
    'beforeunload',
    handleBeforeUnload,
  )
  window.removeEventListener(
    'keydown',
    handleKeydown,
  )
})

watch(selectedType, () => {
  if (fieldEditor.type === FIELD_TYPE_LINKED && !linkedFieldOptions.value.length) {
    cancelCustomFieldEditor()
  }
})

function normalizeId(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim().toLowerCase()
}
function collectionParts(collection) { return collectionNameParts(collection) }
function collectionIsSelected(collectionId) {
  const id = normalizeId(collectionId)
  return form.collectionIds.some(selectedId => normalizeId(selectedId) === id)
}
function getOrganizationKey(organizationId) {
  if (!organizationId) return null
  if (props.organizationKeys[organizationId]) return props.organizationKeys[organizationId]
  return Object.entries(props.organizationKeys).find(([id]) => normalizeId(id) === normalizeId(organizationId))?.[1] ?? null
}
function originalOrganizationId() {
  return props.item?.organizationId ?? props.item?.OrganizationId ?? props.item?.organizationID ?? props.item?.OrganizationID ?? null
}
function effectiveOrganizationId() {
  return form.organizationId || null
}
function getEncryptionKey() {
  const organizationId = effectiveOrganizationId()
  return organizationId ? getOrganizationKey(organizationId) : props.userKey
}
function encrypt(value, key) { return encryptString(value, key.encKey, key.macKey) }

function customFieldTypeLabel(type) {
  return {
    [FIELD_TYPE_TEXT]: t('nc_bitwarden', 'Text'),
    [FIELD_TYPE_HIDDEN]: t('nc_bitwarden', 'Hidden'),
    [FIELD_TYPE_BOOLEAN]: t('nc_bitwarden', 'Boolean'),
    [FIELD_TYPE_LINKED]: t('nc_bitwarden', 'Linked'),
  }[Number(type)] ?? t('nc_bitwarden', 'Text')
}
function linkedFieldLabel(linkedId) {
  return linkedFieldOptions.value.find(option => option.value === Number(linkedId))?.label
    ?? t('nc_bitwarden', 'Unavailable linked field')
}
function customFieldIsProtected(field) {
  return (
    passwordRestricted.value
    && Number(field?.type) === FIELD_TYPE_HIDDEN
  )
}

function protectedHiddenFieldsPreserved() {
  if (!passwordRestricted.value) {
    return true
  }

  const currentFields = new Map(
    form.fields.map(field => [
      field.localId,
      field,
    ]),
  )

  const existingFieldsUnchanged =
    [...protectedHiddenFieldSnapshots.entries()]
      .every(([localId, snapshot]) => {
        const field = currentFields.get(localId)

        if (!field) {
          return false
        }

        return JSON.stringify({
          type: Number(field.type),
          name: String(field.name ?? ''),
          value: String(field.value ?? ''),
          linkedId: field.linkedId ?? null,
        }) === snapshot
      })

  const noNewHiddenFields =
    form.fields.every(field =>
      Number(field.type) !== FIELD_TYPE_HIDDEN
        || protectedHiddenFieldSnapshots.has(
          field.localId,
        ),
    )

  return (
    existingFieldsUnchanged
    && noNewHiddenFields
  )
}

function customFieldPreview(field) {
  if (field.type === FIELD_TYPE_HIDDEN) return '••••••••'
  if (field.type === FIELD_TYPE_BOOLEAN) return field.value ? t('nc_bitwarden', 'Yes') : t('nc_bitwarden', 'No')
  if (field.type === FIELD_TYPE_LINKED) return linkedFieldLabel(field.linkedId)
  return String(field.value ?? '') || t('nc_bitwarden', '(empty)')
}
function resetFieldEditor() {
  Object.assign(fieldEditor, { open: false, index: null, type: FIELD_TYPE_TEXT, name: '', value: '', booleanValue: false, linkedId: null })
}
function openCustomFieldEditor() { resetFieldEditor(); fieldEditor.open = true }
function editCustomField(index) {
  const field = form.fields[index]

  if (customFieldIsProtected(field)) {
    return
  }

  Object.assign(fieldEditor, {
    open: true,
    index,
    type: Number(field.type),
    name: field.name,
    value: field.type === FIELD_TYPE_BOOLEAN ? '' : String(field.value ?? ''),
    booleanValue: field.type === FIELD_TYPE_BOOLEAN ? Boolean(field.value) : false,
    linkedId: field.linkedId,
  })
}
function cancelCustomFieldEditor() { resetFieldEditor() }
function applyCustomField() {
  const currentField =
    fieldEditor.index === null
      ? null
      : form.fields[fieldEditor.index]

  if (
    passwordRestricted.value
    && (
      Number(fieldEditor.type)
        === FIELD_TYPE_HIDDEN
      || customFieldIsProtected(currentField)
    )
  ) {
    return
  }

  if (!canApplyCustomField.value) return

  const field = {
    localId: fieldEditor.index === null ? localFieldId() : form.fields[fieldEditor.index].localId,
    type: Number(fieldEditor.type),
    name: fieldEditor.name.trim(),
    value: fieldEditor.type === FIELD_TYPE_BOOLEAN ? Boolean(fieldEditor.booleanValue) : String(fieldEditor.value ?? ''),
    linkedId: fieldEditor.type === FIELD_TYPE_LINKED ? Number(fieldEditor.linkedId) : null,
  }
  if (fieldEditor.index === null) form.fields.push(field)
  else form.fields.splice(fieldEditor.index, 1, field)
  resetFieldEditor()
}
function removeCustomField(index) {
  if (
    customFieldIsProtected(
      form.fields[index],
    )
  ) {
    return
  }

  form.fields.splice(index, 1)

  if (fieldEditor.open) {
    resetFieldEditor()
  }
}
function moveCustomField(index, offset) {
  const target = index + offset
  if (target < 0 || target >= form.fields.length) return
  const [field] = form.fields.splice(index, 1)
  form.fields.splice(target, 0, field)
}

async function encryptedCustomFields(key) {
  return Promise.all(form.fields.map(async field => ({
    type: Number(field.type),
    name: await encrypt(field.name.trim(), key),
    value: field.type === FIELD_TYPE_LINKED
      ? null
      : await encrypt(
        field.type === FIELD_TYPE_BOOLEAN
          ? (field.value ? 'true' : 'false')
          : String(field.value ?? ''),
        key,
      ),
    linkedId: field.type === FIELD_TYPE_LINKED ? Number(field.linkedId) : null,
  })))
}

function removePasskey(index) {
  const credential = form.passkeys[index]

  const name =
    credential?.rpName
    || credential?.rpId
    || 'Passkey'

  if (
    !window.confirm(
      t(
        'nc_bitwarden',
        'Remove passkey {name} from this item?',
        { name },
      ),
    )
  ) {
    return
  }

  form.passkeys.splice(index, 1)
}

async function encryptedPasskeys(key) {
  return Promise.all(
    form.passkeys.map(async credential => {
      const encryptedValue = async (
        value,
        fallback = '',
      ) => {
        const normalized =
          value === null || value === undefined
            ? fallback
            : String(value)

        return normalized
          ? encrypt(normalized, key)
          : null
      }

      const discoverable =
        typeof credential.discoverable === 'boolean'
          ? String(credential.discoverable)
          : String(
            credential.discoverable
              ?? 'false',
          )

      return {
        credentialId: await encryptedValue(
          credential.credentialId,
        ),
        keyType: await encryptedValue(
          credential.keyType,
          'public-key',
        ),
        keyAlgorithm: await encryptedValue(
          credential.keyAlgorithm,
        ),
        keyCurve: await encryptedValue(
          credential.keyCurve,
        ),
        keyValue: await encryptedValue(
          credential.keyValue,
        ),
        rpId: await encryptedValue(
          credential.rpId,
        ),
        rpName: await encryptedValue(
          credential.rpName,
        ),
        userHandle: await encryptedValue(
          credential.userHandle,
        ),
        userName: await encryptedValue(
          credential.userName,
        ),
        userDisplayName: await encryptedValue(
          credential.userDisplayName,
        ),
        counter: await encryptedValue(
          credential.counter,
          '0',
        ),
        discoverable: await encryptedValue(
          discoverable,
          'false',
        ),
        creationDate:
          credential.creationDate
          ?? new Date().toISOString(),
      }
    }),
  )
}

async function buildPayload() {
  const encryptionKey = getEncryptionKey()
  if (!encryptionKey) throw new Error(t('nc_bitwarden', 'The required encryption key is not available.'))
  const payload = {
    type: Number(selectedType.value),
    name: await encrypt(form.name.trim(), encryptionKey),
    notes: form.notes ? await encrypt(form.notes, encryptionKey) : null,
    favorite: Boolean(form.favorite),
    folderId: effectiveOrganizationId() ? null : (form.folderId || null),
    fields: await encryptedCustomFields(encryptionKey),
    reprompt: Number(form.reprompt) || 0,
  }

  // Der Payload wird immer mit dem ausgewählten Zielbesitzer
  // und dessen Schlüssel erzeugt.
  payload.organizationId = effectiveOrganizationId()

  /*
   * Optimistische Versionskontrolle:
   *
   * Vaultwarden vergleicht lastKnownRevisionDate mit der
   * aktuellen Serverrevision. Wurde der Eintrag zwischenzeitlich
   * durch einen anderen Client geändert, wird das Update abgelehnt,
   * statt die neuere Version unbemerkt zu überschreiben.
   */
  if (isEdit.value) {
    const lastKnownRevisionDate = String(
      props.item?.revisionDate
      ?? props.item?.RevisionDate
      ?? '',
    ).trim()

    if (
      !lastKnownRevisionDate
      || Number.isNaN(
        Date.parse(lastKnownRevisionDate),
      )
    ) {
      console.error(
        '[nc_bitwarden] Valid revision date missing '
          + 'for existing cipher:',
        props.item?.id,
      )

      throw new Error(
        t(
          'nc_bitwarden',
          'The item could not be saved.',
        ),
      )
    }

    payload.lastKnownRevisionDate =
      lastKnownRevisionDate
  }

  if (selectedType.value === 1) {
    // Datum der letzten Passwortänderung erhalten.
    const originalPassword = String(
      props.item?.login?.password ?? '',
    )

    const currentPassword =
      passwordRestricted.value
        ? originalPassword
        : String(
          form.password ?? '',
        )

    const passwordChanged =
      passwordRestricted.value
        ? false
        : (
          !isEdit.value
          || currentPassword !== originalPassword
        )

    const passwordRevisionDate = passwordChanged
      ? new Date().toISOString()
      : (
        props.item?.login?.passwordRevisionDate
          ?? props.item?.login?.PasswordRevisionDate
          ?? props.item?.passwordRevisionDate
          ?? props.item?.PasswordRevisionDate
          ?? props.item?.creationDate
          ?? props.item?.CreationDate
          ?? props.item?.revisionDate
          ?? props.item?.RevisionDate
          ?? new Date().toISOString()
      )

    const existingPasswordHistory = (
      isEdit.value
      && Array.isArray(
        props.item?.passwordHistory,
      )
    )
      ? props.item.passwordHistory
        .map(entry => ({
          password: String(
            entry?.password
              ?? entry?.Password
              ?? '',
          ),
          lastUsedDate:
              entry?.lastUsedDate
              ?? entry?.LastUsedDate
              ?? null,
        }))
        .filter(entry => entry.password)
      : []

    const nextPasswordHistory = (
      passwordChanged
      && isEdit.value
      && originalPassword
        ? [
          {
            password: originalPassword,
            lastUsedDate:
                new Date().toISOString(),
          },
          ...existingPasswordHistory,
        ]
        : existingPasswordHistory
    ).slice(0, 5)

    payload.passwordHistory =
      await Promise.all(
        nextPasswordHistory.map(
          async entry => ({
            password: await encrypt(
              entry.password,
              encryptionKey,
            ),
            lastUsedDate:
              entry.lastUsedDate
              ?? new Date().toISOString(),
          }),
        ),
      )

    /*
     * Bei ausgeblendeten Passwörtern gehört auch der TOTP-Seed
     * zu den geschützten Daten. Er darf weder in einem Editor
     * erscheinen noch durch einen leeren Formularwert ersetzt
     * werden.
     */
    const effectiveTotp = passwordRestricted.value
      ? String(props.item?.login?.totp ?? '')
      : String(form.totp ?? '')

    payload.login = {
      username: form.username
        ? await encrypt(
          form.username,
          encryptionKey,
        )
        : null,

      password: currentPassword
        ? await encrypt(
          currentPassword,
          encryptionKey,
        )
        : null,

      totp: effectiveTotp
        ? await encrypt(
          effectiveTotp,
          encryptionKey,
        )
        : null,

      uris: await Promise.all(
        form.uris
          .map(normalizeLoginUri)
          .filter(loginUri =>
            loginUri.uri.trim().length > 0,
          )
          .map(async loginUri => ({
            uri: await encrypt(
              loginUri.uri.trim(),
              encryptionKey,
            ),
            match: loginUri.match,
          })),
      ),

      passwordRevisionDate,
      fido2Credentials:
        await encryptedPasskeys(
          encryptionKey,
        ),
    }
  } else if (selectedType.value === 2) {
    payload.secureNote = { type: 0 }
  } else if (selectedType.value === 3) {
    payload.card = {
      cardholderName: form.cardholderName ? await encrypt(form.cardholderName, encryptionKey) : null,
      brand: form.cardBrand ? await encrypt(form.cardBrand, encryptionKey) : null,
      number: form.cardNumber ? await encrypt(form.cardNumber, encryptionKey) : null,
      expMonth: form.expMonth ? await encrypt(form.expMonth, encryptionKey) : null,
      expYear: form.expYear ? await encrypt(form.expYear, encryptionKey) : null,
      code: form.cvv ? await encrypt(form.cvv, encryptionKey) : null,
    }
  } else if (selectedType.value === 4) {
    payload.identity = {
      title: form.title ? await encrypt(form.title, encryptionKey) : null,
      firstName: form.firstName ? await encrypt(form.firstName, encryptionKey) : null,
      middleName: form.middleName ? await encrypt(form.middleName, encryptionKey) : null,
      lastName: form.lastName ? await encrypt(form.lastName, encryptionKey) : null,
      username: form.idUsername ? await encrypt(form.idUsername, encryptionKey) : null,
      company: form.company ? await encrypt(form.company, encryptionKey) : null,
      email: form.idEmail ? await encrypt(form.idEmail, encryptionKey) : null,
      phone: form.phone ? await encrypt(form.phone, encryptionKey) : null,
      address1: form.address ? await encrypt(form.address, encryptionKey) : null,
      address2: form.address2 ? await encrypt(form.address2, encryptionKey) : null,
      address3: form.address3 ? await encrypt(form.address3, encryptionKey) : null,
      city: form.city ? await encrypt(form.city, encryptionKey) : null,
      state: form.state ? await encrypt(form.state, encryptionKey) : null,
      postalCode: form.postalCode ? await encrypt(form.postalCode, encryptionKey) : null,
      country: form.country ? await encrypt(form.country, encryptionKey) : null,
      ssn: form.ssn ? await encrypt(form.ssn, encryptionKey) : null,
      passportNumber: form.passportNumber ? await encrypt(form.passportNumber, encryptionKey) : null,
      licenseNumber: form.licenseNumber ? await encrypt(form.licenseNumber, encryptionKey) : null,
    }
  } else if (selectedType.value === 5) {
    payload.sshKey = {
      privateKey: await encrypt(form.sshPrivateKey.trim(), encryptionKey),
      publicKey: await encrypt(form.sshPublicKey.trim(), encryptionKey),
      keyFingerprint: await encrypt(form.sshFingerprint.trim(), encryptionKey),
    }
  }
  return payload
}

function normalizedIdList(values) { return [...new Set((values ?? []).map(normalizeId).filter(Boolean))].sort() }
function collectionSelectionChanged() { return JSON.stringify(normalizedIdList(initialCollectionIds)) !== JSON.stringify(normalizedIdList(form.collectionIds)) }

function targetCollectionIds() {
  const organizationId = normalizeId(
    effectiveOrganizationId(),
  )

  if (!organizationId) {
    return []
  }

  const allowedIds = new Set(
    availableCollections.value
      .map(collection => normalizeId(collection.id))
      .filter(Boolean),
  )

  return [...new Set(
    form.collectionIds.filter(collectionId =>
      allowedIds.has(normalizeId(collectionId)),
    ),
  )]
}

function ownerChanged() {
  return (
    normalizeId(originalOrganizationId())
      !== normalizeId(effectiveOrganizationId())
  )
}
function toPascal(value) {
  if (Array.isArray(value)) return value.map(toPascal)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, itemValue]) => [key.charAt(0).toUpperCase() + key.slice(1), toPascal(itemValue)]))
  }
  return value
}

onMounted(() => {
  if (!props.autoSave) {
    return
  }

  /*
   * Das Formular ist zu diesem Zeitpunkt vollständig initialisiert.
   * Es wird derselbe Speichervorgang wie beim manuellen
   * Besitzerwechsel ausgelöst.
   */
  window.setTimeout(() => {
    save()
  }, 0)
})

function arrayEntryCount(value) {
  return Array.isArray(value)
    ? value.length
    : 0
}

function uriMatchRuleCount(uris) {
  if (!Array.isArray(uris)) {
    return 0
  }

  return uris.filter(uri => (
    uri?.match !== null
    && uri?.match !== undefined
  )).length
}

function hiddenAdvancedDataLossRisks(payload) {
  if (
    props.advancedMode
    || !isEdit.value
    || !props.item
  ) {
    return []
  }

  const risks = []

  if (
    arrayEntryCount(payload.fields)
      < arrayEntryCount(props.item.fields)
  ) {
    risks.push(
      t(
        'nc_bitwarden',
        'custom fields',
      ),
    )
  }

  if (
    arrayEntryCount(payload.login?.uris)
      < arrayEntryCount(
        props.item.login?.uris,
      )
  ) {
    risks.push(
      t(
        'nc_bitwarden',
        'URLs',
      ),
    )
  }

  if (
    uriMatchRuleCount(payload.login?.uris)
      < uriMatchRuleCount(
        props.item.login?.uris,
      )
  ) {
    risks.push(
      t(
        'nc_bitwarden',
        'URI match rules',
      ),
    )
  }

  if (
    arrayEntryCount(
      payload.login?.fido2Credentials,
    )
      < arrayEntryCount(
        props.item.login?.fido2Credentials,
      )
  ) {
    risks.push(
      t(
        'nc_bitwarden',
        'passkeys',
      ),
    )
  }

  const expectedPasswordHistoryCount =
    Math.min(
      arrayEntryCount(
        props.item.passwordHistory,
      ),
      5,
    )

  if (
    arrayEntryCount(payload.passwordHistory)
      < expectedPasswordHistoryCount
  ) {
    risks.push(
      t(
        'nc_bitwarden',
        'password history',
      ),
    )
  }

  return risks
}

function assertStandardModeDataPreserved(payload) {
  const risks =
    hiddenAdvancedDataLossRisks(payload)

  if (!risks.length) {
    return
  }

  throw new Error(
    t(
      'nc_bitwarden',
      'Saving was stopped because hidden advanced data would be lost: {data}.',
      {
        data: risks.join(', '),
      },
    ),
  )
}

function exceptionSearchText(exception) {
  const values = [
    exception?.response?.data?.message,
    exception?.response?.data?.error,
    exception?.message,
  ]

  try {
    values.push(
      JSON.stringify(
        exception?.response?.data ?? {},
      ),
    )
  } catch {
    // Nicht serialisierbare Fehlerdaten werden ignoriert.
  }

  return values
    .filter(value => typeof value === 'string')
    .join('\n')
    .toLowerCase()
}

function isCipherRevisionConflict(exception) {
  const message = exceptionSearchText(exception)

  return (
    message.includes(
      'client copy of this cipher is out of date',
    )
    || message.includes(
      'organization mismatch. please resync',
    )
  )
}

function itemSaveErrorMessage(exception) {
  if (isCipherRevisionConflict(exception)) {
    return t(
      'nc_bitwarden',
      'The item was changed in another client. Your changes were not saved. Reload the vault and open the item again.',
    )
  }

  return (
    exception?.response?.data?.message
    || exception?.response?.data?.error
    || exception?.message
    || t(
      'nc_bitwarden',
      'The item could not be saved.',
    )
  )
}

async function save() {
  if (props.item?.decryptionFailed) {
    error.value = t(
      'nc_bitwarden',
      'This item could not be decrypted completely and cannot be saved.',
    )
    return
  }

  /*
   * Stufe 2O-2: schreibgeschützte Einträge dürfen auch dann
   * nicht gespeichert werden, wenn save() künstlich ausgelöst
   * oder das Formular über ein fremdes Ereignis geöffnet wurde.
   */
  if (
    isEdit.value
    && props.item?.edit === false
  ) {
    error.value = t(
      'nc_bitwarden',
      'The item could not be saved.',
    )
    return
  }

  if (passwordRestricted.value) {
    if (
      ownerChanged()
      || collectionSelectionChanged()
    ) {
      error.value = t(
        'nc_bitwarden',
        'The vault or collection assignment cannot be changed because password access is restricted for this item.',
      )
      return
    }

    if (!protectedHiddenFieldsPreserved()) {
      error.value = t(
        'nc_bitwarden',
        'Password access is restricted for this item. The password and hidden fields remain unchanged.',
      )
      return
    }
  }

  if (saving.value || !canSave.value) return
  saving.value = true
  error.value = ''
  try {
    const payload = await buildPayload()

    assertStandardModeDataPreserved(payload)

    let raw
    const collectionIds = targetCollectionIds()

    if (isEdit.value && !ownerChanged()) {
      raw = await VaultwardenApi.updateCipher(
        props.item.id,
        payload,
      )

      if (
        effectiveOrganizationId()
        && collectionSelectionChanged()
      ) {
        await VaultwardenApi.updateCipherCollections(
          props.item.id,
          collectionIds,
        )
      }
    } else if (isEdit.value && ownerChanged()) {
      const sourceIsPersonal =
        !normalizeId(originalOrganizationId())

      const targetIsOrganization =
        Boolean(
          normalizeId(
            effectiveOrganizationId(),
          ),
        )

      const attachments =
        formAttachments.value

      if (
        sourceIsPersonal
        && targetIsOrganization
        && attachments.length === 0
      ) {
        // Ohne Anhänge kann Vaultwardens Share-Endpunkt
        // den persönlichen Eintrag direkt übertragen.
        raw = await VaultwardenApi.shareCipher(
          props.item.id,
          {
            cipher: payload,
            collectionIds,
          },
        )
      } else {
        /*
         * Bei Anhängen sowie bei Organisation -> Persönlich
         * oder Organisation -> Organisation wird zuerst ein
         * vollständig neu verschlüsselter Ziel-Cipher erzeugt.
         *
         * Das Original bleibt erhalten, bis alle Anhänge
         * erfolgreich kopiert wurden.
         */
        raw =
          await VaultwardenApi.createOrganizationCipher({
            cipher: payload,
            collectionIds,
          })

        const createdId =
          raw?.id
          ?? raw?.Id
          ?? null

        if (!createdId) {
          throw new Error(
            'Vaultwarden hat für den Ziel-Eintrag '
              + 'keine ID zurückgegeben.',
          )
        }

        try {
          await copyCipherAttachments(
            {
              ...props.item,
              attachments,
            },
            createdId,
            getEncryptionKey(),
          )

          await VaultwardenApi.deleteCipher(
            props.item.id,
          )
        } catch (transferException) {
          /*
           * Rollback: Der alte Eintrag ist zu diesem Zeitpunkt
           * noch vollständig vorhanden. Der unvollständige
           * Ziel-Eintrag wird einschließlich seiner Anhänge
           * wieder entfernt.
           */
          try {
            await VaultwardenApi.deleteCipher(
              createdId,
            )
          } catch (rollbackException) {
            console.error(
              '[nc_bitwarden] Owner-change rollback failed:',
              rollbackException,
            )
          }

          throw transferException
        }
      }
    } else if (effectiveOrganizationId()) {
      raw = await VaultwardenApi.createOrganizationCipher({
        cipher: payload,
        collectionIds,
      })
    } else {
      raw = await VaultwardenApi.createCipher(payload)
    }
    const decrypted = await decryptCipher(toPascal(raw), props.userKey, props.organizationKeys)
    allowCloseWithoutPrompt = true
    emit('saved', { item: decrypted, created: !isEdit.value })
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Item could not be saved:',
      exception,
    )
    error.value = itemSaveErrorMessage(exception)

    if (props.autoSave) {
      emit('auto-save-failed', exception)
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bw-form {
  display: flex;
  width: min(840px, 82vw);
  max-width: 100%;
  height: min(72vh, 760px);
  max-height: calc(100vh - 180px);
  flex-direction: column;
  overflow: hidden;
}

.bw-form__sticky-header {
  z-index: 2;
  flex: 0 0 auto;
  padding: 0.25rem 0.25rem 0.85rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-main-background);
}

.bw-form__header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.bw-form__type-field {
  min-width: 0;
  flex: 1;
  margin-bottom: 0;
}

.bw-form__changed-indicator {
  flex: 0 0 auto;
  margin-top: 0.1rem;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--color-warning);
  border-radius: 999px;
  color: var(--color-warning);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.bw-form__scroll-area {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.9rem 0.35rem 0.35rem;
  scrollbar-gutter: stable;
}

.bw-form__field {
  min-width: 0;
  margin-bottom: 0.75rem;
}

.bw-form__label {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.bw-form__type-option {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.bw-form__radio-group {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.45rem;
  overflow-x: auto;
  padding: 0.15rem 0 0.2rem;
  scrollbar-width: thin;
}

.bw-form__radio-group > * {
  flex: 0 0 auto;
}

.bw-form__tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(max-content, 1fr));
  overflow-x: auto;
  margin-top: 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
}

.bw-form__tabs button {
  position: relative;
  min-height: 42px;
  padding: 0.55rem 0.85rem;
  border: 0;
  border-right: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-maxcontrast);
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
}

.bw-form__tabs button:last-child {
  border-right: 0;
}

.bw-form__tabs button:hover,
.bw-form__tabs button:focus-visible {
  background: var(--color-background-hover);
  color: var(--color-main-text);
}

.bw-form__tabs .bw-form__tab--active {
  background: var(--color-primary-element-light);
  color: var(--color-primary-element);
  box-shadow: inset 0 -3px 0 var(--color-primary-element);
}

.bw-form__tabs .bw-form__tab--warning::after {
  position: absolute;
  top: 0.45rem;
  right: 0.5rem;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-warning);
  content: '';
}

.bw-form__tab-panel {
  min-height: 260px;
  animation: bw-form-tab-fade 120ms ease-out;
}

.bw-form__tab-panel--content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 0.85rem;
  align-content: start;
}

.bw-form__full-width,
.bw-form__tab-panel--content :deep(.bw-password-generator),
.bw-form__tab-panel--content :deep(.bw-ssh-generator) {
  min-width: 0;
  grid-column: 1 / -1;
}

.bw-form__select,
.bw-form__field-editor select {
  width: 100%;
  min-height: 38px;
  padding: 0.5rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-form__textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  resize: vertical;
}

.bw-form__collection-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-form__collection-search input {
  min-width: 0;
  flex: 1;
  padding: 0.15rem;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-main-text);
}

.bw-form__collection-search button {
  display: flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  cursor: pointer;
}

.bw-form__collection-search button:hover {
  background: var(--color-background-hover);
}

.bw-form__collection-summary {
  padding: 0.4rem 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
}

.bw-form__collections {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  scrollbar-gutter: stable;
}

.bw-form__collection-group h4 {
  position: sticky;
  z-index: 1;
  top: 0;
  margin: 0;
  padding: 0.45rem 0.6rem;
  background: var(--color-background-dark);
}

.bw-form__collection {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-top: 1px solid var(--color-border);
}

.bw-form__collection:hover {
  background: var(--color-background-hover);
}

.bw-form__collection-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.bw-form__collection-text small,
.bw-form__hint {
  color: var(--color-text-maxcontrast);
}

.bw-form__collection-empty,
.bw-form__empty-fields {
  margin: 0;
  padding: 1rem;
  color: var(--color-text-maxcontrast);
  text-align: center;
}

.bw-form__custom-fields {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 0.8rem;
}

.bw-form__custom-field {
  display: grid;
  min-width: 0;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-form__custom-field:hover,
.bw-form__custom-field--editing {
  border-color: var(--color-primary-element);
  background: var(--color-background-hover);
}

.bw-form__custom-field-grip {
  color: var(--color-text-maxcontrast);
  font-size: 1rem;
  letter-spacing: -0.25rem;
  user-select: none;
}

.bw-form__custom-field-summary {
  min-width: 0;
}

.bw-form__custom-field-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
}

.bw-form__custom-field-title strong,
.bw-form__custom-field-summary small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-form__custom-field-type {
  flex: 0 0 auto;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--color-background-dark);
  color: var(--color-text-maxcontrast);
  font-size: 0.72rem;
  font-weight: 600;
}

.bw-form__custom-field-summary small {
  display: block;
  margin-top: 0.2rem;
  color: var(--color-text-maxcontrast);
}

.bw-form__custom-field-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.25rem;
}

.bw-form__custom-field-actions button {
  display: inline-flex;
  width: 31px;
  height: 31px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
  font-size: 1rem;
}

.bw-form__custom-field-actions button:hover:not(:disabled),
.bw-form__custom-field-actions button:focus-visible:not(:disabled) {
  border-color: var(--color-border);
  background: var(--color-main-background);
  color: var(--color-primary-element);
}

.bw-form__custom-field-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.bw-form__custom-field-actions .bw-form__danger-button {
  color: var(--color-error);
}

.bw-form__field-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 0.85rem;
  margin-top: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--color-primary-element);
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
}

.bw-form__field-editor h4,
.bw-form__editor-actions {
  grid-column: 1 / -1;
}

.bw-form__field-editor h4 {
  margin: 0 0 0.85rem;
}

.bw-form__editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.bw-form__error {
  margin: 0.8rem 0 0;
  color: var(--color-error);
}

@keyframes bw-form-tab-fade {
  from {
    opacity: 0.65;
    transform: translateY(2px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 760px) {
  .bw-form {
    width: 100%;
    min-width: 0;
    height: calc(100vh - 165px);
    max-height: none;
  }

  .bw-form__header-row {
    flex-direction: column;
    gap: 0.35rem;
  }

  .bw-form__changed-indicator {
    margin-top: 0;
  }

  .bw-form__tabs {
    display: flex;
  }

  .bw-form__tabs button {
    flex: 0 0 auto;
  }

  .bw-form__tab-panel--content,
  .bw-form__field-editor {
    grid-template-columns: 1fr;
  }

  .bw-form__field-editor h4,
  .bw-form__editor-actions,
  .bw-form__full-width {
    grid-column: 1;
  }

  .bw-form__custom-field {
    grid-template-columns: 18px minmax(0, 1fr);
  }

  .bw-form__custom-field-actions {
    grid-column: 2;
    justify-content: flex-start;
  }
}

/*
 * The dialog component controls its own outer width.
 * The form must never become wider than the available content area.
 */
.bw-form {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  overflow-x: hidden !important;
}

.bw-form,
.bw-form * {
  box-sizing: border-box;
}

/*
 * The visual unsaved-change badge consumes header space and duplicates
 * the close confirmation. Keep the confirmation, hide only the badge.
 */
.bw-form [class*="unsaved"],
.bw-form [class*="dirty"],
.bw-form [class*="changed-badge"],
.bw-form [class*="change-indicator"],
.bw-form [class*="status-badge"] {
  display: none !important;
}

/*
 * Never allow sticky/header containers to introduce a horizontal
 * minimum width.
 */
.bw-form [class*="sticky"],
.bw-form [class*="header"],
.bw-form [class*="topbar"] {
  min-width: 0 !important;
  max-width: 100% !important;
}

/* Item types wrap naturally instead of causing horizontal scrolling. */
.bw-form__radio-group {
  display: flex !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  flex-wrap: wrap !important;
  overflow: visible !important;
  gap: 0.45rem 0.75rem !important;
  padding-right: 0 !important;
}

.bw-form__radio-group > * {
  min-width: 0 !important;
  flex: 0 0 auto !important;
}

.bw-form__type-option {
  max-width: 100% !important;
}

/* Three equal tabs without an internal horizontal scrollbar. */
.bw-form__tabs {
  display: grid !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 0 !important;
  overflow: visible !important;
  padding: 0 !important;
}

.bw-form__tabs button {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  white-space: normal !important;
  overflow-wrap: anywhere !important;
  text-align: center !important;
}

/* Only vertical scrolling is allowed inside the content area. */
.bw-form__tab-panel,
.bw-form [class*="scroll"],
.bw-form [class*="content"] {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  overflow-x: hidden !important;
}

/*
 * Custom-field editor:
 * Field type, field name and value use the full available width.
 */
.bw-form__field-editor {
  display: flex !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  flex-direction: column !important;
  align-items: stretch !important;
  gap: 0.85rem !important;
  margin-top: 1rem !important;
  padding: 1rem !important;
  overflow: hidden !important;
}

.bw-form__field-editor > * {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  margin: 0 !important;
}

.bw-form__field-editor h4 {
  margin: 0 0 0.15rem !important;
}

.bw-form__field-editor .bw-form__field {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  margin: 0 !important;
}

.bw-form__field-editor input,
.bw-form__field-editor select,
.bw-form__field-editor textarea {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

/* Editor actions remain compact and right aligned. */
.bw-form__editor-actions {
  display: flex !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: 100% !important;
  align-self: flex-end !important;
  justify-content: flex-end !important;
  flex-wrap: wrap !important;
  gap: 0.6rem !important;
  margin-top: 0.2rem !important;
}

/* Existing custom-field rows must also stay within the dialog. */
.bw-form__custom-fields,
.bw-form__custom-field {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

.bw-form__custom-field {
  overflow: hidden !important;
}

.bw-form__custom-field-summary {
  min-width: 0 !important;
}

.bw-form__custom-field-summary strong,
.bw-form__custom-field-summary small {
  min-width: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Reach through the Nextcloud dialog component where supported. */
:deep(.modal-container__content),
:deep(.dialog__content),
:deep(.dialog__body) {
  min-width: 0 !important;
  max-width: 100% !important;
  overflow-x: hidden !important;
}

/* Compact mobile presentation. */
@media (max-width: 760px) {
  .bw-form__tabs {
    grid-template-columns: 1fr !important;
  }

  .bw-form__tabs button {
    min-height: 42px !important;
  }

  .bw-form__field-editor {
    padding: 0.8rem !important;
  }

  .bw-form__editor-actions {
    width: 100% !important;
  }

  .bw-form__editor-actions > * {
    flex: 1 1 auto !important;
  }
}

/*
 * All five item types stay in one row.
 * Equal columns prevent one long label from forcing a line break.
 */
.bw-form__radio-group {
  display: grid !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  gap: 0.35rem !important;
  overflow: visible !important;
  padding: 0 !important;
}

.bw-form__radio-group > * {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  margin: 0 !important;
}

.bw-form__type-option {
  display: inline-flex !important;
  min-width: 0 !important;
  max-width: 100% !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 0.35rem !important;
  font-size: 0.92rem !important;
  white-space: nowrap !important;
}

/* The close confirmation remains active; only the badge is hidden. */
.bw-form__unsaved-hidden {
  display: none !important;
}

/*
 * Only very small screens may use two rows.
 * Normal desktop and tablet dialog widths remain a single row.
 */
@media (max-width: 640px) {
  .bw-form__radio-group {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

/*
 * Delete/remove icon in custom-field rows:
 * slightly darker neutral gray by default,
 * stronger only on hover/focus.
 */
.bw-form [class*="custom-field"] button:last-child,
.bw-form [class*="field-row"] button:last-child,
.bw-form button[class*="delete"],
.bw-form button[class*="remove"],
.bw-form button[class*="danger"] {
  color: #8f8f8f !important;
  opacity: 1 !important;
}

.bw-form [class*="custom-field"] button:last-child svg,
.bw-form [class*="field-row"] button:last-child svg,
.bw-form button[class*="delete"] svg,
.bw-form button[class*="remove"] svg,
.bw-form button[class*="danger"] svg {
  color: #8f8f8f !important;
  fill: currentColor !important;
  stroke: currentColor !important;
  opacity: 1 !important;
}

.bw-form [class*="custom-field"] button:last-child:hover,
.bw-form [class*="custom-field"] button:last-child:focus-visible,
.bw-form [class*="field-row"] button:last-child:hover,
.bw-form [class*="field-row"] button:last-child:focus-visible,
.bw-form button[class*="delete"]:hover,
.bw-form button[class*="delete"]:focus-visible,
.bw-form button[class*="remove"]:hover,
.bw-form button[class*="remove"]:focus-visible,
.bw-form button[class*="danger"]:hover,
.bw-form button[class*="danger"]:focus-visible {
  color: #b94a48 !important;
}

.bw-form [class*="custom-field"] button:last-child:hover svg,
.bw-form [class*="custom-field"] button:last-child:focus-visible svg,
.bw-form [class*="field-row"] button:last-child:hover svg,
.bw-form [class*="field-row"] button:last-child:focus-visible svg,
.bw-form button[class*="delete"]:hover svg,
.bw-form button[class*="delete"]:focus-visible svg,
.bw-form button[class*="remove"]:hover svg,
.bw-form button[class*="remove"]:focus-visible svg,
.bw-form button[class*="danger"]:hover svg,
.bw-form button[class*="danger"]:focus-visible svg {
  color: #b94a48 !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}

/*
 * Desktop:
 * remove the outer form scrollbar and let only long inner sections scroll.
 */
@media (min-width: 900px) {
  .bw-form {
    height: 100% !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  .bw-form__tab-panel,
  .bw-form__content,
  .bw-form__panel,
  .bw-form__body {
    overflow: visible !important;
    min-height: 0 !important;
    max-height: none !important;
  }

  /* Reach through Nextcloud dialog container */
  :deep(.modal-container__content),
  :deep(.dialog__content),
  :deep(.dialog__body) {
    overflow: hidden !important;
    min-height: 0 !important;
  }

  /*
   * Long internal lists should scroll themselves instead of forcing
   * the whole dialog to scroll.
   */
  .bw-form [class*="collection-list"],
  .bw-form [class*="collections-list"],
  .bw-form [class*="collection-results"],
  .bw-form [class*="folder-list"],
  .bw-form [class*="field-list"],
  .bw-form [class*="custom-fields-list"] {
    max-height: 240px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }

  /*
   * Some current blocks use a generic scroll container.
   * Limit only those inner blocks, not the whole form.
   */
  .bw-form [class*="list-scroll"],
  .bw-form [class*="results-scroll"],
  .bw-form [class*="inner-scroll"] {
    max-height: 240px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }
}

/*
 * On smaller screens we keep the current behaviour,
 * because a full outer scroll can still be useful there.
 */
@media (max-width: 899px) {
  .bw-form {
    overflow: visible !important;
  }
}

/* Compact group headings such as Selected and Available. */
.bw-form__collection-group h4 {
  margin: 0 !important;
  padding: 0.4rem 0.6rem !important;
  font-size: 0.92rem !important;
  font-weight: 650 !important;
  line-height: 1.25 !important;
}

/* Compact individual collection rows. */
.bw-form__collection {
  padding: 0.4rem 0.6rem !important;
  font-size: 0.87rem !important;
  line-height: 1.25 !important;
}

.bw-form__collection-text strong {
  font-size: 0.87rem !important;
  font-weight: 600 !important;
  line-height: 1.25 !important;
}

.bw-form__collection-text small {
  margin-top: 0.1rem !important;
  font-size: 0.72rem !important;
  line-height: 1.2 !important;
}

/* The result counter above the list should remain unobtrusive. */
.bw-form__collection-summary {
  font-size: 0.72rem !important;
  line-height: 1.25 !important;
}

/* Passkey-Bearbeitung */

.bw-form__passkeys {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-background-hover);
}

.bw-form__passkeys-title {
  color: var(--color-main-text);
  font-weight: 700;
}

.bw-form__passkey {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-form__passkey-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.bw-form__passkey-info strong {
  overflow: hidden;
  color: var(--color-main-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-form__passkey-info span {
  overflow: hidden;
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-form__passkey-remove {
  flex: 0 0 auto;
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--color-error);
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-error);
  cursor: pointer;
}

.bw-form__passkey-remove:hover,
.bw-form__passkey-remove:focus-visible {
  background:
    color-mix(
      in srgb,
      var(--color-error) 15%,
      transparent
    );
}

.bw-form__passkey-hint {
  margin: 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
}

.bw-form__tabs {
  display: flex !important;
  grid-template-columns: none !important;
  gap: 0.2rem;
}

.bw-form__tabs > button {
  min-width: 0;
  flex: 1 1 0;
}

.bw-form__security-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.bw-form__security-value {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  background: var(--color-background-hover);
}

.bw-form__security-value span {
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
  font-weight: 600;
}

.bw-form__security-value strong {
  width: fit-content;
  padding: 0.2rem 0.6rem;
  border: 2px solid var(--color-border-dark);
  border-radius: 999px;
  color: var(--color-main-text);
}

.bw-form__strength--weak {
  border-color: var(--color-error) !important;
  background:
    color-mix(
      in srgb,
      var(--color-error) 28%,
      var(--color-main-background)
    );
}

.bw-form__strength--fair {
  border-color: var(--color-warning) !important;
  background:
    color-mix(
      in srgb,
      var(--color-warning) 30%,
      var(--color-main-background)
    );
}

.bw-form__strength--good,
.bw-form__strength--strong {
  border-color: var(--color-success) !important;
  background:
    color-mix(
      in srgb,
      var(--color-success) 28%,
      var(--color-main-background)
    );
}

.bw-form__passkey-empty {
  margin: 0;
  padding: 0.65rem;
  border: 1px dashed var(--color-border-dark);
  border-radius: var(--border-radius);
  color: var(--color-text-maxcontrast);
}

@media (max-width: 760px) {
  .bw-form__tabs {
    overflow-x: auto;
  }

  .bw-form__tabs > button {
    min-width: max-content;
  }

  .bw-form__security-summary {
    grid-template-columns: 1fr;
  }
}

.bw-form__uri-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.bw-form__uri-row {
  display: grid;
  grid-template-areas:
    "url advanced remove"
    "match match match";
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: end;
  gap: 0.75rem;
}

.bw-form__uri-input {
  grid-area: url;
  min-width: 0;
  margin-bottom: 0;
}

.bw-form__uri-match {
  display: flex;
  min-width: 0;
  grid-area: match;
  flex-direction: column;
  gap: 0.25rem;
}

.bw-form__uri-match label {
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  font-weight: 600;
}

.bw-form__uri-advanced {
  display: inline-flex;
  min-height: 36px;
  grid-area: advanced;
  align-items: center;
  justify-content: center;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  cursor: pointer;
  white-space: nowrap;
}

.bw-form__uri-advanced:hover,
.bw-form__uri-advanced:focus-visible {
  background: var(--color-background-hover);
}

.bw-form__uri-remove {
  display: inline-flex;
  width: 36px;
  grid-area: remove;
  height: 36px;
  align-items: center;
  justify-content: center;
  margin-bottom: 1px;
  padding: 0;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-error);
  cursor: pointer;
  font-size: 1.35rem;
}

.bw-form__uri-remove:hover,
.bw-form__uri-remove:focus-visible {
  background: var(--color-background-hover);
}

@media (max-width: 720px) {
  .bw-form__uri-row {
    grid-template-areas:
      "url remove"
      "advanced advanced"
      "match match";
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .bw-form__uri-advanced {
    justify-self: start;
  }

  .bw-form__uri-remove {
    justify-self: end;
  }
}

/* Stufe 2N-3: gut sichtbare Speicher- und Konfliktfehler */
.bw-form__error {
  flex: 0 0 auto;
  margin: 12px 0 0;
  padding: 12px 14px;
  border: 2px solid var(--color-error, #c62828);
  border-left-width: 6px;
  border-radius: var(--border-radius-large, 10px);
  background-color: rgba(198, 40, 40, 0.12);
  background-color: color-mix(
    in srgb,
    var(--color-error, #c62828) 14%,
    var(--color-main-background, #ffffff)
  );
  color: var(--color-main-text, #1f1f1f);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  font-weight: 600;
  line-height: 1.45;
  opacity: 1 !important;
  white-space: normal;
}

</style>
