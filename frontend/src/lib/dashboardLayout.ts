import type { ReportVisualization } from './reportConstants'
import { DEFAULT_KPI_WIDGET } from './kpiWidgetConstants'

export type ReportWidgetLayout = {
  type?: 'report'
  id: string
  savedReportId: string
  x: number
  y: number
  w: number
  h: number
  visualization?: ReportVisualization
}

export type KpiWidgetLayout = {
  type: 'kpi'
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
  value: string
  icon: string
  backgroundColor: string
  textColor: string
  /** When set, label/value are loaded from this report's query result. */
  savedReportId?: string
  labelColumn?: string
  valueColumn?: string
  rowIndex?: number
}

export type DashboardWidgetLayout = ReportWidgetLayout | KpiWidgetLayout

export type DashboardLayout = {
  gridCols: number
  rowHeight: number
  widgets: DashboardWidgetLayout[]
}

export const emptyDashboardLayout = (): DashboardLayout => ({
  gridCols: 12,
  rowHeight: 80,
  widgets: [],
})

export function isKpiWidget(widget: DashboardWidgetLayout): widget is KpiWidgetLayout {
  return widget.type === 'kpi'
}

export function isReportWidget(widget: DashboardWidgetLayout): widget is ReportWidgetLayout {
  return !isKpiWidget(widget)
}

/** Unique saved report IDs referenced by report widgets and live KPI cards. */
export function collectReportIdsFromLayout(layout: DashboardLayout): string[] {
  const ids = new Set<string>()
  for (const widget of layout.widgets) {
    if (isReportWidget(widget)) {
      ids.add(widget.savedReportId)
    } else if (widget.savedReportId) {
      ids.add(widget.savedReportId)
    }
  }
  return [...ids]
}

