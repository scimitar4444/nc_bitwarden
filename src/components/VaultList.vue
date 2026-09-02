<template>
  <div class="bw-vault">
    <!-- Hauptsuche mit Tresorbereich und Löschknopf -->
    <div class="bw-vault__search">
      <label
        for="bw-vault-global-search"
        class="bw-vault__global-search-label"
      >
        {{ t('nc_bitwarden', 'Global search') }}
      </label>

      <div class="bw-vault__main-search">
        <MagnifyIcon
          :size="18"
          class="bw-vault__global-search-icon"
        />

        <input
          id="bw-vault-global-search"
          v-model="search"
          type="text"
          :placeholder="t('nc_bitwarden', 'Search all vault items…')"
          autocomplete="off"
          @keydown.enter.prevent="showSearchResults"
        >

        <button
          v-if="search"
          type="button"
          class="bw-vault__search-clear"
          :title="t('nc_bitwarden', 'Clear search')"
          :aria-label="t('nc_bitwarden', 'Clear search')"
          @click="search = ''"
        >
          <CloseIcon :size="17" />
        </button>

        <div
          class="bw-vault__scope-switch"
          role="group"
          :aria-label="t('nc_bitwarden', 'Search scope')"
        >
          <button
            type="button"
            class="bw-vault__scope-button"
            :class="{
              'bw-vault__scope-button--active':
                searchScope === 'personal',
            }"
            :title="t('nc_bitwarden', 'Personal vault')"
            :aria-label="t('nc_bitwarden', 'Personal vault')"
            :aria-pressed="searchScope === 'personal'"
            @click="searchScope = 'personal'"
          >
            <AccountOutlineIcon :size="18" />
          </button>

          <button
            type="button"
            class="bw-vault__scope-button"
            :class="{
              'bw-vault__scope-button--active':
                searchScope === 'organization',
            }"
            :title="t('nc_bitwarden', 'Organization')"
            :aria-label="t('nc_bitwarden', 'Organization')"
            :aria-pressed="searchScope === 'organization'"
            @click="searchScope = 'organization'"
          >
            <DomainIcon :size="18" />
          </button>

          <button
            type="button"
            class="bw-vault__scope-button"
            :class="{
              'bw-vault__scope-button--active':
                searchScope === 'both',
            }"
            :title="t('nc_bitwarden', 'Personal and organization vaults')"
            :aria-label="t('nc_bitwarden', 'Personal and organization vaults')"
            :aria-pressed="searchScope === 'both'"
            @click="searchScope = 'both'"
          >
            <span class="bw-vault__scope-both">
              <AccountOutlineIcon :size="14" />
              <DomainIcon :size="14" />
            </span>
          </button>
        </div>
      </div>

      <button
        v-if="normalizedSearchTerm"
        type="button"
        class="bw-vault__search-results"
        @click="showSearchResults"
      >
        <MagnifyIcon :size="18" />
        <span>
          {{ t(
            'nc_bitwarden',
            'Show results: {count}',
            { count: filtered.length },
          ) }}
        </span>
        <ChevronRightIcon :size="18" />
      </button>
    </div>

    <div class="bw-vault__navigation">
      <!-- Kompakter Kategorienfilter -->
      <div class="bw-vault__folders bw-vault__categories">
        <div class="bw-vault__section-heading">
          <span
            class="
              bw-vault__section-title
              bw-vault__section-title--static
            "
          >
            {{ t('nc_bitwarden', 'Category') }}
          </span>
        </div>

        <details
          ref="categoryMenu"
          class="bw-category-select"
        >
          <summary class="bw-category-select__current">
            <component
              :is="activeCategory.icon"
              :size="18"
              class="bw-category-select__icon"
            />

            <span class="bw-category-select__label">
              {{ activeCategory.label }}
            </span>

            <span class="bw-folder__count">
              {{ categoryCount(activeCategory.id) }}
            </span>

            <ChevronDownIcon
              :size="18"
              class="bw-category-select__chevron"
            />
          </summary>

          <div class="bw-category-select__menu">
            <button
              v-for="category in visibleCategories"
              :key="category.id"
              type="button"
              class="bw-category-select__option"
              :class="{
                'bw-category-select__option--active':
                  selectedCategory === category.id
                  && selectedFolder === null
                  && selectedCollection === null,
                'bw-category-select__option--trash':
                  category.id === 'trash',
              }"
              @click="selectCategory(category.id)"
            >
              <component
                :is="category.icon"
                :size="18"
                class="bw-category-select__icon"
              />

              <span class="bw-category-select__label">
                {{ category.label }}
              </span>

              <span class="bw-folder__count">
                {{ categoryCount(category.id) }}
              </span>
            </button>
          </div>
        </details>
      </div>

      <!-- Ordner -->
      <div class="bw-vault__folders">
        <div class="bw-vault__section-heading">
          <button
            type="button"
            class="bw-vault__section-toggle"
            :aria-expanded="!collapsedSections.folders"
            :title="folderSectionToggleLabel"
            :aria-label="folderSectionToggleLabel"
            @click="toggleSection('folders')"
            @pointerup="releasePointerFocus"
          >
            <ChevronRightIcon
              v-if="collapsedSections.folders"
              :size="17"
            />

            <ChevronDownIcon
              v-else
              :size="17"
            />

            <span class="bw-vault__section-title">
              {{ t('nc_bitwarden', 'Folders') }}
            </span>
          </button>

          <button
            v-if="advancedMode"
            type="button"
            class="bw-vault__section-action"
            :title="t(
              'nc_bitwarden',
              'Create new personal folder',
            )"
            :aria-label="t(
              'nc_bitwarden',
              'Create new personal folder',
            )"
            @click.stop="$emit('create-folder')"
          >
            <PlusIcon :size="18" />
          </button>
        </div>

        <button
          v-show="!collapsedSections.folders"
          class="bw-folder"
          :class="{
            'bw-folder--active': selectedFolder === '__none__',
            'bw-drop-target--active':
              dropTargetKey === 'folder:__none__',
          }"
          @click="selectFolder('__none__')"
          @dragenter="
            activateFolderDropTarget(
              $event,
              'folder:__none__',
            )
          "
          @dragover="allowFolderDrop"
          @dragleave="clearDropTarget"
          @drop="dropOnFolder($event, null)"
        >
          <FolderOutlineIcon :size="17" class="bw-folder__icon" />
          {{ t('nc_bitwarden', 'No personal folder') }}
          <span class="bw-folder__count">{{ folderCount(null) }}</span>
        </button>

        <div
          v-for="folder in sortedFolders"
          v-show="!collapsedSections.folders"
          :key="folder.id"
          class="bw-folder-row"
          :class="{
            'bw-folder-row--active':
              selectedFolder === normalizeId(folder.id),
            'bw-drop-target--active':
              dropTargetKey
              === `folder:${normalizeId(folder.id)}`,
          }"
          @dragenter="
            activateFolderDropTarget(
              $event,
              `folder:${normalizeId(folder.id)}`,
            )
          "
          @dragover="allowFolderDrop"
          @dragleave="clearDropTarget"
          @drop="dropOnFolder($event, folder.id)"
        >
          <button
            type="button"
            class="bw-folder bw-folder--main"
            @click="selectFolder(folder.id)"
          >
            <FolderOutlineIcon
              :size="17"
              class="bw-folder__icon"
            />

            <span class="bw-folder__name">
              {{ folder.name }}
            </span>
          </button>

          <div
            v-if="advancedMode"
            class="bw-folder-row__actions"
          >
            <button
              type="button"
              class="bw-folder-row__action"
              :title="t(
                'nc_bitwarden',
                'Rename folder {name}',
                { name: folder.name },
              )"
              :aria-label="t(
                'nc_bitwarden',
                'Rename folder {name}',
                { name: folder.name },
              )"
              @click.stop="$emit('edit-folder', folder)"
            >
              <PencilOutlineIcon :size="16" />
            </button>

            <button
              type="button"
              class="bw-folder-row__action"
              :title="t(
                'nc_bitwarden',
                'Delete folder {name}',
                { name: folder.name },
              )"
              :aria-label="t(
                'nc_bitwarden',
                'Delete folder {name}',
                { name: folder.name },
              )"
              @click.stop="$emit('delete-folder', folder)"
            >
              <DeleteOutlineIcon :size="16" />
            </button>
          </div>

          <span
            class="
              bw-folder__count
              bw-folder-row__count
            "
          >
            {{ folderCount(folder.id) }}
          </span>
        </div>
      </div>

      <!-- Organisation-Sammlungen -->
      <div class="bw-vault__folders">
        <div class="bw-vault__section-heading">
          <button
            v-if="hasNestedCollections"
            type="button"
            class="bw-vault__section-toggle"
            :aria-expanded="!allCollectionBranchesCollapsed"
            :title="collectionSectionToggleLabel"
            :aria-label="collectionSectionToggleLabel"
            @click="toggleCollectionBranches"
            @pointerup="releasePointerFocus"
          >
            <ChevronRightIcon
              v-if="allCollectionBranchesCollapsed"
              :size="17"
            />

            <ChevronDownIcon
              v-else
              :size="17"
            />

            <span class="bw-vault__section-title">
              {{ t('nc_bitwarden', 'Collections') }}
            </span>
          </button>

          <span
            v-else
            class="
              bw-vault__section-title
              bw-vault__section-title--static
            "
          >
            {{ t('nc_bitwarden', 'Collections') }}
          </span>

          <button
            v-if="
              advancedMode
                && canCreateCollection
            "
            type="button"
            class="bw-vault__section-action"
            :title="t('nc_bitwarden', 'Create new collection')"
            :aria-label="t('nc_bitwarden', 'Create new collection')"
            @click.stop="$emit('create-collection')"
          >
            <PlusIcon :size="18" />
          </button>
        </div>

        <div
          v-if="
            advancedMode
              && allCollectionRows.length > 0
          "
          class="bw-collection-search"
        >
          <FilterOutlineIcon :size="17" />

          <input
            v-model="collectionSearch"
            type="search"
            :placeholder="t('nc_bitwarden', 'Filter collection names…')"
            autocomplete="off"
          >

          <button
            v-if="collectionSearch"
            type="button"
            :title="t('nc_bitwarden', 'Clear collection search')"
            :aria-label="t('nc_bitwarden', 'Clear collection search')"
            @click="collectionSearch = ''"
          >
            <CloseIcon :size="16" />
          </button>
        </div>

        <div
          v-if="
            advancedMode
              && collectionSearch
          "
          class="bw-collection-search__summary"
        >
          {{ t(
            'nc_bitwarden',
            'Results: {count}',
            { count: collectionMatchCount },
          ) }}
        </div>

        <div
          v-for="collection in collectionRows"
          :key="collection.id"
          class="bw-folder-row"
          :class="{
            'bw-folder-row--active':
              selectedCollection === normalizeId(collection.id),
            'bw-drop-target--active':
              dropTargetKey
              === `collection:${normalizeId(collection.id)}`,
          }"
          @dragenter="
            activateCollectionDropTarget(
              $event,
              collection,
            )
          "
          @dragover="
            allowCollectionDrop($event, collection)
          "
          @dragleave="clearDropTarget"
          @drop="dropOnCollection($event, collection)"
        >
          <button
            type="button"
            class="bw-folder bw-folder--main bw-collection"
            :style="{
              paddingLeft: `${0.75 + collection.depth * 1.1}rem`,
            }"
            :title="collection.path"
            @click="selectCollection(collection.id)"
          >
            <span
              class="bw-collection__toggle"
              :class="{
                'bw-collection__toggle--empty':
                  !collection.hasChildren,
              }"
              @click.stop="toggleCollection(collection)"
            >
              <ChevronRightIcon
                v-if="
                  collection.hasChildren
                    && isCollectionCollapsed(collection)
                "
                :size="17"
              />

              <ChevronDownIcon
                v-else-if="collection.hasChildren"
                :size="17"
              />
            </span>

            <ArchiveOutlineIcon
              :size="17"
              class="bw-folder__icon"
            />

            <span
              class="bw-collection__name"
              :title="collection.path"
            >
              {{ collection.label }}
            </span>
          </button>

          <div
            v-if="
              advancedMode
                && (
                  collection.canManage
                  || collection.canDelete
                )
            "
            class="bw-folder-row__actions"
          >
            <button
              v-if="collection.canManage"
              type="button"
              class="bw-folder-row__action"
              :title="t(
                'nc_bitwarden',
                'Rename collection {name}',
                { name: collection.path },
              )"
              :aria-label="t(
                'nc_bitwarden',
                'Rename collection {name}',
                { name: collection.path },
              )"
              @click.stop="$emit('edit-collection', collection)"
            >
              <PencilOutlineIcon :size="16" />
            </button>

            <button
              v-if="collection.canDelete"
              type="button"
              class="bw-folder-row__action"
              :title="t(
                'nc_bitwarden',
                'Delete collection {name}',
                { name: collection.path },
              )"
              :aria-label="t(
                'nc_bitwarden',
                'Delete collection {name}',
                { name: collection.path },
              )"
              @click.stop="$emit('delete-collection', collection)"
            >
              <DeleteOutlineIcon :size="16" />
            </button>
          </div>

          <span
            class="
              bw-folder__count
              bw-folder-row__count
            "
          >
            {{ collectionCount(collection.id) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="bw-vault__footer">
      <NcButton
        v-if="advancedMode"
        @click="$emit('generate-password')"
      >
        <template #icon>
          <KeyOutlineIcon :size="16" />
        </template>
        {{ t('nc_bitwarden', 'Generate password') }}
      </NcButton>

      <NcButton @click="$emit('settings')">
        <template #icon>
          <CogOutlineIcon :size="16" />
        </template>
        {{ t('nc_bitwarden', 'Settings') }}
      </NcButton>

      <NcButton @click="$emit('logout')">
        <template #icon>
          <LogoutIcon :size="16" />
        </template>
        {{ t('nc_bitwarden', 'Log out') }}
      </NcButton>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import ViewListOutlineIcon from 'vue-material-design-icons/ViewListOutline.vue'
import StarOutlineIcon from 'vue-material-design-icons/StarOutline.vue'
import KeyOutlineIcon from 'vue-material-design-icons/KeyOutline.vue'
import NoteTextOutlineIcon from 'vue-material-design-icons/NoteTextOutline.vue'
import CreditCardOutlineIcon from 'vue-material-design-icons/CreditCardOutline.vue'
import IdentityOutlineIcon from 'vue-material-design-icons/CardAccountDetailsOutline.vue'
import FolderOutlineIcon from 'vue-material-design-icons/FolderOutline.vue'
import ArchiveOutlineIcon from 'vue-material-design-icons/ArchiveOutline.vue'
import ChevronRightIcon from 'vue-material-design-icons/ChevronRight.vue'
import ChevronDownIcon from 'vue-material-design-icons/ChevronDown.vue'
import PencilOutlineIcon from 'vue-material-design-icons/PencilOutline.vue'
import DeleteOutlineIcon from 'vue-material-design-icons/DeleteOutline.vue'
import MagnifyIcon from 'vue-material-design-icons/Magnify.vue'
import FilterOutlineIcon from 'vue-material-design-icons/FilterOutline.vue'
import CloseIcon from 'vue-material-design-icons/Close.vue'
import AccountOutlineIcon from 'vue-material-design-icons/AccountOutline.vue'
import DomainIcon from 'vue-material-design-icons/Domain.vue'
import PlusIcon from 'vue-material-design-icons/Plus.vue'
import CogOutlineIcon from 'vue-material-design-icons/CogOutline.vue'
import LogoutIcon from 'vue-material-design-icons/Logout.vue'
import {
  collectionMatchesQuery,
  normalizeCollectionSearch,
} from '../utils/collectionSearch.js'
import {
  createVaultSearchIndex,
  normalizeVaultSearch,
} from '../utils/vaultSearch.js'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
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
  advancedMode: {
    type: Boolean,
    required: true,
  },
  sortMode: {
    type: String,
    default: 'name-asc',
  },
  selectedId: {
    type: String,
    default: null,
  },
  startCategory: {
    type: String,
    default: 'all',
  },
  navigationStartMode: {
    type: String,
    default: 'personal_expanded',
  },
})
const emit = defineEmits([
  'logout',
  'generate-password',
  'settings',
  'filter-change',
  'show-search-results',
  'navigate',
  'create-folder',
  'edit-folder',
  'delete-folder',
  'create-collection',
  'edit-collection',
  'delete-collection',
  'drop-folder',
  'drop-collection',
])

