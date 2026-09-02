function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function favoriteUpdatePayload(item, favorite) {
  return {
    folderId: item?.folderId ?? null,
    favorite: Boolean(favorite),
  }
}

export function updateFavoriteInItems(
  items,
  itemId,
  favorite,
) {
  const normalizedItemId = normalizeId(itemId)

  return (items ?? []).map(item => (
    normalizeId(item?.id) === normalizedItemId
      ? {
        ...item,
        favorite: Boolean(favorite),
      }
      : item
  ))
}
