<template>
  <section class="bw-items-panel">
    <header class="bw-items-panel__header">
      <div class="bw-items-panel__heading">
        <span class="bw-items-panel__eyebrow">
          {{ t('nc_bitwarden', 'Items') }}
        </span>
        <h2 :title="displayTitle">{{ displayTitle }}</h2>
      </div>

      <div class="bw-items-panel__header-actions">
        <span class="bw-items-panel__count">
          {{ items.length }}
        </span>

        <button
          v-if="advancedMode"
          type="button"
          class="bw-items-panel__new"
          :class="{
            'bw-items-panel__new--active': selectionMode,
          }"
          :title="selectionMode
            ? t('nc_bitwarden', 'End selection')
            : t('nc_bitwarden', 'Select multiple items')"
          :aria-label="selectionMode
            ? t('nc_bitwarden', 'End selection')
            : t('nc_bitwarden', 'Select multiple items')"
          @click="toggleSelectionMode"
        >
          <CloseIcon v-if="selectionMode" :size="20" />
          <CheckboxMultipleMarkedOutlineIcon v-else :size="20" />
        </button>

        <button
          v-if="!trashMode"
          type="button"
          class="bw-items-panel__new"
          :title="t('nc_bitwarden', 'Create new item')"
          :aria-label="t('nc_bitwarden', 'Create new item')"
          @click="$emit('new')"
        >
          <PlusIcon :size="20" />
        </button>
      </div>
    </header>

    <div
      v-if="advancedMode && selectionMode"
      class="bw-items-panel__bulk-bar"
    >
      <strong>
        {{ t(
          'nc_bitwarden',
          '{count} items selected',
          { count: selectedCount },
        ) }}
      </strong>

      <div class="bw-items-panel__bulk-actions">
        <button
          type="button"
          @click="toggleSelectAll"
        >
          {{
            allVisibleSelected
              ? t('nc_bitwarden', 'Select none')
              : t('nc_bitwarden', 'Select all')
          }}
        </button>

        <template v-if="trashMode">
          <button
            type="button"
            :disabled="
              selectedCount === 0
                || !selectedCanRestore
            "
            @click="emitBulk('bulk-restore')"
          >
            {{
              t(
                'nc_bitwarden',
                'Restore',
              )
            }}
          </button>

          <button
            type="button"
            class="bw-items-panel__bulk-delete"
            :disabled="
              selectedCount === 0
                || !selectedCanDelete
            "
            @click="
              emitBulk(
                'bulk-delete-permanent',
              )
            "
          >
            {{
              t(
                'nc_bitwarden',
                'Delete permanently',
              )
            }}
          </button>
        </template>

        <template v-else>
          <button
            type="button"
            :disabled="
              selectedCount === 0
                || !selectedCanEdit
            "
            @click="emitBulk('bulk-folder')"
          >
            {{
              t(
                'nc_bitwarden',
                'Folder…',
              )
            }}
          </button>

          <button
            type="button"
            :disabled="
              selectedCount === 0
                || !selectedCanAssignCollections
            "
            @click="
              emitBulk('bulk-collections')
            "
          >
            {{
              t(
                'nc_bitwarden',
                'Collections…',
              )
            }}
          </button>

          <button
            type="button"
            class="bw-items-panel__bulk-delete"
            :disabled="
              selectedCount === 0
                || !selectedCanDelete
            "
            @click="emitBulk('bulk-delete')"
          >
            {{
              t(
                'nc_bitwarden',
                'Move to trash',
              )
            }}
          </button>
        </template>
      </div>
    </div>

    <div
      v-if="items.length > 0"
      v-bind="containerProps"
      class="bw-items-panel__list"
      role="list"
    >
      <div
        v-bind="wrapperProps"
        class="bw-items-panel__list-content"
      >
        <div
          v-for="{ data: item, index } in virtualItems"
          :key="item.id"
          :data-item-id="item.id"
          class="bw-items-panel__row"
          :class="{
            'bw-items-panel__row--active':
              selectedId === item.id,
            'bw-items-panel__row--selected':
              isSelected(item),
          }"
          :draggable="
            advancedMode
              && !trashMode
              && canEditItem(item)
          "
          role="listitem"
          :aria-posinset="index + 1"
          :aria-setsize="items.length"
          @dragstart="startDrag($event, item)"
        >
          <button
            type="button"
            class="bw-items-panel__item"
            :aria-pressed="selectionMode
              ? isSelected(item)
              : undefined"
            @click="handleItemClick($event, item, index)"
          >
            <span
              v-if="selectionMode"
              class="bw-items-panel__selection-icon"
              aria-hidden="true"
            >
              <span
                class="bw-items-panel__selection-box"
                :class="{
                  'bw-items-panel__selection-box--checked':
                    isSelected(item),
                }"
              >
                <span v-if="isSelected(item)">✓</span>
              </span>
            </span>

            <component
              :is="typeIcon(item.type)"
              :size="19"
              class="bw-items-panel__icon"
            />

            <span class="bw-items-panel__content">
              <strong :title="itemName(item)">
                {{ itemName(item) }}
              </strong>

              <small
                v-if="itemSubtitle(item)"
                :title="itemSubtitle(item)"
              >
                {{ itemSubtitle(item) }}
              </small>
            </span>

            <StarIcon
              v-if="item.favorite"
              :size="16"
              class="bw-items-panel__favorite"
              :title="t('nc_bitwarden', 'Favorite')"
            />
          </button>

          <div
            v-if="!selectionMode"
            class="bw-items-panel__actions"
          >
            <template v-if="trashMode">
              <button
                v-if="canRestoreItem(item)"
                type="button"
                class="bw-items-panel__action"
                :title="
                  t(
                    'nc_bitwarden',
                    'Restore {name}',
                    { name: itemName(item) },
                  )
                "
                :aria-label="
                  t(
                    'nc_bitwarden',
                    'Restore {name}',
                    { name: itemName(item) },
                  )
                "
                @click.stop="$emit('restore', item)"
              >
                <RestoreIcon :size="17" />
              </button>

              <button
                v-if="
                  advancedMode
                    && canDeleteItem(item)
                "
                type="button"
                class="
                  bw-items-panel__action
                  bw-items-panel__action--danger
                "
                :title="
                  t(
                    'nc_bitwarden',
                    'Permanently delete {name}',
                    { name: itemName(item) },
                  )
                "
                :aria-label="
                  t(
                    'nc_bitwarden',
                    'Permanently delete {name}',
                    { name: itemName(item) },
                  )
                "
                @click.stop="
                  $emit(
                    'delete-permanent',
                    item,
                  )
                "
              >
                <DeleteOutlineIcon :size="17" />
              </button>
            </template>

            <template v-else>
              <button
                v-if="canQuickCopyTotp(item)"
                type="button"
                class="bw-items-panel__action"
                :class="{
                  'bw-items-panel__action--copied':
                    quickCopySucceeded(item, 'totp'),
                }"
                :title="quickCopyTitle(item, 'totp')"
                :aria-label="quickCopyTitle(item, 'totp')"
                @click.stop="
                  copyLoginValue(item, 'totp', $event)
                "
              >
                <CheckIcon
                  v-if="quickCopySucceeded(item, 'totp')"
                  :size="17"
                />
                <ClockOutlineIcon v-else :size="17" />
              </button>

              <button
                v-if="
                  canQuickCopyPassword(item)
                "
                type="button"
                class="bw-items-panel__action"
                :class="{
                  'bw-items-panel__action--copied':
                    quickCopySucceeded(item, 'password'),
                }"
                :title="
                  quickCopyTitle(
                    item,
                    'password',
                  )
                "
                :aria-label="
                  quickCopyTitle(
                    item,
                    'password',
                  )
                "
                @click.stop="
                  copyLoginValue(item, 'password', $event)
                "
              >
                <CheckIcon
                  v-if="quickCopySucceeded(item, 'password')"
                  :size="17"
                />
                <ContentCopyIcon v-else :size="17" />
              </button>

              <button
                v-if="canEditItem(item)"
                type="button"
                class="bw-items-panel__action"
                :title="
                  t(
                    'nc_bitwarden',
                    'Edit {name}',
                    { name: itemName(item) },
                  )
                "
                :aria-label="
                  t(
                    'nc_bitwarden',
                    'Edit {name}',
                    { name: itemName(item) },
                  )
                "
                @click.stop="$emit('edit', item)"
              >
                <PencilOutlineIcon :size="17" />
              </button>

              <button
                v-if="
                  advancedMode
                    && canDeleteItem(item)
                "
                type="button"
                class="
                  bw-items-panel__action
                  bw-items-panel__action--danger
                "
                :title="
                  t(
                    'nc_bitwarden',
                    'Move {name} to trash',
                    { name: itemName(item) },
                  )
                "
                :aria-label="
                  t(
                    'nc_bitwarden',
                    'Move {name} to trash',
                    { name: itemName(item) },
                  )
                "
                @click.stop="$emit('delete', item)"
              >
                <DeleteOutlineIcon :size="17" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="bw-items-panel__empty"
    >
      <LockOutlineIcon :size="38" />
      <strong>
        {{ t('nc_bitwarden', 'No items') }}
      </strong>
      <span>
        {{ t(
          'nc_bitwarden',
          'No items were found for this selection.',
        ) }}
      </span>
    </div>

    <span
      class="bw-items-panel__status"
      aria-live="polite"
    >{{ quickCopyMessage }}</span>
  </section>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import { useVirtualList } from '@vueuse/core'