const START_CATEGORIES = new Set([
  'all',
  'favorites',
  'logins',
  'totp',
  'ssh-keys',
  'notes',
  'cards',
  'identities',

  'trash',
])

const NAVIGATION_MODES = new Set([
  'last_used',
  'collapsed',
  'personal_expanded',
  'collections_expanded',
  'expanded',
])

function initialCategory() {
  return START_CATEGORIES.has(props.startCategory)
    ? props.startCategory
    : 'all'
}

function initialNavigationMode() {
  return NAVIGATION_MODES.has(
    props.navigationStartMode,
  )
    ? props.navigationStartMode
    : 'last_used'
}

const NAVIGATION_STATE_STORAGE_KEY =
  'nc_bitwarden.navigation_sections.v1'

const NAVIGATION_SELECTION_STORAGE_KEY =
  'nc_bitwarden.navigation_selection.v1'

function readStoredNavigationSections() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = window.localStorage.getItem(
      NAVIGATION_STATE_STORAGE_KEY,
    )

    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored)

    if (
      typeof parsed?.folders !== 'boolean'
      || typeof parsed?.collections !== 'boolean'
    ) {
      return null
    }

    const storedCollectionPaths =
      Array.isArray(parsed.collapsedCollectionPaths)
        ? [
          ...new Set(
            parsed.collapsedCollectionPaths
              .map(value =>
                String(value ?? '').trim(),
              )
              .filter(Boolean),
          ),
        ]
        : null

    return {
      folders: parsed.folders,
      collections: parsed.collections,
      collapsedCollectionPaths: storedCollectionPaths,
      selectedCategory:
        typeof parsed.selectedCategory === 'string'
          ? parsed.selectedCategory
          : null,
      selectedFolder:
        parsed.selectedFolder === null
        || typeof parsed.selectedFolder === 'string'
          ? parsed.selectedFolder
          : null,
      selectedCollection:
        parsed.selectedCollection === null
        || typeof parsed.selectedCollection === 'string'
          ? parsed.selectedCollection
          : null,
    }
  } catch {
    return null
  }
}

