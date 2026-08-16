const STORAGE_KEY = 'nc_bitwarden.column_widths.v1'
const DEFAULT_WIDTH = 400
const MIN_WIDTH = 240
const MAX_WIDTH = 720
const KEYBOARD_STEP = 16

function currentUserId() {
  if (typeof document === 'undefined') {
    return ''
  }

  return document.head?.getAttribute('data-user') ?? ''
}

function clampWidth(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return DEFAULT_WIDTH
  }

  return Math.max(
    MIN_WIDTH,
    Math.min(MAX_WIDTH, Math.round(numeric)),
  )
}

function readStoredWidths() {
  if (typeof window === 'undefined') {
    return null
  }

  const userId = currentUserId()

  if (!userId) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)

    if (
      parsed?.version !== 1
      || parsed.userId !== userId
    ) {
      return null
    }

    return {
      sidebar: clampWidth(parsed.sidebar),
      items: clampWidth(parsed.items),
    }
  } catch {
    return null
  }
}

function storeWidths(widths) {
  if (typeof window === 'undefined') {
    return
  }

  const userId = currentUserId()

  if (!userId) {
    return
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId,
        sidebar: clampWidth(widths.sidebar),
        items: clampWidth(widths.items),
      }),
    )
  } catch {
    // Column-width persistence is optional.
  }
}

function applyWidth(column, handle, value) {
  const width = clampWidth(value)
  const cssWidth = `${width}px`

  column.style.width = cssWidth
  column.style.minWidth = cssWidth
  column.style.maxWidth = cssWidth

  handle.setAttribute('aria-valuenow', String(width))

  return width
}

function createHandle({
  column,
  label,
  initialWidth,
  onCommit,
}) {
  const handle = document.createElement('div')

  handle.className = 'bw-column-resizer'
  handle.tabIndex = 0
  handle.setAttribute('role', 'separator')
  handle.setAttribute('aria-orientation', 'vertical')
  handle.setAttribute('aria-label', label)
  handle.setAttribute('aria-valuemin', String(MIN_WIDTH))
  handle.setAttribute('aria-valuemax', String(MAX_WIDTH))
  handle.title = label

  let width = applyWidth(
    column,
    handle,
    initialWidth,
  )

  function commit(nextWidth) {
    width = applyWidth(column, handle, nextWidth)
    onCommit(width)
  }

  handle.addEventListener('keydown', event => {
    let nextWidth = null

    if (event.key === 'ArrowLeft') {
      nextWidth = width - KEYBOARD_STEP
    } else if (event.key === 'ArrowRight') {
      nextWidth = width + KEYBOARD_STEP
    } else if (event.key === 'Home') {
      nextWidth = DEFAULT_WIDTH
    }

    if (nextWidth === null) {
      return
    }

    event.preventDefault()
    commit(nextWidth)
  })

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    const startX = event.clientX
    const startWidth = column.getBoundingClientRect().width
    const pointerId = event.pointerId

    handle.classList.add('bw-column-resizer--active')
    document.documentElement.classList.add(
      'bw-column-resizing',
    )

    handle.setPointerCapture(pointerId)

    const pointerMove = moveEvent => {
      if (moveEvent.pointerId !== pointerId) {
        return
      }

      width = applyWidth(
        column,
        handle,
        startWidth + moveEvent.clientX - startX,
      )
    }

    const finish = finishEvent => {
      if (finishEvent.pointerId !== pointerId) {
        return
      }

      handle.removeEventListener(
        'pointermove',
        pointerMove,
      )
      handle.removeEventListener('pointerup', finish)
      handle.removeEventListener('pointercancel', finish)

      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId)
      }

      handle.classList.remove(
        'bw-column-resizer--active',
      )
      document.documentElement.classList.remove(
        'bw-column-resizing',
      )

      onCommit(width)
    }

    handle.addEventListener('pointermove', pointerMove)
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
  })

  return handle
}

export function installColumnResizers(root) {
  if (
    !root
    || typeof MutationObserver !== 'function'
  ) {
    return () => {}
  }

  const stored = readStoredWidths()
  const widths = {
    sidebar: stored?.sidebar ?? DEFAULT_WIDTH,
    items: stored?.items ?? DEFAULT_WIDTH,
  }

  function commitWidth(name, width) {
    widths[name] = clampWidth(width)
    storeWidths(widths)
  }

  function setupLayout(layout) {
    if (layout.dataset.wardenResizers === '1') {
      return
    }

    const sidebar = layout.querySelector(
      ':scope > .bw-layout__sidebar',
    )
    const items = layout.querySelector(
      ':scope > .bw-layout__items',
    )

    if (!sidebar || !items) {
      return
    }

    const sidebarHandle = createHandle({
      column: sidebar,
      label: 'Breite der Navigationsspalte ändern',
      initialWidth: widths.sidebar,
      onCommit: width => commitWidth('sidebar', width),
    })

    const itemsHandle = createHandle({
      column: items,
      label: 'Breite der Eintragsspalte ändern',
      initialWidth: widths.items,
      onCommit: width => commitWidth('items', width),
    })

    sidebar.after(sidebarHandle)
    items.after(itemsHandle)
    layout.dataset.wardenResizers = '1'
  }

  function setup() {
    root.querySelectorAll('.bw-layout')
      .forEach(setupLayout)
  }

  const observer = new MutationObserver(setup)

  observer.observe(root, {
    childList: true,
    subtree: true,
  })

  setup()

  return () => {
    observer.disconnect()
    document.documentElement.classList.remove(
      'bw-column-resizing',
    )
  }
}
