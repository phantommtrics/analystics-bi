import { useEffect, useState } from 'react'
import { reportsApi } from '../../api/reports'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import type { KpiWidgetLayout } from '../../lib/dashboardLayout'
import { resolveKpiDisplay } from '../../lib/kpiReportData'
import { serializeQueryFilters } from '../../lib/dashboardFilters'
import { iconClassName } from '../../lib/kpiWidgetConstants'

interface DashboardKpiWidgetProps {
  accessToken: string
  widget: KpiWidgetLayout
  canEdit: boolean
  queryFilters?: Record<string, string>
  dashboardId?: string
  onEdit?: () => void
  onRemove: () => void
  onDragHandleMouseDown?: (e: React.MouseEvent) => void
  isDragging?: boolean
}

export function DashboardKpiWidget({
  accessToken,
  widget,
  canEdit,
  queryFilters,
  dashboardId,
  onEdit,
  onRemove,
  onDragHandleMouseDown,
  isDragging = false,
}: DashboardKpiWidgetProps) {
  const linked = Boolean(widget.savedReportId) && Boolean(widget.valueColumn ?? widget.labelColumn)
  const filterKey = serializeQueryFilters(queryFilters)

  const [loading, setLoading] = useState(() => linked && queryFilters !== undefined)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QueryExecuteResult | null>(null)

  useEffect(() => {
    if (!linked || !widget.savedReportId) {
      setResult(null)
      setError(null)
      setLoading(false)
      return
    }

    if (queryFilters === undefined) {
      setResult(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setResult(null)
    reportsApi
      .execute(accessToken, widget.savedReportId, queryFilters, { dashboardId })
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
          setResult(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    linked,
    widget.savedReportId,
    widget.labelColumn,
    widget.valueColumn,
    widget.rowIndex,
    filterKey,
    dashboardId,
    queryFilters,
  ])

  const display = resolveKpiDisplay(widget, result)

  const bodyContent =
    linked && queryFilters === undefined ? (
      <p className="text-center text-sm opacity-80">Set report filters to load</p>
    ) : loading && linked ? (
      <p className="text-center text-sm opacity-80">Loading...</p>
    ) : error && linked ? (
      <div className="text-center">
        <p className="text-sm opacity-90">{error}</p>
        <div className="mt-3">
          <div className="mb-1 truncate text-kpi font-medium leading-none">{display.value}</div>
          <div className="line-clamp-2 text-sm opacity-85">{display.label}</div>
        </div>
      </div>
    ) : (
      <>
        <div className="flex items-start justify-between">
          <i className={`${iconClassName(widget.icon)} text-[22px] opacity-90`}></i>
        </div>
        <div>
          <div className="mb-1 truncate text-kpi font-medium leading-none">{display.value}</div>
          <div className="line-clamp-2 text-sm opacity-85">{display.label}</div>
        </div>
      </>
    )

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-md shadow-sm ${
        isDragging ? 'ring-2 ring-brand-blue/40' : ''
      }`}
      style={{
        backgroundColor: widget.backgroundColor,
        color: widget.textColor,
      }}
    >
      {canEdit && (
        <div
          className="flex shrink-0 items-center gap-1 px-2 py-1.5"
          style={{ borderBottom: `1px solid ${widget.textColor}22` }}
        >
          {onDragHandleMouseDown && (
            <button
              type="button"
              title="Drag to move"
              onMouseDown={onDragHandleMouseDown}
              className="shrink-0 cursor-grab rounded p-0.5 opacity-70 hover:opacity-100 active:cursor-grabbing"
              style={{ color: widget.textColor }}
            >
              <i className="ti ti-grip-vertical text-sm"></i>
            </button>
          )}
          <span className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-wide opacity-80">
            KPI{linked ? ' · Live' : ''}
          </span>
          {onEdit && (
            <button
              type="button"
              title="Edit KPI"
              onClick={onEdit}
              className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
              style={{ color: widget.textColor }}
            >
              <i className="ti ti-pencil text-sm"></i>
            </button>
          )}
          <button
            type="button"
            title="Remove KPI"
            onClick={onRemove}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            style={{ color: widget.textColor }}
          >
            <i className="ti ti-x text-sm"></i>
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 p-4">{bodyContent}</div>
    </div>
  )
}