function navigationSectionsForMode(mode) {
  if (mode === 'last_used') {
    return readStoredNavigationSections() ?? {
      folders: false,
      collections: true,
    }
  }

  if (mode === 'collapsed') {
    return {
      folders: true,
      collections: true,
    }
  }

  if (mode === 'collections_expanded') {
    return {
      folders: true,
      collections: false,
    }
  }

  if (mode === 'expanded') {
    return {
      folders: false,
      collections: false,
    }
  }

  return {
    folders: false,
    collections: true,
  }
}

function storeNavigationSections(
  sections,
  collectionPaths,
) {
  if (
    typeof window === 'undefined'
    || props.navigationStartMode !== 'last_used'
  ) {
    return
  }

  const normalizedCollectionPaths = [
    ...new Set(
      [...(collectionPaths ?? [])]
        .map(value =>
          String(value ?? '').trim(),
        )
        .filter(Boolean),
    ),
  ].sort()

  const storedState =
    readStoredNavigationSections() ?? {}

  try {
    window.localStorage.setItem(
      NAVIGATION_STATE_STORAGE_KEY,
      JSON.stringify({
        ...storedState,
        folders: Boolean(sections.folders),
        collections: Boolean(sections.collections),
        collapsedCollectionPaths:
          normalizedCollectionPaths,
      }),
    )
  } catch {
    // Navigation state persistence is optional.
  }
}

function currentNextcloudUserId() {
  if (typeof document === 'undefined') {
    return null
  }

  return document.head?.getAttribute('data-user')
    ?? null
}

function readStoredNavigationSelection() {
  if (
    typeof window === 'undefined'
    || props.navigationStartMode !== 'last_used'
  ) {
    return null
  }

  const userId = currentNextcloudUserId()

  if (!userId) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(
      NAVIGATION_SELECTION_STORAGE_KEY,
    )

    if (raw) {
      const parsed = JSON.parse(raw)

      if (
        parsed?.version === 1
        && parsed.userId === userId
      ) {
        return {
          selectedCategory:
            typeof parsed.selectedCategory === 'string'
              ? parsed.selectedCategory
              : null,
          selectedFolder:
            parsed.selectedFolder === null
            || typeof parsed.selectedFolder === 'string'
              ? parsed.selectedFolder
              : null,
          selectedCollection:
            parsed.selectedCollection === null
            || typeof parsed.selectedCollection === 'string'
              ? parsed.selectedCollection
              : null,
        }
      }
    }

    /*
     * Import the selection stored by the previous implementation.
     * It is used only until the dedicated storage key is written.
     */
    const legacyState =
      readStoredNavigationSections()

    if (!legacyState) {
      return null
    }

    if (
      legacyState.selectedCategory === null
      && legacyState.selectedFolder === null
      && legacyState.selectedCollection === null
    ) {
      return null
    }

    return {
      selectedCategory:
        legacyState.selectedCategory,
      selectedFolder:
        legacyState.selectedFolder,
      selectedCollection:
        legacyState.selectedCollection,
    }
  } catch {
    return null
  }
}

const search = ref('')
const searchScope = ref('both')
const selectedFolder = ref(null)
const selectedCollection = ref(null)
const selectedCategory = ref(initialCategory())

