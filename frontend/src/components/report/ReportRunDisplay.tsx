import { useMemo } from 'react'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import type { ReportVisualization } from '../../lib/reportConstants'
import {
  rowsToChartData,
  rowsToPieData,
} from '../../lib/queryResultChart'
import { formatQueryStatus } from '../../lib/queryResultTable'
import { ReportChartPreview } from './ReportChartPreview'
import { ChartPreviewSkeleton } from './ChartPreviewSkeleton'
import { QueryResultsTable } from './QueryResultsTable'

interface ReportRunDisplayProps {
  visualization: ReportVisualization
  queryResult: QueryExecuteResult | null
  queryError: string | null
  isRunning: boolean
  dateFilterPending?: boolean
}

export function ReportRunDisplay({
  visualization,
  queryResult,
  queryError,
  isRunning,
  dateFilterPending = false,
}: ReportRunDisplayProps) {
  const chartData = useMemo(() => {
    if (!queryResult?.rows.length) {
      return { labels: [] as string[], series: [] as { name: string; data: number[] }[] }
    }
    return rowsToChartData(queryResult.columns, queryResult.rows)
  }, [queryResult])

  const pieData = useMemo(() => {
    if (!queryResult) return []
    return rowsToPieData(queryResult.columns, queryResult.rows)
  }, [queryResult])

  const showChart =
    !isRunning &&
    visualization !== 'TABLE_ONLY' &&
    queryResult &&
    (chartData.series.length > 0 || pieData.length > 0)

  const showChartSkeleton = isRunning && visualization !== 'TABLE_ONLY'

  const statusMessage = queryError
    ? queryError
    : queryResult
      ? formatQueryStatus(queryResult, { loading: isRunning })
      : isRunning
        ? 'Loading report data…'
        : null

  const showTable = isRunning || (queryResult !== null && queryResult.rows.length > 0)

  if (dateFilterPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-sm text-text-secondary">
        <i className="ti ti-filter text-2xl opacity-60"></i>
        <p>Select a date filter to load this report.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {statusMessage && (
        <div
          className={`shrink-0 border-b border-border px-6 py-2 text-sm ${
            queryError ? 'bg-semantic-red/10 text-semantic-red' : 'text-text-secondary'
          }`}
        >
          {statusMessage}
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
              visualization={visualization}
              chartData={chartData}
              pieData={pieData}
              height={360}
            />
          </div>
        )}

        {queryResult &&
          visualization !== 'TABLE_ONLY' &&
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
