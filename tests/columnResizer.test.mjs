import assert from 'node:assert/strict'
import test from 'node:test'

import {
  defaultColumnWidths,
  fitColumnWidths,
} from '../src/services/columnResizer.js'

test('default column widths follow the available layout width', () => {
  assert.deepEqual(
    defaultColumnWidths(1600),
    {
      sidebar: 384,
      items: 480,
    },
  )

  assert.deepEqual(
    defaultColumnWidths(2000),
    {
      sidebar: 480,
      items: 600,
    },
  )
})

test('stored column widths shrink proportionally to preserve details', () => {
  const fitted = fitColumnWidths(
    {
      sidebar: 720,
      items: 720,
    },
    1200,
  )

  assert.deepEqual(fitted, {
    sidebar: 413,
    items: 413,
  })
})

test('fitted columns retain their minimum usable widths', () => {
  assert.deepEqual(
    fitColumnWidths(
      {
        sidebar: 720,
        items: 720,
      },
      700,
    ),
    {
      sidebar: 240,
      items: 240,
    },
  )
})

test('already fitting user widths remain unchanged', () => {
  assert.deepEqual(
    fitColumnWidths(
      {
        sidebar: 320,
        items: 480,
      },
      1600,
    ),
    {
      sidebar: 320,
      items: 480,
    },
  )
})