function storeNavigationSelection() {
  if (
    typeof window === 'undefined'
    || props.navigationStartMode !== 'last_used'
  ) {
    return
  }

  const userId = currentNextcloudUserId()

  if (!userId) {
    return
  }

  try {
    window.localStorage.setItem(
      NAVIGATION_SELECTION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId,
        selectedCategory: selectedCategory.value,
        selectedFolder: selectedFolder.value,
        selectedCollection: selectedCollection.value,
      }),
    )
  } catch {
    // Navigation selection persistence is optional.
  }
}

const collapsedCollectionPaths = ref(new Set())
const collectionSearch = ref('')
const categoryMenu = ref(null)
const navigationInitialized = ref(false)
const navigationSelectionInitialized = ref(false)
const dropTargetKey = ref('')

watch(
  () => props.advancedMode,
  advancedMode => {
    if (advancedMode) {
      return
    }

    collectionSearch.value = ''
  },
  {
    immediate: true,
  },
)

const initialNavigationSections =
  navigationSectionsForMode(initialNavigationMode())

const collapsedSections = ref({
  folders: initialNavigationSections.folders,
  collections: initialNavigationSections.collections,
})

const folderSectionToggleLabel = computed(() =>
  collapsedSections.value.folders
    ? t('nc_bitwarden', 'Expand folders section')
    : t('nc_bitwarden', 'Collapse folders section'),
)

const categories = [
  {
    id: 'all',
    label: t('nc_bitwarden', 'All items'),
    icon: ViewListOutlineIcon,
  },
  {
    id: 'favorites',
    label: t('nc_bitwarden', 'Favorites'),
    icon: StarOutlineIcon,
  },
  {
    id: 'logins',
    label: t('nc_bitwarden', 'Logins'),
    icon: KeyOutlineIcon,
  },
  {
    id: 'totp',
    label: t('nc_bitwarden', 'TOTP'),
    icon: KeyOutlineIcon,
  },
  {
    id: 'ssh-keys',
    label: t('nc_bitwarden', 'SSH keys'),
    icon: KeyOutlineIcon,
  },
  {
    id: 'notes',
    label: t('nc_bitwarden', 'Secure notes'),
    icon: NoteTextOutlineIcon,
  },
  {
    id: 'cards',
    label: t('nc_bitwarden', 'Cards'),
    icon: CreditCardOutlineIcon,
  },
  {
    id: 'identities',
    label: t('nc_bitwarden', 'Identities'),
    icon: IdentityOutlineIcon,
  },

  {
    id: 'trash',
    label: t('nc_bitwarden', 'Trash'),
    icon: DeleteOutlineIcon,
  },
]

const activeCategory = computed(() =>
  categories.find(category =>
    category.id === selectedCategory.value,
  ) ?? categories[0],
)

const STANDARD_CATEGORY_IDS = new Set([
  'all',
  'favorites',
  'logins',
  'totp',
  'notes',
])

const visibleCategories = computed(() => (
  props.advancedMode
    ? categories
    : categories.filter(category =>
        STANDARD_CATEGORY_IDS.has(category.id),
      )
))

watch(
  [
    () => props.advancedMode,
    selectedCategory,
  ],
  ([advancedMode, category]) => {
    if (
      !advancedMode
      && !STANDARD_CATEGORY_IDS.has(category)
    ) {
      selectCategory('all')
    }
  },
  {
    immediate: true,
  },
)

const nameCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
})

function normalizeId(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value).trim().toLowerCase()
}

function normalizePath(value) {
  return String(value ?? '')
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .join('/')
}

const canCreateCollection = computed(() =>
  (props.organizations ?? []).some(
    organization => organization.canCreateCollections,
  ),
)

const sortedFolders = computed(() => {
  return [...(props.folders ?? [])].sort((a, b) =>
    nameCollator.compare(a.name ?? '', b.name ?? ''),
  )
})

const allCollectionRows = computed(() => {
  const rows = (props.collections ?? [])
    .map(collection => {
      const path = normalizePath(collection.name)
      const parts = path ? path.split('/') : ['(ohne Name)']
      const organizationId = normalizeId(collection.organizationId) ?? ''

      return {
        ...collection,
        path,
        label: parts[parts.length - 1],
        depth: Math.max(parts.length - 1, 0),
        nodeKey: `${organizationId}:${path}`,
      }
    })
    .sort((a, b) => {
      const organizationDifference = nameCollator.compare(
        normalizeId(a.organizationId) ?? '',
        normalizeId(b.organizationId) ?? '',
      )

      return organizationDifference || nameCollator.compare(a.path, b.path)
    })

  return rows.map(row => ({
    ...row,
    hasChildren: rows.some(candidate =>
      normalizeId(candidate.organizationId)
        === normalizeId(row.organizationId)
      && candidate.path !== row.path
      && candidate.path.startsWith(`${row.path}/`),
    ),
  }))
})

const collectionBranchKeys = computed(() =>
  allCollectionRows.value
    .filter(collection => collection.hasChildren)
    .map(collection => collection.nodeKey),
)

const hasNestedCollections = computed(() =>
  collectionBranchKeys.value.length > 0,
)

const allCollectionBranchesCollapsed = computed(() =>
  hasNestedCollections.value
  && collectionBranchKeys.value.every(key =>
    collapsedCollectionPaths.value.has(key),
  ),
)

const collectionSectionToggleLabel = computed(() =>
  allCollectionBranchesCollapsed.value
    ? t('nc_bitwarden', 'Expand all subcollections')
    : t('nc_bitwarden', 'Collapse all subcollections'),
)

const normalizedCollectionQuery = computed(() =>
  normalizeCollectionSearch(collectionSearch.value),
)

const collectionMatchCount = computed(() => {
  if (!normalizedCollectionQuery.value) {
    return allCollectionRows.value.length
  }

  return allCollectionRows.value.filter(row =>
    collectionMatchesQuery(
      row,
      normalizedCollectionQuery.value,
    ),
  ).length
})

const collectionRows = computed(() => {
  const rows = allCollectionRows.value

  if (normalizedCollectionQuery.value) {
    const visibleKeys = new Set()

    rows
      .filter(row =>
        collectionMatchesQuery(
          row,
          normalizedCollectionQuery.value,
        ),
      )
      .forEach(row => {
        visibleKeys.add(row.nodeKey)

        const parts = row.path.split('/')
        const organizationId =
          normalizeId(row.organizationId) ?? ''

        for (
          let depth = 1;
          depth < parts.length;
          depth += 1
        ) {
          visibleKeys.add(
            `${organizationId}:${parts
              .slice(0, depth)
              .join('/')}`,
          )
        }
      })

    return rows.filter(row =>
      visibleKeys.has(row.nodeKey),
    )
  }

  return rows.filter(row => {
    const parts = row.path.split('/')
    const organizationId =
      normalizeId(row.organizationId) ?? ''

    for (
      let depth = 1;
      depth < parts.length;
      depth += 1
    ) {
      const ancestorPath =
        parts.slice(0, depth).join('/')
      const ancestorKey =
        `${organizationId}:${ancestorPath}`

      if (
        collapsedCollectionPaths.value.has(
          ancestorKey,
        )
      ) {
        return false
      }
    }

    return true
  })
})