import { copySensitiveText } from '../services/clipboard.js'
import {
  canQuickCopyLoginValue,
  loginQuickCopyValue,
  LOGIN_QUICK_COPY_PASSWORD,
  LOGIN_QUICK_COPY_TOTP,
} from '../utils/loginQuickCopy.js'
import ViewListOutlineIcon from 'vue-material-design-icons/ViewListOutline.vue'
import StarIcon from 'vue-material-design-icons/Star.vue'
import KeyOutlineIcon from 'vue-material-design-icons/KeyOutline.vue'
import NoteTextOutlineIcon from 'vue-material-design-icons/NoteTextOutline.vue'
import CreditCardOutlineIcon from 'vue-material-design-icons/CreditCardOutline.vue'
import IdentityOutlineIcon from 'vue-material-design-icons/CardAccountDetailsOutline.vue'
import PencilOutlineIcon from 'vue-material-design-icons/PencilOutline.vue'
import DeleteOutlineIcon from 'vue-material-design-icons/DeleteOutline.vue'

import RestoreIcon from 'vue-material-design-icons/Restore.vue'
import LockOutlineIcon from 'vue-material-design-icons/LockOutline.vue'
import PlusIcon from 'vue-material-design-icons/Plus.vue'
import CloseIcon from 'vue-material-design-icons/Close.vue'
import ContentCopyIcon from 'vue-material-design-icons/ContentCopy.vue'
import ClockOutlineIcon from 'vue-material-design-icons/ClockOutline.vue'
import CheckIcon from 'vue-material-design-icons/Check.vue'
import CheckboxMultipleMarkedOutlineIcon from 'vue-material-design-icons/CheckboxMultipleMarkedOutline.vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },

  title: {
    type: String,
    default: '',
  },
  selectedId: {
    type: String,
    default: null,
  },
  selectionRevision: {
    type: Number,
    default: 0,
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
  'new',
  'select',
  'edit',
  'delete',
  'bulk-folder',
  'bulk-collections',
  'bulk-delete',

  'restore',
  'delete-permanent',
  'bulk-restore',
  'bulk-delete-permanent',
])

