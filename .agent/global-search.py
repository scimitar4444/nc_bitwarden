#!/usr/bin/env python3
from pathlib import Path

path = Path('src/components/VaultList.vue')
text = path.read_text(encoding='utf-8')

old_scope = '''        <div
          v-if="advancedMode"
          class="bw-vault__scope-switch"'''
new_scope = '''        <div
          class="bw-vault__scope-switch"'''

if text.count(old_scope) != 1:
    raise SystemExit('Expected exactly one advanced-only search scope switch')
text = text.replace(old_scope, new_scope, 1)

old_reset = '''    searchScope.value = 'both'
    sortMode.value = 'name-asc' '''.rstrip()
new_reset = '''    sortMode.value = 'name-asc' '''.rstrip()

if text.count(old_reset) != 1:
    raise SystemExit('Expected exactly one search-scope reset in advanced-mode watcher')
text = text.replace(old_reset, new_reset, 1)

start = text.index('const filtered = computed(() => {')
end = text.index('const activeFilterLabel = computed(() => {', start)

replacement = '''const normalizedSearchTerm = computed(() => (
  search.value
    .trim()
    .toLocaleLowerCase()
))

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

const filtered = computed(() => {
  let list = [...(props.items ?? [])]

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

    list = list.filter(item =>
      searchableItemText(item).includes(term),
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

  switch (sortMode.value) {
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
'''

text = text[:start] + replacement + text[end:]

old_label = '''const activeFilterLabel = computed(() => {
  if (selectedCollection.value !== null) {'''
new_label = '''const activeFilterLabel = computed(() => {
  if (normalizedSearchTerm.value) {
    return t(
      'nc_bitwarden',
      'Results: {count}',
      { count: filtered.value.length },
    )
  }

  if (selectedCollection.value !== null) {'''

if text.count(old_label) != 1:
    raise SystemExit('Expected exactly one active filter label block')
text = text.replace(old_label, new_label, 1)

path.write_text(text, encoding='utf-8')
