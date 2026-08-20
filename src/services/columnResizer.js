const STORAGE_KEY = 'nc_bitwarden.column_widths.v1'
const DEFAULT_WIDTH = 400
const MIN_WIDTH = 240
const MAX_WIDTH = 720
const KEYBOARD_STEP = 16
const DETAIL_MIN_WIDTH = 360
const HANDLE_WIDTH = 7
const WIDE_LAYOUT_MIN_WIDTH = 1200

function currentUserId() {
  if (typeof document === 'undefined') {
    return ''
  }

  return document.head?.getAttribute('data-user') ?? ''
}

function clampWidth(value, maximum = MAX_WIDTH) {
  const numeric = Number(value)
  const safeMaximum = Math.max(
    MIN_WIDTH,
    Math.min(MAX_WIDTH, Math.round(maximum)),
  )

  if (!Number.isFinite(numeric)) {
    return Math.min(DEFAULT_WIDTH, safeMaximum)
  }

  return Math.max(
    MIN_WIDTH,
    Math.min(safeMaximum, Math.round(numeric)),
  )
}

export function fitColumnWidths(
  widths,
  layoutWidth,
) {
  const sidebar = clampWidth(widths?.sidebar)
  const items = clampWidth(widths?.items)
  const numericLayoutWidth = Number(layoutWidth)

  if (!Number.isFinite(numericLayoutWidth)) {
    return { sidebar, items }
  }

  const budget = Math.max(
    MIN_WIDTH * 2,
    Math.floor(
      numericLayoutWidth
      - DETAIL_MIN_WIDTH
      - HANDLE_WIDTH * 2,
    ),
  )

  if (sidebar + items <= budget) {
    return { sidebar, items }
  }

  const sidebarExtra = sidebar - MIN_WIDTH
  const itemsExtra = items - MIN_WIDTH
  const totalExtra = sidebarExtra + itemsExtra
  const availableExtra = Math.max(
    0,
    budget - MIN_WIDTH * 2,
  )
  const scale = totalExtra > 0
    ? Math.min(1, availableExtra / totalExtra)
    : 0
  const fittedSidebar = Math.round(
    MIN_WIDTH + sidebarExtra * scale,
  )

  return {
    sidebar: fittedSidebar,
    items: Math.max(
      MIN_WIDTH,
      budget - fittedSidebar,
    ),
  }
}

