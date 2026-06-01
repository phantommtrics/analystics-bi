import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedReportSummary } from '../../api/reports'
import type { KpiWidgetEditPatch } from './KpiWidgetEditModal'
import {
  type DashboardLayout,
  type DashboardWidgetLayout,
  type KpiWidgetLayout,
  type WidgetResizeHandle,
  createDefaultKpiWidget,
  createWidgetId,
  findWidgetPlacement,
  isKpiWidget,
  isReportWidget,
  layoutToGridStyle,
  moveWidget,
  pointerToGridCell,
  resizeWidgetByCell,
  widgetGridStyle,
} from '../../lib/dashboardLayout'
import type { ReportVisualization } from '../../lib/reportConstants'
import { DashboardKpiWidget } from './DashboardKpiWidget'
import { DashboardWidget } from './DashboardWidget'
import { KpiWidgetEditModal } from './KpiWidgetEditModal'
import { WidgetResizeHandles } from './WidgetResizeHandles'

const GRID_GAP_PX = 12

interface DashboardGridProps {
  accessToken: string
  layout: DashboardLayout
  reports: SavedReportSummary[]
  reportsById: Map<string, SavedReportSummary>
  canEdit: boolean
  onChange: (layout: DashboardLayout) => void
  /** Full-screen preview: larger canvas, no drop-zone chrome */
  previewMode?: boolean
  queryFilters?: Record<string, string>
  /** When viewing a saved dashboard, pass id so widgets can execute embedded reports */
  dashboardId?: string
}

type DragState = {
  kind: 'move'
  widgetId: string
  grabCol: number
  grabRow: number
}

type ResizeState = {
  kind: 'resize'
  widgetId: string
  handle: WidgetResizeHandle
}

type InteractionState = DragState | ResizeState

