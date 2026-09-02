import assert from 'node:assert/strict'
import test from 'node:test'

import {
  nearestVisibleScrollOffset,
} from '../src/utils/virtualListScroll.js'

test('visible virtual-list items keep the current scroll position', () => {
  assert.equal(
    nearestVisibleScrollOffset({
      itemIndex: 7,
      itemHeight: 60,
      scrollTop: 300,
      viewportHeight: 300,
    }),
    300,
  )
})

test('virtual-list items outside the viewport move only to its nearest edge', () => {
  assert.equal(
    nearestVisibleScrollOffset({
      itemIndex: 3,
      itemHeight: 60,
      scrollTop: 300,
      viewportHeight: 300,
    }),
    180,
  )

  assert.equal(
    nearestVisibleScrollOffset({
      itemIndex: 12,
      itemHeight: 60,
      scrollTop: 300,
      viewportHeight: 300,
    }),
    480,
  )
})