export function createWidgetId() {
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createDefaultKpiWidget(
  layout: DashboardLayout,
  overrides?: Partial<Omit<KpiWidgetLayout, 'type' | 'id' | 'x' | 'y'>>,
): KpiWidgetLayout {
  const { x, y } = findWidgetPlacement(layout, 3, 2)
  return {
    type: 'kpi',
    id: createWidgetId(),
    x,
    y,
    w: 3,
    h: 2,
    label: DEFAULT_KPI_WIDGET.label,
    value: DEFAULT_KPI_WIDGET.value,
    icon: DEFAULT_KPI_WIDGET.icon,
    backgroundColor: DEFAULT_KPI_WIDGET.backgroundColor,
    textColor: DEFAULT_KPI_WIDGET.textColor,
    ...overrides,
  }
}

function collides(
  widgets: DashboardWidgetLayout[],
  x: number,
  y: number,
  w: number,
  h: number,
  ignoreId?: string,
) {
  return widgets.some((item) => {
    if (ignoreId && item.id === ignoreId) return false
    const overlapX = x < item.x + item.w && x + w > item.x
    const overlapY = y < item.y + item.h && y + h > item.y
    return overlapX && overlapY
  })
}

export function findWidgetPlacement(
  layout: DashboardLayout,
  w = 6,
  h = 4,
): { x: number; y: number } {
  const cols = layout.gridCols
  let maxY = 0
  for (const widget of layout.widgets) {
    maxY = Math.max(maxY, widget.y + widget.h)
  }

  for (let y = 0; y <= maxY + 2; y++) {
    for (let x = 0; x <= cols - w; x++) {
      if (!collides(layout.widgets, x, y, w, h)) {
        return { x, y }
      }
    }
  }
  return { x: 0, y: maxY }
}

export function layoutToGridStyle(layout: DashboardLayout) {
  return {
    gridTemplateColumns: `repeat(${layout.gridCols}, minmax(0, 1fr))`,
    gridAutoRows: `${layout.rowHeight}px`,
  } as const
}

export function widgetGridStyle(widget: Pick<DashboardWidgetLayout, 'x' | 'y' | 'w' | 'h'>) {
  return {
    gridColumn: `${widget.x + 1} / span ${widget.w}`,
    gridRow: `${widget.y + 1} / span ${widget.h}`,
  } as const
}

/** Convert pointer position to top-left grid cell (accounts for gap between tracks). */
export function pointerToGridCell(
  gridEl: HTMLElement,
  layout: DashboardLayout,
  clientX: number,
  clientY: number,
  gapPx = 12,
): { x: number; y: number } {
  const rect = gridEl.getBoundingClientRect()
  const styles = getComputedStyle(gridEl)
  const padL = parseFloat(styles.paddingLeft) || 0
  const padT = parseFloat(styles.paddingTop) || 0
  const padR = parseFloat(styles.paddingRight) || 0
  const innerWidth = gridEl.clientWidth - padL - padR
  const colStride = (innerWidth - gapPx * (layout.gridCols - 1)) / layout.gridCols
  const rowStride = layout.rowHeight + gapPx

  const relX = clientX - rect.left - padL
  const relY = clientY - rect.top - padT

  const x = Math.max(0, Math.min(layout.gridCols - 1, Math.floor(relX / colStride)))
  const y = Math.max(0, Math.floor(relY / rowStride))
  return { x, y }
}

export function moveWidget(
  layout: DashboardLayout,
  widgetId: string,
  x: number,
  y: number,
): DashboardLayout {
  const widget = layout.widgets.find((w) => w.id === widgetId)
  if (!widget) return layout

  const nextX = Math.max(0, Math.min(layout.gridCols - widget.w, x))
  const nextY = Math.max(0, y)

  if (widget.x === nextX && widget.y === nextY) return layout

  if (collides(layout.widgets, nextX, nextY, widget.w, widget.h, widgetId)) {
    return layout
  }

  return {
    ...layout,
    widgets: layout.widgets.map((w) =>
      w.id === widgetId ? { ...w, x: nextX, y: nextY } : w,
    ),
  }
}

export type WidgetResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const MIN_WIDGET_W = 2
const MIN_WIDGET_H = 2

export function resizeWidgetByCell(
  layout: DashboardLayout,
  widgetId: string,
  handle: WidgetResizeHandle,
  cell: { x: number; y: number },
): DashboardLayout {
  const widget = layout.widgets.find((w) => w.id === widgetId)
  if (!widget) return layout

  let { x, y, w, h } = widget
  const right = x + w
  const bottom = y + h

  switch (handle) {
    case 'e':
      w = Math.max(MIN_WIDGET_W, Math.min(layout.gridCols - x, cell.x - x + 1))
      break
    case 'w': {
      const nextX = Math.max(0, Math.min(cell.x, right - MIN_WIDGET_W))
      x = nextX
      w = right - nextX
      break
    }
    case 's':
      h = Math.max(MIN_WIDGET_H, cell.y - y + 1)
      break
    case 'n': {
      const nextY = Math.max(0, Math.min(cell.y, bottom - MIN_WIDGET_H))
      y = nextY
      h = bottom - nextY
      break
    }
    case 'se':
      w = Math.max(MIN_WIDGET_W, Math.min(layout.gridCols - x, cell.x - x + 1))
      h = Math.max(MIN_WIDGET_H, cell.y - y + 1)
      break
    case 'sw': {
      const nextX = Math.max(0, Math.min(cell.x, right - MIN_WIDGET_W))
      x = nextX
      w = right - nextX
      h = Math.max(MIN_WIDGET_H, cell.y - y + 1)
      break
    }
    case 'ne':
      w = Math.max(MIN_WIDGET_W, Math.min(layout.gridCols - x, cell.x - x + 1))
      {
        const nextY = Math.max(0, Math.min(cell.y, bottom - MIN_WIDGET_H))
        y = nextY
        h = bottom - nextY
      }
      break
    case 'nw': {
      const nextX = Math.max(0, Math.min(cell.x, right - MIN_WIDGET_W))
      x = nextX
      w = right - nextX
      const nextY = Math.max(0, Math.min(cell.y, bottom - MIN_WIDGET_H))
      y = nextY
      h = bottom - nextY
      break
    }
  }

  if (x === widget.x && y === widget.y && w === widget.w && h === widget.h) {
    return layout
  }

  if (collides(layout.widgets, x, y, w, h, widgetId)) {
    return layout
  }

  return {
    ...layout,
    widgets: layout.widgets.map((item) =>
      item.id === widgetId ? { ...item, x, y, w, h } : item,
    ),
  }
}