const VIRTUAL_ITEM_HEIGHT = 60

const {
  list: virtualItems,
  containerProps,
  wrapperProps,
} = useVirtualList(
  computed(() => props.items),
  {
    itemHeight: VIRTUAL_ITEM_HEIGHT,
    overscan: 8,
  },
)

const listElement = containerProps.ref
const selectionMode = ref(false)
const selectedIds = ref(new Set())
const lastSelectedIndex = ref(null)
const quickCopyAction = ref('')
const quickCopyMessage = ref('')

let quickCopyTimer = null

const displayTitle = computed(() =>
  props.title || t('nc_bitwarden', 'All items'),
)

const selectedItems = computed(() =>
  props.items.filter(item =>
    selectedIds.value.has(normalizeId(item.id)),
  ),
)

const selectedCount = computed(() =>
  selectedItems.value.length,
)

const selectedCanEdit = computed(() =>
  selectedItems.value.length > 0
    && selectedItems.value.every(canEditItem),
)

const selectedCanAssignCollections = computed(() =>
  selectedItems.value.length > 0
    && selectedItems.value.every(
      canAssignCollectionsItem,
    ),
)

const selectedCanDelete = computed(() =>
  selectedItems.value.length > 0
    && selectedItems.value.every(canDeleteItem),
)

