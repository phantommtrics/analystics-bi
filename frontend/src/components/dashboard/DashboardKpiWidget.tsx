import { useEffect, useState } from 'react'
import { reportsApi } from '../../api/reports'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import type { KpiWidgetLayout } from '../../lib/dashboardLayout'
import { resolveKpiDisplay } from '../../lib/kpiReportData'
import { iconClassName } from '../../lib/kpiWidgetConstants'

interface DashboardKpiWidgetProps {
  accessToken: string
  widget: KpiWidgetLayout
  canEdit: boolean
  queryFilters?: Record<string, string>
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
  onEdit,
  onRemove,
  onDragHandleMouseDown,
  isDragging = false,
}: DashboardKpiWidgetProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QueryExecuteResult | null>(null)

  const linked = Boolean(widget.savedReportId) && Boolean(widget.valueColumn ?? widget.labelColumn)

  useEffect(() => {
    if (!linked || !widget.savedReportId) {
      setResult(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    reportsApi
      .execute(accessToken, widget.savedReportId, queryFilters)
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
    queryFilters,
  ])

  const display = resolveKpiDisplay(widget, result)

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
      <div
        className="flex shrink-0 items-center gap-1 px-2 py-1.5"
        style={{ borderBottom: `1px solid ${widget.textColor}22` }}
      >
        {canEdit && onDragHandleMouseDown && (
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
        {canEdit && onEdit && (
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
        {canEdit && (
          <button
            type="button"
            title="Remove KPI"
            onClick={onRemove}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            style={{ color: widget.textColor }}
          >
            <i className="ti ti-x text-sm"></i>
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 p-3">
        {loading && linked ? (
          <p className="text-center text-xs opacity-80">Loading...</p>
        ) : error && linked ? (
          <div className="text-center text-xs opacity-90">
            <p>{error}</p>
            <p className="mt-2 truncate text-lg font-semibold">{display.value}</p>
            <p className="text-sm opacity-85">{display.label}</p>
          </div>
        ) : (
          <>
            <i className={`${iconClassName(widget.icon)} text-2xl opacity-90`}></i>
            <div className="truncate text-xl font-semibold leading-tight">{display.value}</div>
            <div className="line-clamp-2 text-sm opacity-85">{display.label}</div>
          </>
        )}
      </div>
    </div>
  )
}