export function DashboardGrid({
  accessToken,
  layout,
  reports,
  reportsById,
  canEdit,
  onChange,
  previewMode = false,
  queryFilters,
  dashboardId,
}: DashboardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const [interactingId, setInteractingId] = useState<string | null>(null)
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null)
  const interactionRef = useRef<InteractionState | null>(null)

  const updateWidgets = useCallback(
    (widgets: DashboardWidgetLayout[]) => {
      onChange({ ...layout, widgets })
    },
    [layout, onChange],
  )

  const patchWidget = useCallback(
    (id: string, patch: Partial<DashboardWidgetLayout>) => {
      updateWidgets(
        layout.widgets.map((w) => (w.id === id ? ({ ...w, ...patch } as DashboardWidgetLayout) : w)),
      )
    },
    [layout.widgets, updateWidgets],
  )

  const addReportWidget = useCallback(
    (reportId: string) => {
      const report = reportsById.get(reportId)
      if (!report) return
      const { x, y } = findWidgetPlacement(layout)
      const widget: DashboardWidgetLayout = {
        id: createWidgetId(),
        savedReportId: reportId,
        x,
        y,
        w: report.visualization === 'TABLE_ONLY' ? 12 : 6,
        h: report.visualization === 'TABLE_ONLY' ? 5 : 4,
        visualization: report.visualization,
      }
      updateWidgets([...layout.widgets, widget])
    },
    [layout, reportsById, updateWidgets],
  )

  const addKpiWidget = useCallback(() => {
    const widget = createDefaultKpiWidget(layout)
    updateWidgets([...layout.widgets, widget])
  }, [layout, updateWidgets])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!canEdit) return
    const reportId = e.dataTransfer.getData('application/report-id')
    if (reportId) {
      addReportWidget(reportId)
      return
    }
    if (e.dataTransfer.getData('application/widget-type') === 'kpi') {
      addKpiWidget()
    }
  }

  const removeWidget = (id: string) => {
    updateWidgets(layout.widgets.filter((w) => w.id !== id))
  }

  const applyPointerInteraction = useCallback(
    (clientX: number, clientY: number) => {
      const state = interactionRef.current
      const gridEl = gridRef.current
      if (!state || !gridEl) return

      const current = layoutRef.current
      const cell = pointerToGridCell(gridEl, current, clientX, clientY, GRID_GAP_PX)

      let next: DashboardLayout
      if (state.kind === 'move') {
        const x = cell.x - state.grabCol
        const y = cell.y - state.grabRow
        next = moveWidget(current, state.widgetId, x, y)
      } else {
        next = resizeWidgetByCell(current, state.widgetId, state.handle, cell)
      }

      if (next !== current) onChange(next)
    },
    [onChange],
  )

  const endInteraction = useCallback(() => {
    interactionRef.current = null
    setInteractingId(null)
  }, [])

  useEffect(() => {
    if (!interactingId) return

    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      applyPointerInteraction(e.clientX, e.clientY)
    }
    const onUp = () => endInteraction()

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [interactingId, applyPointerInteraction, endInteraction])

  const startWidgetDrag = (widget: DashboardWidgetLayout, e: React.MouseEvent) => {
    if (!canEdit || previewMode || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const gridEl = gridRef.current
    if (!gridEl) return

    const cell = pointerToGridCell(gridEl, layout, e.clientX, e.clientY, GRID_GAP_PX)
    interactionRef.current = {
      kind: 'move',
      widgetId: widget.id,
      grabCol: cell.x - widget.x,
      grabRow: cell.y - widget.y,
    }
    setInteractingId(widget.id)
  }

  const startWidgetResize = (
    widget: DashboardWidgetLayout,
    handle: WidgetResizeHandle,
    e: React.MouseEvent,
  ) => {
    if (!canEdit || previewMode || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    interactionRef.current = {
      kind: 'resize',
      widgetId: widget.id,
      handle,
    }
    setInteractingId(widget.id)
  }

  const editingKpi = editingKpiId
    ? (layout.widgets.find((w) => w.id === editingKpiId && isKpiWidget(w)) as KpiWidgetLayout | undefined)
    : undefined

  const minRows =
    layout.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0) + 2

  return (
    <>
      <div
        onDragOver={(e) => {
          if (canEdit) e.preventDefault()
        }}
        onDrop={handleDrop}
        className={`min-h-full rounded-md transition-colors ${
          previewMode
            ? 'border border-border bg-bg-secondary p-4 lg:p-6'
            : canEdit
              ? 'border-2 border-dashed border-border bg-bg-tertiary p-3 hover:border-brand-blue/40'
              : 'border-2 border-dashed border-transparent p-3'
        }`}
      >
        {layout.widgets.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center text-center text-text-secondary ${
              previewMode ? 'min-h-[50vh]' : 'min-h-[320px]'
            }`}
          >
            <i className="ti ti-layout-dashboard mb-2 text-4xl opacity-50"></i>
            <p className="text-sm font-medium">Empty dashboard canvas</p>
            {canEdit && (
              <p className="mt-1 max-w-xs text-xs">
                Drag saved reports or KPI cards from the library. Use the grip to move and edge
                arrows to resize.
              </p>
            )}
          </div>
        ) : (
          <div
            ref={gridRef}
            className={`grid ${previewMode ? 'gap-4' : 'gap-3'} ${interactingId ? 'select-none' : ''}`}
            style={{
              ...layoutToGridStyle(layout),
              minHeight: minRows * (previewMode ? layout.rowHeight + 8 : layout.rowHeight),
            }}
          >
            {layout.widgets.map((widget) => {
              const isInteracting = interactingId === widget.id

              if (isKpiWidget(widget)) {
                return (
                  <div
                    key={widget.id}
                    style={widgetGridStyle(widget)}
                    className={`group/widget relative min-h-0 ${isInteracting ? 'z-20' : ''}`}
                  >
                    {canEdit && !previewMode && (
                      <WidgetResizeHandles
                        active={isInteracting && interactionRef.current?.kind === 'resize'}
                        onStart={(handle, e) => startWidgetResize(widget, handle, e)}
                      />
                    )}
                    <DashboardKpiWidget
                      accessToken={accessToken}
                      widget={widget}
                      canEdit={canEdit && !previewMode}
                      queryFilters={queryFilters}
                      dashboardId={dashboardId}
                      onEdit={() => setEditingKpiId(widget.id)}
                      onRemove={() => removeWidget(widget.id)}
                      onDragHandleMouseDown={(e) => startWidgetDrag(widget, e)}
                      isDragging={isInteracting && interactionRef.current?.kind === 'move'}
                    />
                  </div>
                )
              }

              if (!isReportWidget(widget)) return null
              const report = reportsById.get(widget.savedReportId)
              if (!report) return null
              const visualization = (widget.visualization ??
                report.visualization) as ReportVisualization

              return (
                <div
                  key={widget.id}
                  style={widgetGridStyle(widget)}
                  className={`group/widget relative min-h-0 ${isInteracting ? 'z-20' : ''}`}
                >
                  {canEdit && !previewMode && (
                    <WidgetResizeHandles
                      active={isInteracting && interactionRef.current?.kind === 'resize'}
                      onStart={(handle, e) => startWidgetResize(widget, handle, e)}
                    />
                  )}
                  <DashboardWidget
                    accessToken={accessToken}
                    report={report}
                    visualization={visualization}
                    canEdit={canEdit && !previewMode}
                    queryFilters={queryFilters}
                    dashboardId={dashboardId}
                    onVisualizationChange={(v) => patchWidget(widget.id, { visualization: v })}
                    onRemove={() => removeWidget(widget.id)}
                    onDragHandleMouseDown={(e) => startWidgetDrag(widget, e)}
                    isDragging={isInteracting && interactionRef.current?.kind === 'move'}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <KpiWidgetEditModal
        open={editingKpiId !== null}
        accessToken={accessToken}
        reports={reports}
        widget={editingKpi ?? null}
        queryFilters={queryFilters}
        onCancel={() => setEditingKpiId(null)}
        onConfirm={(patch: KpiWidgetEditPatch) => {
          if (editingKpiId) patchWidget(editingKpiId, patch)
          setEditingKpiId(null)
        }}
      />
    </>
  )
}