const selectedCanRestore = computed(() =>
  selectedItems.value.length > 0
    && selectedItems.value.every(canRestoreItem),
)

const allVisibleSelected = computed(() =>
  props.items.length > 0
  && props.items.every(item =>
    selectedIds.value.has(normalizeId(item.id)),
  ),
)

// Stufe 2O-2: Berechtigungen der Listeneinträge
function itemIsPersonal(item) {
  return !String(
    item?.organizationId
    ?? '',
  ).trim()
}

function canEditItem(item) {
  return itemIsPersonal(item)
    || item?.edit === true
}

function canViewPasswordItem(item) {
  return itemIsPersonal(item)
    || item?.viewPassword === true
}

function canAssignCollectionsItem(item) {
  return (
    canEditItem(item)
    && canViewPasswordItem(item)
  )
}

function canQuickCopyPassword(item) {
  return canQuickCopyLoginValue(
    item,
    LOGIN_QUICK_COPY_PASSWORD,
    canViewPasswordItem(item),
  )
}

function canQuickCopyTotp(item) {
  return canQuickCopyLoginValue(
    item,
    LOGIN_QUICK_COPY_TOTP,
    canViewPasswordItem(item),
  )
}

function quickCopyKey(item, type) {
  return `${normalizeId(item?.id)}:${type}`
}

function quickCopySucceeded(item, type) {
  return quickCopyAction.value === quickCopyKey(item, type)
}

function quickCopyTitle(item, type) {
  const label = type === LOGIN_QUICK_COPY_TOTP
    ? t('nc_bitwarden', 'TOTP')
    : t('nc_bitwarden', 'Password')

  return `${label}: ${t(
    'nc_bitwarden',
    'Copy to clipboard',
  )} – ${itemName(item)}`
}

function clearQuickCopyFeedback() {
  if (quickCopyTimer) {
    clearTimeout(quickCopyTimer)
    quickCopyTimer = null
  }

  quickCopyAction.value = ''
  quickCopyMessage.value = ''
}

