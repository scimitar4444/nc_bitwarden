import assert from 'node:assert/strict'
import test from 'node:test'

import {
  favoriteUpdatePayload,
  updateFavoriteInItems,
} from '../src/utils/favorite.js'

test('favorite updates preserve the current folder assignment', () => {
  assert.deepEqual(
    favoriteUpdatePayload(
      {
        id: 'cipher-1',
        folderId: 'folder-1',
      },
      true,
    ),
    {
      folderId: 'folder-1',
      favorite: true,
    },
  )

  assert.deepEqual(
    favoriteUpdatePayload({ id: 'cipher-2' }, false),
    {
      folderId: null,
      favorite: false,
    },
  )
})

test('favorite state is patched without changing other items', () => {
  const unchanged = {
    id: 'cipher-1',
    favorite: false,
  }
  const changed = {
    id: 'CIPHER-2',
    name: 'Example',
    favorite: false,
  }

  const result = updateFavoriteInItems(
    [unchanged, changed],
    'cipher-2',
    true,
  )

  assert.equal(result[0], unchanged)
  assert.notEqual(result[1], changed)
  assert.deepEqual(result[1], {
    id: 'CIPHER-2',
    name: 'Example',
    favorite: true,
  })
})