function draggedItemIds(event) {
  const customData = event.dataTransfer?.getData(
    'application/x-warden-item-ids',
  )

  if (customData) {
    try {
      const parsed = JSON.parse(customData)

      if (Array.isArray(parsed)) {
        return parsed
          .map(value => String(value ?? '').trim())
          .filter(Boolean)
      }
    } catch {
      // Fall back to text/plain below.
    }
  }

  return String(
    event.dataTransfer?.getData('text/plain') ?? '',
  )
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
}

function draggedItems(event) {
  const ids = new Set(
    draggedItemIds(event)
      .map(normalizeId)
      .filter(Boolean),
  )

  if (!ids.size) {
    return []
  }

  return (props.items ?? []).filter(item =>
    ids.has(normalizeId(item.id)),
  )
}

function canDropOnFolder(event) {
  const dragged = draggedItems(event)

  return (
    dragged.length > 0
    && dragged.every(item =>
      normalizeId(item.organizationId) === null,
    )
  )
}

function canDropOnCollection(event, collection) {
  /*
   * Während dragenter/dragover darf der Drag-Payload noch
   * nicht ausgewertet werden. Chrome liefert getData() dort
   * teilweise leer zurück und würde dadurch das Ziel sperren.
   *
   * IDs und Besitzer werden erst beim tatsächlichen Drop
   * geprüft.
   */
  return normalizeId(
    collection?.organizationId,
  ) !== null
}

function rejectDrop(event) {
  dropTargetKey.value = ''

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'none'
  }
}

function allowDrop(event) {
  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function activateFolderDropTarget(event, key) {
  if (!canDropOnFolder(event)) {
    rejectDrop(event)
    return
  }

  allowDrop(event)
  dropTargetKey.value = key
}

function allowFolderDrop(event) {
  if (!canDropOnFolder(event)) {
    rejectDrop(event)
    return
  }

  allowDrop(event)
}

function activateCollectionDropTarget(event, collection) {
  if (!canDropOnCollection(event, collection)) {
    rejectDrop(event)
    return
  }

  allowDrop(event)
  dropTargetKey.value =
    `collection:${normalizeId(collection.id)}`
}

function allowCollectionDrop(event, collection) {
  if (!canDropOnCollection(event, collection)) {
    rejectDrop(event)
    return
  }

  allowDrop(event)
}

function clearDropTarget(event) {
  if (
    !event.currentTarget.contains(
      event.relatedTarget,
    )
  ) {
    dropTargetKey.value = ''
  }
}

function dropOnFolder(event, folderId) {
  const itemIds = draggedItemIds(event)
  const valid = canDropOnFolder(event)

  dropTargetKey.value = ''

  if (!valid || !itemIds.length) {
    return
  }

  event.preventDefault()

  emit('drop-folder', {
    itemIds,
    folderId: folderId || null,
  })
}

function dropOnCollection(event, collection) {
  const itemIds = draggedItemIds(event)
  const valid = canDropOnCollection(event, collection)

  dropTargetKey.value = ''

  if (!valid || !itemIds.length) {
    return
  }

  event.preventDefault()

  emit('drop-collection', {
    itemIds,
    collection,
  })
}

function selectCategory(categoryId) {
  selectedCategory.value = categoryId
  selectedFolder.value = null
  selectedCollection.value = null

  if (categoryMenu.value) {
    categoryMenu.value.open = false
  }

  storeNavigationSelection()
  emit('navigate')
}

function selectFolder(folderId) {
  selectedFolder.value = folderId === '__none__'
    ? '__none__'
    : normalizeId(folderId)

  selectedCollection.value = null
  selectedCategory.value = 'all'

  storeNavigationSelection()
  emit('navigate')
}

function selectCollection(collectionId) {
  selectedCollection.value = normalizeId(collectionId)
  selectedFolder.value = null
  selectedCategory.value = 'all'

  storeNavigationSelection()
  emit('navigate')
}

function toggleSection(section) {
  const nextSections = {
    ...collapsedSections.value,
    [section]: !collapsedSections.value[section],
  }

  collapsedSections.value = nextSections

  storeNavigationSections(
    nextSections,
    collapsedCollectionPaths.value,
  )
}

function releasePointerFocus(event) {
  event.currentTarget?.blur()
}

function toggleCollectionBranches() {
  const collapsing = !allCollectionBranchesCollapsed.value
  const nextSections = {
    ...collapsedSections.value,
    collections: collapsing,
  }

  collapsedCollectionPaths.value = collapsing
    ? new Set(collectionBranchKeys.value)
    : new Set()

  collapsedSections.value = nextSections

  storeNavigationSections(
    nextSections,
    collapsedCollectionPaths.value,
  )
}

function toggleCollection(collection) {
  if (!collection.hasChildren) {
    selectCollection(collection.id)
    return
  }

  const paths = new Set(
    collapsedCollectionPaths.value,
  )

  if (paths.has(collection.nodeKey)) {
    paths.delete(collection.nodeKey)

    allCollectionRows.value
      .filter(candidate => (
        candidate.hasChildren
        && normalizeId(candidate.organizationId)
          === normalizeId(collection.organizationId)
        && candidate.path !== collection.path
        && candidate.path.startsWith(
          `${collection.path}/`,
        )
      ))
      .forEach(candidate => {
        paths.add(candidate.nodeKey)
      })
  } else {
    paths.add(collection.nodeKey)
  }

  collapsedCollectionPaths.value = paths

  storeNavigationSections(
    collapsedSections.value,
    collapsedCollectionPaths.value,
  )
}

function isCollectionCollapsed(collection) {
  return collapsedCollectionPaths.value.has(collection.nodeKey)
}

function isDeletedItem(item) {
  return Boolean(
    item?.deletedDate
    ?? item?.DeletedDate,
  )
}

function categoryMatches(item, categoryId) {
  const deleted = isDeletedItem(item)

  if (categoryId === 'trash') {
    return deleted
  }

  if (deleted) {
    return false
  }

  switch (categoryId) {
    case 'favorites':
      return Boolean(item.favorite)
    case 'logins':
      return Number(item.type) === 1
    case 'totp':
      return (
        Number(item.type) === 1
        && Boolean(
          String(item.login?.totp ?? '').trim(),
        )
      )
    case 'ssh-keys':
      return Number(item.type) === 5
    case 'notes':
      return Number(item.type) === 2
    case 'cards':
      return Number(item.type) === 3
    case 'identities':
      return Number(item.type) === 4
    case 'all':
    default:
      return true
  }
}

function categoryCount(categoryId) {
  return (props.items ?? []).filter(item =>
    categoryMatches(item, categoryId),
  ).length
}

function folderCount(folderId) {
  const normalizedFolderId = normalizeId(folderId)

  return (props.items ?? []).filter(item =>
    !isDeletedItem(item)
    && normalizeId(item.folderId)
      === normalizedFolderId,
  ).length
}

function itemBelongsToCollection(item, collectionId) {
  const normalizedCollectionId = normalizeId(collectionId)

  return (item.collectionIds ?? []).some(itemCollectionId =>
    normalizeId(itemCollectionId) === normalizedCollectionId,
  )
}

function collectionCount(collectionId) {
  return (props.items ?? []).filter(item =>
    !isDeletedItem(item)
    && itemBelongsToCollection(
      item,
      collectionId,
    ),
  ).length
}

function compareName(a, b) {
  return nameCollator.compare(a.name ?? '', b.name ?? '')
}

function revisionTimestamp(item) {
  const timestamp = Date.parse(item.revisionDate ?? '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const normalizedSearchTerm = computed(() =>
  normalizeVaultSearch(search.value),
)

/*
 * Decrypted item text changes only when the vault data changes. Keeping
 * this index separate prevents rebuilding all searchable fields for every
 * character typed into the search box.
 */
const searchIndex = computed(() =>
  createVaultSearchIndex(props.items),
)

function showSearchResults() {
  if (!normalizedSearchTerm.value) {
    return
  }

  emit('show-search-results')
}

function searchScopeMatches(item) {
  const organizationId = normalizeId(
    item.organizationId,
  )

  if (searchScope.value === 'personal') {
    return organizationId === null
  }

  if (searchScope.value === 'organization') {
    return organizationId !== null
  }

  return true
}

const sortedItems = computed(() => {
  const list = [...(props.items ?? [])]

  switch (props.sortMode) {
    case 'name-desc':
      return list.sort((a, b) => compareName(b, a))

    case 'favorites':
      return list.sort((a, b) => {
        const favoriteDifference =
          Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))

        return favoriteDifference || compareName(a, b)
      })

    case 'modified-desc':
      return list.sort((a, b) =>
        revisionTimestamp(b) - revisionTimestamp(a)
        || compareName(a, b),
      )

    case 'modified-asc':
      return list.sort((a, b) =>
        revisionTimestamp(a) - revisionTimestamp(b)
        || compareName(a, b),
      )

    case 'name-asc':
    default:
      return list.sort(compareName)
  }
})