function showQuickCopyFeedback(item, type, copied) {
  clearQuickCopyFeedback()

  if (copied) {
    quickCopyAction.value = quickCopyKey(item, type)
  }

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

async function copyLoginValue(item, type, event) {
  const actionButton = event?.currentTarget
  const pointerTriggered = Number(event?.detail) > 0
  const allowed = type === LOGIN_QUICK_COPY_TOTP
    ? canQuickCopyTotp(item)
    : canQuickCopyPassword(item)

  if (!allowed) {
    return
  }

  try {
    const value = await loginQuickCopyValue(item, type)
    const copied = await copySensitiveText(value)

    showQuickCopyFeedback(item, type, copied)
  } catch {
    showQuickCopyFeedback(item, type, false)
  } finally {
    if (pointerTriggered) {
      actionButton?.blur()
    }
  }
}

function canDeleteItem(item) {
  return itemIsPersonal(item)
    || item?.permissions?.delete === true
}

function canRestoreItem(item) {
  return itemIsPersonal(item)
    || item?.permissions?.restore === true
}

function itemName(item) {
  return item.name || t('nc_bitwarden', '(no name)')
}

function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isSelected(item) {
  return selectedIds.value.has(normalizeId(item.id))
}

function setSelectedIds(values) {
  selectedIds.value = new Set(
    values.map(normalizeId).filter(Boolean),
  )
}

function resetSelection() {
  selectionMode.value = false
  selectedIds.value = new Set()
  lastSelectedIndex.value = null
}

function toggleSelectionMode() {
  if (selectionMode.value) {
    resetSelection()
    return
  }

  selectionMode.value = true
}

function toggleSelectAll() {
  if (allVisibleSelected.value) {
    setSelectedIds([])
    return
  }

  setSelectedIds(props.items.map(item => item.id))
}

function handleItemClick(event, item, index) {
  if (!props.advancedMode) {
    emit('select', item)
    return
  }

  if (!selectionMode.value && !(event.ctrlKey || event.metaKey)) {
    emit('select', item)
    return
  }

  selectionMode.value = true

  const next = new Set(selectedIds.value)
  const itemId = normalizeId(item.id)

  if (
    event.shiftKey
    && lastSelectedIndex.value !== null
  ) {
    const start = Math.min(lastSelectedIndex.value, index)
    const end = Math.max(lastSelectedIndex.value, index)

    for (let current = start; current <= end; current += 1) {
      next.add(normalizeId(props.items[current]?.id))
    }
  } else if (next.has(itemId)) {
    next.delete(itemId)
  } else {
    next.add(itemId)
  }

  next.delete('')
  selectedIds.value = next
  lastSelectedIndex.value = index
}

function emitBulk(eventName) {
  if (selectedCount.value === 0) {
    return
  }

  const permissionChecks = {
    'bulk-folder': canEditItem,
    'bulk-collections':
      canAssignCollectionsItem,
    'bulk-delete': canDeleteItem,
    'bulk-restore': canRestoreItem,
    'bulk-delete-permanent': canDeleteItem,
  }

  const permissionCheck =
    permissionChecks[eventName]

  if (
    permissionCheck
    && !selectedItems.value.every(
      permissionCheck,
    )
  ) {
    return
  }

  emit(eventName, [...selectedItems.value])
}

function startDrag(event, item) {
  if (!props.advancedMode || props.trashMode) {
    event.preventDefault()
    return
  }

  const dragItems = (
    selectionMode.value
    && isSelected(item)
    && selectedCount.value > 0
  )
    ? [...selectedItems.value]
    : [item]

  if (!dragItems.every(canEditItem)) {
    event.preventDefault()
    return
  }

  const itemIds =
    dragItems.map(candidate => candidate.id)

  event.dataTransfer?.setData(
    'application/x-warden-item-ids',
    JSON.stringify(itemIds),
  )
  event.dataTransfer?.setData(
    'text/plain',
    itemIds.join(','),
  )

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

async function scrollSelectedItemIntoView() {
  const selectedId = normalizeId(props.selectedId)
  const selectedIndex = selectedId
    ? props.items.findIndex(item =>
      normalizeId(item.id) === selectedId,
    )
    : -1

  await nextTick()

  const container = listElement.value

  if (!container) {
    return
  }

  const centeredOffset = selectedIndex >= 0
    ? selectedIndex * VIRTUAL_ITEM_HEIGHT
      - (container.clientHeight - VIRTUAL_ITEM_HEIGHT) / 2
    : 0

  container.scrollTop = Math.max(0, centeredOffset)
  containerProps.onScroll()
}

watch(
  [
    () => props.selectedId,
    () => props.items.map(item => item.id).join('|'),
    () => props.title,
  ],
  scrollSelectedItemIntoView,
  {
    immediate: true,
    flush: 'post',
  },
)

watch(
  () => props.items.map(item => normalizeId(item.id)),
  itemIds => {
    const allowed = new Set(itemIds)

    setSelectedIds(
      [...selectedIds.value].filter(id => allowed.has(id)),
    )
  },
)

watch(
  () => props.trashMode,
  resetSelection,
)

watch(
  () => props.advancedMode,
  advancedMode => {
    if (!advancedMode) {
      resetSelection()
    }
  },
  {
    immediate: true,
  },
)

watch(
  () => props.selectionRevision,
  resetSelection,
)

onBeforeUnmount(clearQuickCopyFeedback)

function typeIcon(type) {
  return {
    1: KeyOutlineIcon,
    2: NoteTextOutlineIcon,
    3: CreditCardOutlineIcon,
    4: IdentityOutlineIcon,
    5: KeyOutlineIcon,
  }[Number(type)] ?? ViewListOutlineIcon
}

function itemSubtitle(item) {
  switch (Number(item.type)) {
    case 1:
      return item.login?.username
        || t('nc_bitwarden', 'Login credentials')

    case 2:
      return t('nc_bitwarden', 'Secure note')

    case 3:
      return item.card?.brand
        || t('nc_bitwarden', 'Card')

    case 4:
      return item.identity?.email
        || t('nc_bitwarden', 'Identity')

    case 5:
      return item.sshKey?.keyFingerprint
        || t('nc_bitwarden', 'SSH key')

    default:
      return ''
  }
}
</script>

<style scoped>
.bw-items-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--color-main-background);
}

