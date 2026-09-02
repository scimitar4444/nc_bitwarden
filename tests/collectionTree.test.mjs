import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCollectionTreeRows,
} from '../src/utils/collectionTree.js'

test('missing collection path segments become virtual tree nodes', () => {
  const rows = buildCollectionTreeRows([
    {
      id: 'senso',
      organizationId: 'org-1',
      name: 'IT/Anwendersoftware/Sigma/Senso',
    },
  ])

  assert.deepEqual(
    rows.map(row => ({
      path: row.path,
      depth: row.depth,
      isVirtual: row.isVirtual,
      hasChildren: row.hasChildren,
    })),
    [
      {
        path: 'IT/Anwendersoftware/Sigma/Senso',
        depth: 3,
        isVirtual: false,
        hasChildren: false,
      },
      {
        path: 'IT',
        depth: 0,
        isVirtual: true,
        hasChildren: true,
      },
      {
        path: 'IT/Anwendersoftware',
        depth: 1,
        isVirtual: true,
        hasChildren: true,
      },
      {
        path: 'IT/Anwendersoftware/Sigma',
        depth: 2,
        isVirtual: true,
        hasChildren: true,
      },
    ],
  )
})

test('stored parent collections are not replaced by virtual nodes', () => {
  const rows = buildCollectionTreeRows([
    {
      id: 'it',
      organizationId: 'org-1',
      name: 'IT',
      canManage: true,
    },
    {
      id: 'senso',
      organizationId: 'org-1',
      name: 'IT/Senso',
    },
  ])

  const root = rows.find(row => row.path === 'IT')

  assert.equal(root.id, 'it')
  assert.equal(root.isVirtual, false)
  assert.equal(root.canManage, true)
  assert.equal(root.hasChildren, true)
})
