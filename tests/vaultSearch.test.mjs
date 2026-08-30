import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createVaultSearchIndex,
  normalizeVaultSearch,
  vaultItemSearchText,
} from '../src/utils/vaultSearch.js'

test('vault search normalization ignores case and surrounding whitespace', () => {
  assert.equal(
    normalizeVaultSearch('  Example.DE  '),
    'example.de',
  )
})

test('vault search text contains supported metadata but no passwords', () => {
  const searchText = vaultItemSearchText({
    name: 'Mission Login',
    notes: 'Accounting portal',
    login: {
      username: 'employee@example.de',
      password: 'must-not-be-searchable',
      uris: [
        { uri: 'https://portal.example.de' },
      ],
    },
    attachments: [
      { fileName: 'instructions.pdf' },
    ],
    fields: [
      {
        type: 0,
        name: 'Customer',
        value: 'Mission Leben',
      },
      {
        type: 1,
        name: 'PIN',
        value: 'must-stay-secret',
      },
    ],
  })

  assert.match(searchText, /mission login/u)
  assert.match(searchText, /employee@example\.de/u)
  assert.match(searchText, /portal\.example\.de/u)
  assert.match(searchText, /instructions\.pdf/u)
  assert.match(searchText, /mission leben/u)
  assert.doesNotMatch(searchText, /must-not-be-searchable/u)
  assert.doesNotMatch(searchText, /must-stay-secret/u)
})

test('vault search index reuses the prepared text for an item', () => {
  let nameReads = 0
  const item = {
    get name() {
      nameReads += 1
      return 'Indexed entry'
    },
  }

  const index = createVaultSearchIndex([item])

  assert.equal(index.get(item), 'indexed entry')
  assert.equal(index.get(item), 'indexed entry')
  assert.equal(nameReads, 1)
})
