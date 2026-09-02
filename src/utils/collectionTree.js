import {
  normalizeCollectionPath,
} from './collectionSearch.js'

function normalizeOrganizationId(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value).trim().toLowerCase()
}

export function buildCollectionTreeRows(collections) {
  const actualRows = (collections ?? []).map(collection => {
    const path = normalizeCollectionPath(collection.name)
    const parts = path ? path.split('/') : ['(ohne Name)']
    const organizationId =
      normalizeOrganizationId(collection.organizationId)

    return {
      ...collection,
      path,
      label: parts[parts.length - 1],
      depth: Math.max(parts.length - 1, 0),
      nodeKey: `${organizationId}:${path}`,
      isVirtual: false,
    }
  })

  const rowsByKey = new Map(
    actualRows.map(row => [row.nodeKey, row]),
  )

  actualRows.forEach(row => {
    const parts = row.path.split('/').filter(Boolean)

    for (let depth = 1; depth < parts.length; depth += 1) {
      const path = parts.slice(0, depth).join('/')
      const organizationId =
        normalizeOrganizationId(row.organizationId)
      const nodeKey = `${organizationId}:${path}`

      if (rowsByKey.has(nodeKey)) {
        continue
      }

      rowsByKey.set(nodeKey, {
        id: null,
        organizationId: row.organizationId,
        name: path,
        path,
        label: parts[depth - 1],
        depth: depth - 1,
        nodeKey,
        isVirtual: true,
        canManage: false,
        canDelete: false,
      })
    }
  })

  const rows = [...rowsByKey.values()]

  return rows.map(row => ({
    ...row,
    hasChildren: rows.some(candidate =>
      normalizeOrganizationId(candidate.organizationId)
        === normalizeOrganizationId(row.organizationId)
      && candidate.path !== row.path
      && candidate.path.startsWith(`${row.path}/`),
    ),
  }))
}