.bw-items-panel__header {
  display: flex;
  min-height: 66px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.bw-items-panel__heading {
  min-width: 0;
}

.bw-items-panel__eyebrow {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bw-items-panel__header h2 {
  overflow: hidden;
  margin: 0;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-items-panel__header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.45rem;
}

.bw-items-panel__new {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-items-panel__new:hover,
.bw-items-panel__new:focus-visible {
  background: var(--color-background-hover);
}

.bw-items-panel__count {
  min-width: 24px;
  flex-shrink: 0;
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  background: var(--color-background-dark);
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  text-align: center;
}

.bw-items-panel__list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  scrollbar-gutter: stable;
}

.bw-items-panel__list-content {
  min-width: 0;
}

.bw-items-panel__row {
  position: relative;
  display: flex;
  height: 56px;
  align-items: center;
  box-sizing: border-box;
  margin-bottom: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  transition:
    background 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
}

.bw-items-panel__row:hover {
  border-color: var(--color-border-dark);
  background: var(--color-background-hover);
}

.bw-items-panel__row--active {
  border-color: var(--color-primary-element);
  background: var(--color-primary-element-light);
  box-shadow: inset 3px 0 0 var(--color-primary-element);
}

.bw-items-panel__item {
  display: flex;
  height: 100%;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
  text-align: left;
}

.bw-items-panel__icon {
  flex-shrink: 0;
  color: currentColor;
}

.bw-items-panel__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
}

.bw-items-panel__content strong,
.bw-items-panel__content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-items-panel__content strong {
  font-size: 0.9rem;
  line-height: 1.25;
}

.bw-items-panel__content small {
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  line-height: 1.3;
}

.bw-items-panel__favorite {
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.7;
}

.bw-items-panel__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.1rem;
  padding-right: 0.35rem;
}

.bw-items-panel__action {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-text-maxcontrast);
  cursor: pointer;
}

.bw-items-panel__action:hover,
.bw-items-panel__action:focus-visible {
  background: var(--color-background-dark);
  color: var(--color-main-text);
}

.bw-items-panel__action--copied {
  color: var(--color-success);
}

.bw-items-panel__status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.bw-items-panel__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: var(--color-text-maxcontrast);
  text-align: center;
}

.bw-items-panel__empty span {
  font-size: 0.85rem;
}

.bw-items-panel__header {
  min-height: 60px;
  padding: 0.65rem 0.85rem;
}

.bw-items-panel__list {
  padding: 0.4rem;
}

.bw-items-panel__item {
  gap: 0.55rem;
  padding: 0.5rem 0.65rem;
}

.bw-items-panel__content strong {
  font-size: 0.87rem;
}

.bw-items-panel__content small {
  font-size: 0.72rem;
}

.bw-items-panel__actions {
  position: absolute;
  z-index: 1;
  top: 50%;
  right: 0;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-50%);
  background: var(--color-main-background);
  transition:
    opacity 0.15s ease,
    visibility 0.15s ease;
}

.bw-items-panel__row:hover
  .bw-items-panel__actions,
.bw-items-panel__row:focus-within
  .bw-items-panel__actions {
  background: var(--color-background-hover);
}

.bw-items-panel__row--active
  .bw-items-panel__actions {
  background: var(--color-primary-element-light);
}

.bw-items-panel__row:hover
  .bw-items-panel__actions,
.bw-items-panel__row:focus-within
  .bw-items-panel__actions,
.bw-items-panel__row--active
  .bw-items-panel__actions {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

@media (hover: none), (pointer: coarse) {
  .bw-items-panel__actions {
    position: static;
    z-index: auto;
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: none;
    background: transparent;
  }
}

.bw-items-panel__new--active {
  background: var(--color-background-hover);
}

.bw-items-panel__bulk-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-primary-element-light);
  font-size: 0.78rem;
}

.bw-items-panel__bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.bw-items-panel__bulk-actions button {
  min-height: 28px;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  cursor: pointer;
  font-size: 0.75rem;
}

.bw-items-panel__bulk-actions button:hover,
.bw-items-panel__bulk-actions button:focus-visible {
  background: var(--color-background-hover);
}