const filtered = computed(() => {
  let list = sortedItems.value

  const term = normalizedSearchTerm.value
  const searching = term.length > 0

  /*
   * Deleted entries remain isolated in the trash. A normal
   * global search must never surface deleted vault items merely
   * because another folder or collection is currently selected.
   */
  if (selectedCategory.value === 'trash') {
    list = list.filter(item =>
      isDeletedItem(item),
    )
  } else {
    list = list.filter(item =>
      !isDeletedItem(item),
    )
  }

  if (searching) {
    /*
     * Search is deliberately independent of navigation context.
     * The selected folder, collection or category is retained in
     * the sidebar, but does not restrict search results.
     */
    list = list.filter(item =>
      searchScopeMatches(item),
    )

    const indexedText = searchIndex.value

    list = list.filter(item =>
      indexedText.get(item)?.includes(term),
    )
  } else if (selectedCollection.value !== null) {
    list = list.filter(item =>
      itemBelongsToCollection(item, selectedCollection.value),
    )
  } else if (selectedFolder.value === '__none__') {
    list = list.filter(item =>
      normalizeId(item.folderId) === null,
    )
  } else if (selectedFolder.value !== null) {
    list = list.filter(item =>
      normalizeId(item.folderId) === selectedFolder.value,
    )
  } else {
    list = list.filter(item =>
      categoryMatches(item, selectedCategory.value),
    )
  }

  return list
})
const activeFilterLabel = computed(() => {
  if (normalizedSearchTerm.value) {
    return t(
      'nc_bitwarden',
      'Results: {count}',
      { count: filtered.value.length },
    )
  }

  if (selectedCollection.value !== null) {
    const collection = allCollectionRows.value.find(row =>
      normalizeId(row.id) === selectedCollection.value,
    )

    return collection?.path
      || collection?.label
      || t('nc_bitwarden', 'Collection')
  }

  if (selectedFolder.value === '__none__') {
    return t('nc_bitwarden', 'No personal folder')
  }

  if (selectedFolder.value !== null) {
    const folder = (props.folders ?? []).find(candidate =>
      normalizeId(candidate.id) === selectedFolder.value,
    )

    return folder?.name
      || t('nc_bitwarden', 'Personal folder')
  }

  return categories.find(category =>
    category.id === selectedCategory.value,
  )?.label || t('nc_bitwarden', 'All items')
})

const activeCreateContext = computed(() => {
  if (selectedCollection.value !== null) {
    const collection = allCollectionRows.value.find(row =>
      normalizeId(row.id) === selectedCollection.value,
    )

    if (collection && !collection.readOnly) {
      return {
        kind: 'collection',
        folderId: '',
        organizationId: String(
          collection.organizationId ?? '',
        ),
        collectionId: String(collection.id ?? ''),
      }
    }
  }

  if (selectedFolder.value !== null) {
    const folder = selectedFolder.value === '__none__'
      ? null
      : (props.folders ?? []).find(candidate =>
        normalizeId(candidate.id)
          === selectedFolder.value,
      )

    return {
      kind: 'folder',
      folderId: String(folder?.id ?? ''),
      organizationId: '',
      collectionId: '',
    }
  }

  return {
    kind: 'category',
    folderId: '',
    organizationId: '',
    collectionId: '',
  }
})

function closeCategoryMenuOnOutsidePointer(event) {
  if (
    categoryMenu.value?.open
    && !categoryMenu.value.contains(event.target)
  ) {
    categoryMenu.value.open = false
  }
}

onMounted(() => {
  document.addEventListener(
    'pointerdown',
    closeCategoryMenuOnOutsidePointer,
  )
})

onBeforeUnmount(() => {
  document.removeEventListener(
    'pointerdown',
    closeCategoryMenuOnOutsidePointer,
  )
})

watch(
  allCollectionRows,
  rows => {
    /*
     * During login and logout the collection list is temporarily
     * empty. Do not initialize, clean, or persist the tree state
     * until the actual collection data is available.
     */
    if (rows.length === 0) {
      return
    }

    const validCollapsedPaths = new Set(
      rows
        .filter(collection =>
          collection.hasChildren,
        )
        .map(collection =>
          collection.nodeKey,
        ),
    )

    if (navigationInitialized.value) {
      if (
        props.navigationStartMode === 'last_used'
      ) {
        const cleanedPaths = new Set(
          [...collapsedCollectionPaths.value]
            .filter(path =>
              validCollapsedPaths.has(path),
            ),
        )

        if (
          cleanedPaths.size
          !== collapsedCollectionPaths.value.size
        ) {
          collapsedCollectionPaths.value =
            cleanedPaths

          storeNavigationSections(
            collapsedSections.value,
            cleanedPaths,
          )
        }
      }

      return
    }

    const mode = initialNavigationMode()

    const storedState =
      mode === 'last_used'
        ? readStoredNavigationSections()
        : null

    if (
      mode === 'last_used'
      && Array.isArray(
        storedState?.collapsedCollectionPaths,
      )
    ) {
      collapsedCollectionPaths.value = new Set(
        storedState.collapsedCollectionPaths
          .filter(path =>
            validCollapsedPaths.has(path),
          ),
      )
    } else {
      const collectionTreeExpanded =
        mode === 'expanded'
        || mode === 'collections_expanded'
        || (
          mode === 'last_used'
          && !collapsedSections.value.collections
        )

      collapsedCollectionPaths.value =
        collectionTreeExpanded
          ? new Set()
          : validCollapsedPaths
    }

    navigationInitialized.value = true

    storeNavigationSections(
      collapsedSections.value,
      collapsedCollectionPaths.value,
    )
  },
  {
    immediate: true,
  },
)

