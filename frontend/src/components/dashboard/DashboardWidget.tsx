import { useEffect, useMemo, useState } from 'react'
import { reportsApi } from '../../api/reports'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import type { SavedReportSummary } from '../../api/reports'
import {
  categoryMeta,
  REPORT_VISUALIZATIONS,
  type ReportVisualization,
} from '../../lib/reportConstants'
import { rowsToChartData, rowsToPieData } from '../../lib/queryResultChart'
import { serializeQueryFilters } from '../../lib/dashboardFilters'
import { ReportChartPreview } from '../report/ReportChartPreview'
import { ChartPreviewSkeleton } from '../report/ChartPreviewSkeleton'
import { QueryResultsTable } from '../report/QueryResultsTable'
import { COMPACT_QUERY_TABLE_PAGE_SIZE } from '../../lib/queryResultTable'

interface DashboardWidgetProps {
  accessToken: string
  report: SavedReportSummary
  visualization: ReportVisualization
  canEdit: boolean
  queryFilters?: Record<string, string>
  dashboardId?: string
  onVisualizationChange?: (v: ReportVisualization) => void
  onRemove: () => void
  /** Mousedown on grip starts canvas reposition drag */
  onDragHandleMouseDown?: (e: React.MouseEvent) => void
  isDragging?: boolean
}

export function DashboardWidget({
  accessToken,
  report,
  visualization,
  canEdit,
  queryFilters,
  dashboardId,
  onVisualizationChange,
  onRemove,
  onDragHandleMouseDown,
  isDragging = false,
}: DashboardWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QueryExecuteResult | null>(null)

  const filterKey = serializeQueryFilters(queryFilters)

  useEffect(() => {
    if (queryFilters === undefined) {
      setLoading(false)
      setError(null)
      setResult(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    reportsApi
      .execute(accessToken, report.id, queryFilters, { dashboardId })
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, report.id, filterKey, dashboardId])

  const chartData = useMemo(() => {
    if (!result?.rows.length) return { labels: [], series: [] }
    return rowsToChartData(result.columns, result.rows)
  }, [result])

  const pieData = useMemo(() => {
    if (!result) return []
    return rowsToPieData(result.columns, result.rows)
  }, [result])

  const meta = categoryMeta[report.category]
  const showChart =
    !loading && visualization !== 'TABLE_ONLY' && chartData.series.length > 0
  const showChartSkeleton = loading && visualization !== 'TABLE_ONLY'
  const showTable =
    queryFilters !== undefined &&
    (loading || (result !== null && result.rows.length > 0))

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-bg-primary shadow-sm ${
        isDragging ? 'ring-2 ring-brand-blue/40' : ''
      }`}
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-bg-secondary px-2 py-1.5">
        {canEdit && onDragHandleMouseDown && (
          <button
            type="button"
            title="Drag to move"
            onMouseDown={onDragHandleMouseDown}
            className="shrink-0 cursor-grab rounded p-1 text-text-secondary hover:bg-bg-tertiary active:cursor-grabbing"
          >
            <i className="ti ti-grip-vertical text-sm"></i>
          </button>
        )}
        <i className={`ti ${meta.icon} shrink-0 text-brand-blue`}></i>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{report.name}</span>
        {canEdit && onVisualizationChange && (
          <div className="flex shrink-0 rounded-md border border-border bg-bg-primary p-0.5">
            {REPORT_VISUALIZATIONS.map((v) => (
              <button
                key={v.value}
                type="button"
                title={v.label}
                onClick={() => onVisualizationChange(v.value)}
                className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                  visualization === v.value
                    ? 'bg-brand-blue/15 text-brand-blue'
                    : 'text-text-secondary hover:bg-bg-secondary'
                }`}
              >
                <i className={`ti ${v.icon}`}></i>
              </button>
            ))}
          </div>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded p-1 text-text-secondary hover:bg-semantic-red/10 hover:text-semantic-red"
            title="Remove widget"
          >
            <i className="ti ti-x text-sm"></i>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {queryFilters === undefined && (
          <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1 px-2 text-center text-xs text-text-secondary">
            <i className="ti ti-filter-off text-lg opacity-60"></i>
            <p>Select a date filter to load data</p>
          </div>
        )}
        {queryFilters !== undefined && error && (
          <div className="flex h-full min-h-[80px] items-center justify-center px-2 text-center text-xs text-semantic-red">
            {error}
          </div>
        )}
        {queryFilters !== undefined && !error && (
          <>
            {showChartSkeleton && (
              <div className="mb-2">
                <ChartPreviewSkeleton height={120} />
              </div>
            )}
            {showChart && result && (
              <div className="mb-2">
                <ReportChartPreview
                  visualization={visualization}
                  chartData={chartData}
                  pieData={pieData}
                  height={120}
                />
              </div>
            )}
            {showTable && (
              <QueryResultsTable
                queryResult={result}
                loading={loading}
                skeletonColumns={result?.columns}
                defaultPageSize={COMPACT_QUERY_TABLE_PAGE_SIZE}
                skeletonRowCount={6}
                compact
                showPageSizeSelector={false}
              />
            )}
            {result && result.rowCount === 0 && !loading && (
              <p className="py-6 text-center text-xs text-text-secondary">No data</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
