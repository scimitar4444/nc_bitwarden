export async function mapSettledWithConcurrency(
  values,
  concurrency,
  mapper,
) {
  const items = Array.from(values ?? [])

  if (items.length === 0) {
    return []
  }

  if (typeof mapper !== 'function') {
    throw new TypeError('mapper must be a function')
  }

  const requestedLimit = Number(concurrency)
  const limit = Math.max(
    1,
    Math.min(
      items.length,
      Number.isFinite(requestedLimit)
        ? Math.floor(requestedLimit)
        : 1,
    ),
  )

  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1

      try {
        results[index] = {
          status: 'fulfilled',
          value: await mapper(items[index], index),
        }
      } catch (reason) {
        results[index] = {
          status: 'rejected',
          reason,
        }
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: limit },
      () => worker(),
    ),
  )

  return results
}