watch(
  [
    allCollectionRows,
    () => props.folders,
  ],
  ([rows, nextFolders]) => {
    if (navigationSelectionInitialized.value) {
      return
    }

    if (props.navigationStartMode !== 'last_used') {
      navigationSelectionInitialized.value = true
      return
    }

    const storedState =
      readStoredNavigationSelection()

    if (!storedState) {
      navigationSelectionInitialized.value = true
      return
    }

    const storedCollectionId = normalizeId(
      storedState.selectedCollection,
    )

    const storedFolderId =
      storedState.selectedFolder === '__none__'
        ? '__none__'
        : normalizeId(storedState.selectedFolder)

    /*
     * VaultList is mounted before collections and folders have
     * finished loading. Wait for the required data before
     * deciding that a stored selection no longer exists.
     */
    if (
      storedCollectionId !== null
      && rows.length === 0
    ) {
      return
    }

    if (
      storedCollectionId === null
      && storedFolderId !== null
      && storedFolderId !== '__none__'
      && nextFolders.length === 0
    ) {
      return
    }

    if (
      storedCollectionId !== null
      && rows.some(row =>
        normalizeId(row.id) === storedCollectionId,
      )
    ) {
      selectedCollection.value = storedCollectionId
      selectedFolder.value = null
      selectedCategory.value = 'all'
    } else if (
      storedFolderId === '__none__'
      || (
        storedFolderId !== null
        && nextFolders.some(folder =>
          normalizeId(folder.id) === storedFolderId,
        )
      )
    ) {
      selectedFolder.value = storedFolderId
      selectedCollection.value = null
      selectedCategory.value = 'all'
    } else if (
      START_CATEGORIES.has(
        storedState.selectedCategory,
      )
    ) {
      selectedCategory.value =
        storedState.selectedCategory
      selectedFolder.value = null
      selectedCollection.value = null
    } else {
      selectedCategory.value = 'all'
      selectedFolder.value = null
      selectedCollection.value = null
    }

    navigationSelectionInitialized.value = true
  },
  {
    immediate: true,
  },
)

watch(
  () => props.folders,
  nextFolders => {
    if (
      selectedFolder.value === null
      || selectedFolder.value === '__none__'
    ) {
      return
    }

    /*
     * Folders are temporarily empty during login and logout.
     * Do not treat that transitional state as a deletion.
     */
    if (
      (nextFolders ?? []).length === 0
      && (props.items ?? []).length === 0
    ) {
      return
    }

    const folderStillExists = (nextFolders ?? []).some(folder =>
      normalizeId(folder.id) === selectedFolder.value,
    )

    if (!folderStillExists) {
      selectCategory('all')
    }
  },
  {
    deep: true,
  },
)

watch(
  () => props.collections,
  nextCollections => {
    if (selectedCollection.value === null) {
      return
    }

    /*
     * Collections are temporarily empty during login and logout.
     * Do not overwrite the saved selection in that state.
     */
    if (
      (nextCollections ?? []).length === 0
      && (props.items ?? []).length === 0
    ) {
      return
    }

    const collectionStillExists =
      (nextCollections ?? []).some(collection =>
        normalizeId(collection.id)
          === selectedCollection.value,
      )

    if (!collectionStillExists) {
      selectedCollection.value = null
      selectedFolder.value = null
      selectedCategory.value = 'all'

      emit('navigate')
    }
  },
  {
    deep: true,
  },
)

watch(
  [
    filtered,
    activeFilterLabel,
    activeCreateContext,
  ],
  ([filteredItems, label, createContext]) => {
    emit('filter-change', {
      items: [...filteredItems],
      label,
      createContext: { ...createContext },

      trash:
        selectedCategory.value === 'trash',
    })
  },
  {
    immediate: true,
    flush: 'sync',
  },
)

</script>

<style scoped>
.bw-vault {
  display:        flex;
  flex-direction: column;
  height:         100%;
  overflow:       hidden;
  background:     var(--color-navigation-bg, var(--color-main-background-translucent));
}

/* ── Suchleiste ── */
.bw-vault__search {
  padding: 0.75rem 0.75rem 0.5rem;
  border-bottom: 1px solid var(--color-primary-element);
  background: var(--color-primary-element-light);
}

.bw-vault__global-search-label {
  display: block;
  margin: 0 0 0.35rem 0.15rem;
  color: var(--color-main-text);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bw-vault__main-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--color-primary-element);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-vault__global-search-icon {
  flex: 0 0 auto;
  color: var(--color-primary-element);
}

.bw-vault__main-search input {
  min-width: 0;
  flex: 1;
  padding: 0.25rem 0.35rem;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-main-text);
}

