export function nearestVisibleScrollOffset({
  itemIndex,
  itemHeight,
  scrollTop,
  viewportHeight,
}) {
  const currentOffset = Math.max(0, Number(scrollTop) || 0)
  const height = Math.max(0, Number(itemHeight) || 0)
  const viewport = Math.max(0, Number(viewportHeight) || 0)

  if (
    !Number.isInteger(itemIndex)
    || itemIndex < 0
    || height === 0
    || viewport === 0
  ) {
    return currentOffset
  }

  const itemTop = itemIndex * height
  const itemBottom = itemTop + height
  const viewportBottom = currentOffset + viewport

  if (itemTop < currentOffset) {
    return itemTop
  }

  if (itemBottom > viewportBottom) {
    return Math.max(0, itemBottom - viewport)
  }

  return currentOffset
}