.bw-items-panel__bulk-actions button:disabled {
  cursor: default;
  opacity: 0.5;
}

.bw-items-panel__bulk-delete {
  color: var(--color-error) !important;
}

.bw-items-panel__row--selected {
  border-color: var(--color-primary-element);
  background: var(--color-primary-element-light);
}

.bw-items-panel__selection-icon {
  display: flex;
  flex-shrink: 0;
  color: var(--color-primary-element);
}

.bw-items-panel__selection-box {
  display: flex;
  width: 17px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-dark);
  border-radius: 3px;
  background: var(--color-main-background);
  font-size: 0.75rem;
  font-weight: 700;
}

.bw-items-panel__selection-box--checked {
  border-color: var(--color-primary-element);
  background: var(--color-primary-element);
  color: var(--color-primary-element-text);
}

.bw-items-panel__bulk-delete:not(:disabled) {
  border-color: color-mix(
    in srgb,
    var(--color-error) 65%,
    var(--color-border-dark)
  ) !important;
  background: color-mix(
    in srgb,
    var(--color-error) 14%,
    var(--color-main-background)
  ) !important;
  color: color-mix(
    in srgb,
    var(--color-error) 55%,
    var(--color-main-text) 45%
  ) !important;
  font-weight: 700;
  opacity: 1 !important;
}

.bw-items-panel__bulk-delete:not(:disabled):hover,
.bw-items-panel__bulk-delete:not(:disabled):focus-visible {
  border-color: var(--color-error) !important;
  background: color-mix(
    in srgb,
    var(--color-error) 24%,
    var(--color-main-background)
  ) !important;
  color: color-mix(
    in srgb,
    var(--color-error) 68%,
    var(--color-main-text) 32%
  ) !important;
}

.bw-items-panel__bulk-delete:disabled {
  border-color: var(--color-border) !important;
  background: var(--color-main-background) !important;
  color: var(--color-text-maxcontrast) !important;
  opacity: 0.75 !important;
}

.bw-items-panel__action--danger {
  color: var(--color-error);
}

.bw-items-panel__action--danger:hover,
.bw-items-panel__action--danger:focus-visible {
  background:
    color-mix(
      in srgb,
      var(--color-error) 18%,
      transparent
    );
  color: var(--color-error);
}

/*
 * Der bisherige Fehlerfarbton war im hellen Nextcloud-Theme
 * nahezu unsichtbar. Symbol und Hintergrund erhalten deshalb
 * einen deutlich höheren Kontrast.
 */
.bw-items-panel__action--danger {
  border: 1px solid
    color-mix(
      in srgb,
      var(--color-error-text, #b00020) 35%,
      transparent
    ) !important;
  background:
    color-mix(
      in srgb,
      var(--color-error-text, #b00020) 10%,
      transparent
    ) !important;
  color:
    var(--color-error-text, #b00020) !important;
  opacity: 1 !important;
}

.bw-items-panel__action--danger:hover,
.bw-items-panel__action--danger:focus-visible {
  border-color:
    var(--color-error-text, #b00020) !important;
  background:
    color-mix(
      in srgb,
      var(--color-error-text, #b00020) 18%,
      transparent
    ) !important;
  color:
    var(--color-error-text, #b00020) !important;
}

.bw-items-panel__action--danger svg,
.bw-items-panel__action--danger svg path {
  color: inherit !important;
  fill: currentColor !important;
  opacity: 1 !important;
}

/*
 * Auch der Mehrfachauswahl-Knopf soll als aktive
 * Löschaktion eindeutig sichtbar sein.
 */
.bw-items-panel__bulk-delete:not(:disabled) {
  border-color:
    var(--color-error-text, #b00020) !important;
  background:
    color-mix(
      in srgb,
      var(--color-error-text, #b00020) 12%,
      var(--color-main-background)
    ) !important;
  color:
    var(--color-error-text, #b00020) !important;
  opacity: 1 !important;
}

.bw-items-panel__bulk-delete:not(:disabled):hover,
.bw-items-panel__bulk-delete:not(:disabled):focus-visible {
  background:
    color-mix(
      in srgb,
      var(--color-error-text, #b00020) 20%,
      var(--color-main-background)
    ) !important;
}

</style>