.bw-vault__search-scope {
  flex: 0 0 auto;
  min-width: 8.4rem;
  padding: 0.25rem 0.35rem;
  border: 0;
  border-left: 1px solid var(--color-border);
  outline: 0;
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-vault__search-clear {
  display: flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-vault__search-clear:hover,
.bw-vault__search-clear:focus-visible {
  background: var(--color-background-hover);
}

.bw-vault__search-results {
  display: none;
}

.bw-vault__navigation {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  border-bottom: 1px solid var(--color-border);
}

.bw-vault__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  padding-right: 0.5rem;
}

.bw-vault__section-toggle {
  display: flex;
  min-width: 0;
  min-height: 32px;
  flex: 1;
  align-items: center;
  gap: 0.15rem;
  padding: 0 0 0 0.5rem;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
  text-align: left;
  box-shadow: none;
  user-select: none;
}

.bw-vault__section-toggle:hover,
.bw-vault__section-toggle:focus-visible {
  background: var(--color-background-hover);
}

.bw-vault__section-toggle:focus:not(:focus-visible) {
  outline: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

.bw-vault__section-title {
  padding: 0.35rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-maxcontrast);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bw-vault__section-action {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-vault__section-action:hover {
  background: var(--color-background-hover);
}

.bw-collection-search {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.2rem 0.6rem 0.45rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-collection-search input {
  min-width: 0;
  flex: 1;
  padding: 0.1rem;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-main-text);
}

.bw-collection-search button {
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  cursor: pointer;
}

.bw-collection-search button:hover {
  background: var(--color-background-hover);
}

.bw-collection-search__summary {
  padding: 0 0.75rem 0.35rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.72rem;
}

.bw-folder__icon {
  display: flex;
  width: 18px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.bw-collection__toggle {
  display: flex;
  width: 18px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.bw-collection__toggle--empty {
  cursor: default;
}

.bw-collection__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Kompakter Kategorienfilter ── */
.bw-vault__categories {
  position: relative;
  z-index: 4;
  padding: 0.35rem 0 0.55rem;
}

.bw-vault__section-title--static {
  display: block;
  padding-left: 0.75rem;
}

.bw-category-select {
  position: relative;
  margin: 0.1rem 0.5rem 0;
}

.bw-category-select summary {
  list-style: none;
}

.bw-category-select summary::-webkit-details-marker {
  display: none;
}

.bw-category-select__current {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.55rem 0.4rem 0.7rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  outline: none;
  background: var(--color-main-background);
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-category-select__current:hover,
.bw-category-select__current:focus-visible {
  border-color: var(--color-primary-element);
  background: var(--color-background-hover);
}

.bw-category-select__icon {
  display: flex;
  width: 18px;
  flex: 0 0 18px;
  align-items: center;
  justify-content: center;
}

.bw-category-select__label {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-category-select__chevron {
  flex: 0 0 auto;
  transition: transform 0.15s ease;
}

.bw-category-select[open] .bw-category-select__chevron {
  transform: rotate(180deg);
}

.bw-category-select__menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.3rem);
  right: 0;
  left: 0;
  overflow: visible;
  padding: 0.3rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius-large);
  background: var(--color-main-background);
  box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
}

.bw-category-select__option {
  display: flex;
  width: 100%;
  min-height: 36px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.45rem;
  border: 0;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
  font-size: 0.85rem;
  text-align: left;
}

.bw-category-select__option:hover,
.bw-category-select__option:focus-visible {
  background: var(--color-background-hover);
}

.bw-category-select__option--active {
  background: var(--color-primary-element-light);
  font-weight: 600;
}

.bw-category-select__option--trash {
  margin-top: 0.3rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 var(--border-radius) var(--border-radius);
}

/* ── Ordner ── */
.bw-vault__folders {
  padding:       0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

.bw-folder {
  display:        flex;
  align-items:    center;
  gap:            0.5rem;
  width:          100%;
  padding:        0.4rem 0.75rem;
  border:         none;
  background:     transparent;
  cursor:         pointer;
  color:          var(--color-main-text);
  font-size:      0.85rem;
  text-align:     left;
  border-radius:  var(--border-radius);
  transition:     background 0.1s;
}
.bw-folder:hover       { background: var(--color-background-hover); }
.bw-folder--active     { background: var(--color-primary-element-light); font-weight: 600; }
.bw-folder__count {
  margin-left:   auto;
  font-size:     0.75rem;
  color:         var(--color-text-maxcontrast);
  background:    var(--color-background-dark);
  border-radius: 10px;
  padding:       0 0.4rem;
}

.bw-folder__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-folder-row {
  display: flex;
  align-items: center;
  border-radius: var(--border-radius);
}

.bw-folder-row:hover {
  background: var(--color-background-hover);
}

.bw-folder-row--active {
  background: var(--color-primary-element-light);
  font-weight: 600;
}

.bw-folder--main {
  min-width: 0;
  flex: 1;
}

.bw-folder--main:hover,
.bw-folder--main:focus,
.bw-folder--main:active {
  border-color: transparent !important;
  outline: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

.bw-folder-row:has(> .bw-folder--main:focus-visible):not(
  .bw-folder-row--active
) {
  outline: 2px solid var(--color-primary-element);
  outline-offset: -2px;
}

.bw-folder-row__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.1rem;
  padding-right: 0.35rem;
}

.bw-folder-row__action {
  display: flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-text-maxcontrast);
  cursor: pointer;
}

.bw-folder-row__action:hover,
.bw-folder-row__action:focus-visible {
  background: var(--color-background-dark);
  color: var(--color-main-text);
}

.bw-drop-target--active {
  outline: 2px solid var(--color-primary-element);
  outline-offset: -2px;
  background: var(--color-primary-element-light) !important;
}

/* ── Footer ── */
.bw-vault__footer {
  display:       flex;
  flex-shrink:   0;
  gap:           0.5rem;
  padding:       0.75rem;
  border-top:    1px solid var(--color-border);
  background:    var(--color-navigation-bg, var(--color-main-background-translucent));
}

.bw-folder--active,
.bw-folder-row--active {
  box-shadow:
    inset 3px 0 0 var(--color-primary-element);
}

.bw-folder-row__actions {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.15s ease,
    visibility 0.15s ease;
}

.bw-folder-row:hover .bw-folder-row__actions,
.bw-folder-row:focus-within .bw-folder-row__actions,
.bw-folder-row--active .bw-folder-row__actions {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.bw-vault__section-action {
  opacity: 0.55;
  transition: opacity 0.15s ease;
}

.bw-vault__section-heading:hover
  .bw-vault__section-action,
.bw-vault__section-heading:focus-within
  .bw-vault__section-action {
  opacity: 1;
}

@media (hover: none), (pointer: coarse) {
  .bw-folder-row__actions {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .bw-vault__section-action {
    opacity: 1;
  }
}

/*
 * Editable folder and collection rows:
 * name | actions | count
 */
.bw-folder-row__actions {
  padding-right: 0 !important;
}

.bw-folder-row__count {
  min-width: 1.7rem;
  flex: 0 0 auto;
  margin-right: 0.75rem;
  margin-left: 0.2rem;
  text-align: center;
}

/*
 * The count remains visible while the action area follows the
 * existing hover/focus/active visibility rules.
 */
.bw-folder-row--active
  .bw-folder-row__count {
  color: var(--color-main-text);
}

.bw-collection-search {
  position: relative;
}

.bw-collection-search input[type="search"] {
  padding-right: 2.65rem !important;
}

.bw-collection-search input[type="search"]::-webkit-search-cancel-button {
  appearance: none;
  -webkit-appearance: none;
}

.bw-collection-search > button {
  position: absolute !important;
  top: 50%;
  right: 0.45rem;
  z-index: 3;

  display: inline-flex !important;
  align-items: center;
  justify-content: center;

  width: 28px;
  min-width: 28px;
  height: 28px;
  min-height: 28px;
  padding: 0 !important;
  margin: 0;

  border: 0 !important;
  border-radius: 50%;
  background: transparent !important;
  color: var(--color-main-text) !important;

  opacity: 0.72 !important;
  visibility: visible !important;
  pointer-events: auto !important;

  transform: translateY(-50%);
  cursor: pointer;
}

.bw-collection-search > button:hover,
.bw-collection-search > button:focus-visible {
  background: var(--color-background-hover) !important;
  color: var(--color-main-text) !important;
  opacity: 1 !important;
}

.bw-collection-search > button svg {
  display: block;
}

/* kompakte Hauptsuche mit Icon-Umschaltung */

.bw-vault__main-search {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.3rem;
}

.bw-vault__main-search input {
  width: auto;
  min-width: 0;
  max-width: none;
  flex: 1 1 auto;
  padding: 0.25rem 0.35rem;
}

.bw-vault__search-clear {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.bw-vault__scope-switch {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 2px;
  margin-left: auto;
  padding-left: 0.3rem;
  border-left: 1px solid var(--color-border);
}

.bw-vault__scope-button {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--border-radius);
  appearance: none;
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-vault__scope-button:hover,
.bw-vault__scope-button:focus-visible {
  background: var(--color-background-hover);
}

.bw-vault__scope-button--active {
  background: var(--color-primary-element);
  color:
    var(
      --color-primary-element-text,
      white
    );
}

.bw-vault__scope-button--active:hover,
.bw-vault__scope-button--active:focus-visible {
  background: var(--color-primary-element-hover);
}

.bw-vault__scope-both {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.bw-vault__scope-both > :last-child {
  margin-left: -3px;
}

@container warden (max-width: 760px) {
  .bw-vault__search-results {
    display: flex;
    width: 100%;
    min-height: 40px;
    align-items: center;
    justify-content: space-between;
    gap: 0.45rem;
    margin-top: 0.45rem;
    padding: 0.4rem 0.65rem;
    border: 1px solid var(--color-primary-element);
    border-radius: var(--border-radius);
    background: var(--color-primary-element-light);
    color: var(--color-main-text);
    font-weight: 600;
    cursor: pointer;
  }

  .bw-vault__search-results:hover,
  .bw-vault__search-results:focus-visible {
    background: var(--color-background-hover);
  }

  .bw-vault__search-results span {
    min-width: 0;
    flex: 1;
    text-align: left;
  }
}

</style>
