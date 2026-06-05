import { useMemo, useRef, useState } from 'react'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import type { ReportVisualization } from '../../lib/reportConstants'
import {
  rowsToChartData,
  rowsToPieData,
} from '../../lib/queryResultChart'
import { formatQueryStatus } from '../../lib/queryResultTable'
import {
  isChartVisualization,
  runWidgetExport,
  type WidgetExportContext,
  type WidgetExportFormat,
  type WidgetExportPermissions,
} from '../../lib/widgetExport'
import type { EChartHandle } from '../charts/EChartBase'
import { WidgetExportMenu } from '../dashboard/WidgetExportMenu'
import { ReportChartPreview } from './ReportChartPreview'
import { ChartPreviewSkeleton } from './ChartPreviewSkeleton'
import { QueryResultsTable } from './QueryResultsTable'

interface ReportRunDisplayProps {
  reportName: string
  visualization: ReportVisualization
  queryResult: QueryExecuteResult | null
  queryError: string | null
  isRunning: boolean
  dateFilterPending?: boolean
  /** When filters (date and/or SQL variables) are not ready to run. */
  filtersPending?: boolean
  /** Catalog view: table only, table export formats (CSV/PDF/XLSX). */
  tableOnly?: boolean
  showExport?: boolean
  exportContext?: WidgetExportContext
  exportPermissions?: WidgetExportPermissions
}

export function ReportRunDisplay({
  reportName,
  visualization,
  queryResult,
  queryError,
  isRunning,
  dateFilterPending = false,
  filtersPending = false,
  tableOnly = false,
  showExport = false,
  exportContext,
  exportPermissions = { png: false, csv: false, pdf: false, xlsx: false },
}: ReportRunDisplayProps) {
  const [exportError, setExportError] = useState<string | null>(null)
  const chartRef = useRef<EChartHandle>(null)
  const effectiveVisualization = tableOnly ? 'TABLE_ONLY' : visualization
  const showCharts = !tableOnly

  const chartData = useMemo(() => {
    if (!showCharts || !queryResult?.rows.length) {
      return { labels: [] as string[], series: [] as { name: string; data: number[] }[] }
    }
    return rowsToChartData(queryResult.columns, queryResult.rows)
  }, [queryResult, showCharts])

  const pieData = useMemo(() => {
    if (!showCharts || !queryResult) return []
    return rowsToPieData(queryResult.columns, queryResult.rows)
  }, [queryResult, showCharts])

  const showChart =
    showCharts &&
    !isRunning &&
    effectiveVisualization !== 'TABLE_ONLY' &&
    queryResult &&
    (chartData.series.length > 0 || pieData.length > 0)

  const showChartSkeleton = showCharts && isRunning && effectiveVisualization !== 'TABLE_ONLY'

  const statusMessage = queryError
    ? queryError
    : queryResult
      ? formatQueryStatus(queryResult, { loading: isRunning })
      : isRunning
        ? 'Loading report data…'
        : null

  const showTable = isRunning || (queryResult !== null && queryResult.rows.length > 0)

  const pendingFilters = filtersPending || dateFilterPending

  const canExport =
    showExport &&
    !isRunning &&
    !queryError &&
    queryResult !== null &&
    !pendingFilters &&
    (isChartVisualization(effectiveVisualization)
      ? chartData.series.length > 0 || pieData.length > 0
      : queryResult.rows.length > 0)

  const handleExport = async (format: WidgetExportFormat) => {
    if (!queryResult) return
    setExportError(null)

    try {
      await runWidgetExport(format, exportPermissions, {
        result: queryResult,
        reportName,
        exportContext,
        getChartDataUrl: () => chartRef.current?.getDataUrl() ?? null,
      })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  if (pendingFilters) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-sm text-text-secondary">
        <i className="ti ti-filter text-2xl opacity-60"></i>
        <p>Set all report filters to load this report.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(statusMessage || canExport || exportError) && (
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-2 text-sm ${
            queryError ? 'bg-semantic-red/10 text-semantic-red' : 'text-text-secondary'
          }`}
        >
          <div className="min-w-0 flex-1">
            {statusMessage && <span>{statusMessage}</span>}
            {exportError && (
              <p className={statusMessage ? 'mt-1 text-xs text-semantic-red' : 'text-semantic-red'}>
                {exportError}
              </p>
            )}
          </div>
          {canExport && (
            <WidgetExportMenu
              visualization={effectiveVisualization}
              permissions={exportPermissions}
              onExport={handleExport}
            />
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {!isRunning && !queryResult && !queryError && (
          <p className="py-12 text-center text-sm text-text-secondary">No data loaded.</p>
        )}

        {queryResult && queryResult.rows.length === 0 && !queryError && !isRunning && (
          <p className="py-12 text-center text-sm text-text-secondary">
            Query returned no rows.
          </p>
        )}

        {showChartSkeleton && (
          <div className="mb-6">
            <ChartPreviewSkeleton height={360} />
          </div>
        )}

        {showChart && (
          <div className="mb-6 rounded-lg border border-border bg-bg-primary p-4 shadow-sm">
            <ReportChartPreview
              ref={chartRef}
              visualization={effectiveVisualization}
              chartData={chartData}
              pieData={pieData}
              height={360}
            />
          </div>
        )}

        {queryResult &&
          !tableOnly &&
          effectiveVisualization !== 'TABLE_ONLY' &&
          !showChart &&
          !isRunning &&
          queryResult.rows.length > 0 && (
            <p className="mb-4 text-sm text-text-secondary">
              No numeric columns for charting. Showing table only.
            </p>
          )}

        {showTable && (
          <QueryResultsTable
            queryResult={queryResult}
            loading={isRunning}
            skeletonColumns={queryResult?.columns}
            skeletonRowCount={12}
            className="shadow-sm"
          />
        )}
      </div>
    </div>
  )
}
