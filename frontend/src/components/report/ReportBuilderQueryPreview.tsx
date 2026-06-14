import { useState } from 'react'
import { LoadingButton } from '../ui/LoadingButton'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import { REPORT_VISUALIZATIONS, type ReportVisualization } from '../../lib/reportConstants'
import type { ChartPreviewData, PieSlice } from '../../lib/queryResultChart'
import { formatQueryStatus } from '../../lib/queryResultTable'
import {
  hasAnyExportPermission,
  runWidgetExport,
  type WidgetExportPermissions,
} from '../../lib/widgetExport'
import { StatementExportMenu } from '../statement/StatementExportMenu'
import { ReportChartPreview } from './ReportChartPreview'
import { ChartPreviewSkeleton } from './ChartPreviewSkeleton'
import { QueryResultsTable } from './QueryResultsTable'

interface ReportBuilderQueryPreviewProps {
  visualization: ReportVisualization
  onVisualizationChange: (v: ReportVisualization) => void
  queryResult: QueryExecuteResult | null
  queryError: string | null
  isRunning: boolean
  chartData: ChartPreviewData
  pieData: PieSlice[]
  reportName?: string
  showExport?: boolean
  exportPermissions?: WidgetExportPermissions
}

export function ReportBuilderQueryPreview({
  visualization,
  onVisualizationChange,
  queryResult,
  queryError,
  isRunning,
  chartData,
  pieData,
  reportName = 'query-preview',
  showExport = false,
  exportPermissions = { png: false, csv: false, pdf: false, xlsx: false },
}: ReportBuilderQueryPreviewProps) {
  const [exportError, setExportError] = useState<string | null>(null)

  const statusMessage = queryError
    ? queryError
    : queryResult
      ? formatQueryStatus(queryResult, { loading: isRunning })
      : isRunning
        ? 'Running query…'
        : null

  const showChart =
    !isRunning &&
    visualization !== 'TABLE_ONLY' &&
    queryResult &&
    (chartData.series.length > 0 || pieData.length > 0)

  const showChartSkeleton = isRunning && visualization !== 'TABLE_ONLY'

  const showTable = isRunning || (queryResult !== null && queryResult.rows.length > 0)

  const canExport =
    showExport &&
    hasAnyExportPermission(exportPermissions) &&
    !isRunning &&
    !queryError &&
    queryResult !== null &&
    queryResult.rows.length > 0

  const handleExport = async (format: 'csv' | 'pdf' | 'xlsx') => {
    if (!queryResult) return
    setExportError(null)
    try {
      await runWidgetExport(format, exportPermissions, {
        result: queryResult,
        reportName,
      })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-secondary px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Query results
          </h3>
          {statusMessage && (
            <span
              className={`truncate text-[11px] ${queryError ? 'text-semantic-red' : 'text-text-secondary'}`}
            >
              {statusMessage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exportError && (
            <span className="max-w-[12rem] truncate text-[11px] text-semantic-red" title={exportError}>
              {exportError}
            </span>
          )}
          {canExport && (
            <StatementExportMenu
              permissions={{
                csv: exportPermissions.csv,
                pdf: exportPermissions.pdf,
                xlsx: exportPermissions.xlsx,
              }}
              onExport={handleExport}
            />
          )}
          <div className="flex rounded-md border border-border bg-bg-primary p-0.5">
            {REPORT_VISUALIZATIONS.map((v) => (
              <button
                key={v.value}
                type="button"
                title={v.label}
                onClick={() => onVisualizationChange(v.value)}
                className={`rounded px-2 py-1 text-sm transition-colors ${
                  visualization === v.value
                    ? 'bg-brand-blue/15 text-brand-blue'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`}
              >
                <i className={`ti ${v.icon}`}></i>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isRunning && !queryResult && !queryError && (
          <div className="mb-3 flex min-h-[100px] items-center justify-center gap-2 text-sm text-text-secondary">
            <LoadingButton
              loading
              variant="secondary"
              className="pointer-events-none px-3 py-1.5 text-xs"
            >
              Running
            </LoadingButton>
          </div>
        )}

        {!isRunning && !queryResult && !queryError && (
          <p className="py-10 text-center text-xs text-text-secondary">
            Run a query to preview results here.
          </p>
        )}

        {queryResult && queryResult.rows.length === 0 && !queryError && !isRunning && (
          <p className="py-10 text-center text-xs text-text-secondary">Query returned no rows.</p>
        )}

        {queryError && !isRunning && (
          <div className="rounded-md border border-semantic-red/20 bg-semantic-red/5 px-3 py-2 text-xs text-semantic-red">
            {queryError}
          </div>
        )}

        {showChartSkeleton && (
          <div className="mb-4">
            <ChartPreviewSkeleton height={180} />
          </div>
        )}

        {showChart && (
          <div className="mb-4 rounded-md border border-border bg-bg-primary p-3">
            <ReportChartPreview
              visualization={visualization}
              chartData={chartData}
              pieData={pieData}
              height={180}
            />
          </div>
        )}

        {queryResult &&
          visualization !== 'TABLE_ONLY' &&
          !showChart &&
          !isRunning &&
          queryResult.rows.length > 0 && (
            <p className="mb-3 text-xs text-text-secondary">
              No numeric columns for charting. Showing table only.
            </p>
          )}

        {showTable && (
          <QueryResultsTable
            queryResult={queryResult}
            loading={isRunning}
            skeletonColumns={queryResult?.columns}
            skeletonRowCount={8}
          />
        )}
      </div>
    </div>
  )
}