export function defaultColumnWidths(layoutWidth) {
  const numericLayoutWidth = Number(layoutWidth)

  if (!Number.isFinite(numericLayoutWidth)) {
    return {
      sidebar: DEFAULT_WIDTH,
      items: DEFAULT_WIDTH,
    }
  }

  return fitColumnWidths(
    {
      sidebar: numericLayoutWidth * 0.24,
      items: numericLayoutWidth * 0.3,
    },
    numericLayoutWidth,
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

function applyWidth(
  column,
  handle,
  value,
  maximum = MAX_WIDTH,
) {
  const safeMaximum = Math.max(
    MIN_WIDTH,
    Math.min(MAX_WIDTH, Math.round(maximum)),
  )
  const width = clampWidth(value, safeMaximum)
  const cssWidth = `${width}px`

  column.style.width = cssWidth
  column.style.minWidth = cssWidth
  column.style.maxWidth = cssWidth

  handle.setAttribute('aria-valuenow', String(width))
  handle.setAttribute(
    'aria-valuemax',
    String(safeMaximum),
  )

  return width
}

function createHandle({
  column,
  label,
  initialWidth,
  defaultWidth,
  maximumWidth,
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

  const currentMaximum = () => (
    typeof maximumWidth === 'function'
      ? maximumWidth()
      : MAX_WIDTH
  )

  let width = applyWidth(
    column,
    handle,
    initialWidth,
    currentMaximum(),
  )

  function setWidth(
    nextWidth,
    constrainToLayout = true,
  ) {
    width = applyWidth(
      column,
      handle,
      nextWidth,
      constrainToLayout
        ? currentMaximum()
        : MAX_WIDTH,
    )

    return width
  }

  function commit(nextWidth) {
    width = setWidth(nextWidth)
    onCommit(width)
  }

  handle.addEventListener('keydown', event => {
    let nextWidth = null

    if (event.key === 'ArrowLeft') {
      nextWidth = width - KEYBOARD_STEP
    } else if (event.key === 'ArrowRight') {
      nextWidth = width + KEYBOARD_STEP
    } else if (event.key === 'Home') {
      nextWidth = typeof defaultWidth === 'function'
        ? defaultWidth()
        : DEFAULT_WIDTH
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

      width = setWidth(
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

  return {
    element: handle,
    getWidth: () => width,
    setWidth,
  }
}

export function installColumnResizers(root) {
  if (
    !root
    || typeof MutationObserver !== 'function'
  ) {
    return () => {}
  }

  const stored = readStoredWidths()
  const preferredWidths = {
    sidebar: stored?.sidebar ?? null,
    items: stored?.items ?? null,
  }
  const layoutStates = new Map()

  function commitWidth(name, width, layout) {
    preferredWidths[name] = clampWidth(width)

    const defaults = defaultColumnWidths(
      layout.clientWidth,
    )

    storeWidths({
      sidebar:
        preferredWidths.sidebar
        ?? defaults.sidebar,
      items:
        preferredWidths.items
        ?? defaults.items,
    })
  }

  function maximumFor(layout, otherWidth) {
    return Math.max(
      MIN_WIDTH,
      Math.min(
        MAX_WIDTH,
        layout.clientWidth
          - DETAIL_MIN_WIDTH
          - HANDLE_WIDTH * 2
          - otherWidth,
      ),
    )
  }

  function syncLayout(state) {
    if (
      state.layout.clientWidth
        < WIDE_LAYOUT_MIN_WIDTH
    ) {
      return
    }

    const defaults = defaultColumnWidths(
      state.layout.clientWidth,
    )
    const fitted = fitColumnWidths(
      {
        sidebar:
          preferredWidths.sidebar
          ?? defaults.sidebar,
        items:
          preferredWidths.items
          ?? defaults.items,
      },
      state.layout.clientWidth,
    )

    state.sidebarControl.setWidth(
      fitted.sidebar,
      false,
    )
    state.itemsControl.setWidth(
      fitted.items,
      false,
    )
    state.sidebarControl.setWidth(fitted.sidebar)
    state.itemsControl.setWidth(fitted.items)
  }

  const resizeObserver =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(entries => {
          entries.forEach(entry => {
            const state = layoutStates.get(
              entry.target,
            )

            if (state) {
              syncLayout(state)
            }
          })
        })
      : null

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

    const defaults = defaultColumnWidths(
      layout.clientWidth,
    )
    let sidebarControl = null
    let itemsControl = null

    sidebarControl = createHandle({
      column: sidebar,
      label: 'Breite der Navigationsspalte ändern',
      initialWidth:
        preferredWidths.sidebar
        ?? defaults.sidebar,
      defaultWidth: () =>
        defaultColumnWidths(
          layout.clientWidth,
        ).sidebar,
      maximumWidth: () => maximumFor(
        layout,
        itemsControl?.getWidth() ?? MIN_WIDTH,
      ),
      onCommit: width => commitWidth(
        'sidebar',
        width,
        layout,
      ),
    })

    itemsControl = createHandle({
      column: items,
      label: 'Breite der Eintragsspalte ändern',
      initialWidth:
        preferredWidths.items
        ?? defaults.items,
      defaultWidth: () =>
        defaultColumnWidths(
          layout.clientWidth,
        ).items,
      maximumWidth: () => maximumFor(
        layout,
        sidebarControl?.getWidth() ?? MIN_WIDTH,
      ),
      onCommit: width => commitWidth(
        'items',
        width,
        layout,
      ),
    })

    sidebar.after(sidebarControl.element)
    items.after(itemsControl.element)

    const state = {
      layout,
      sidebarControl,
      itemsControl,
    }

    layoutStates.set(layout, state)
    layout.dataset.wardenResizers = '1'
    resizeObserver?.observe(layout)
    syncLayout(state)
  }

  function setup() {
    layoutStates.forEach((state, layout) => {
      if (!layout.isConnected) {
        resizeObserver?.unobserve(layout)
        layoutStates.delete(layout)
      }
    })

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
    resizeObserver?.disconnect()

    layoutStates.forEach(state => {
      state.sidebarControl.element.remove()
      state.itemsControl.element.remove()
    })

    layoutStates.clear()
    document.documentElement.classList.remove(
      'bw-column-resizing',
    )
  }
}
