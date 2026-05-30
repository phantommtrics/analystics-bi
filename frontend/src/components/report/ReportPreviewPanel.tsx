import { DataTable } from '../ui/DataTable'
import type { Column } from '../ui/DataTable'
import { LoadingButton } from '../ui/LoadingButton'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import { REPORT_VISUALIZATIONS, type ReportVisualization } from '../../lib/reportConstants'
import {
  isNumericColumn,
  type ChartPreviewData,
  type PieSlice,
} from '../../lib/queryResultChart'
import { ReportChartPreview } from './ReportChartPreview'

const PREVIEW_ROW_LIMIT = 50

interface ReportPreviewPanelProps {
  visualization: ReportVisualization
  onVisualizationChange: (v: ReportVisualization) => void
  queryResult: QueryExecuteResult | null
  queryError: string | null
  isRunning: boolean
  chartData: ChartPreviewData
  pieData: PieSlice[]
  previewExpanded: boolean
  onToggleExpand: () => void
  onClosePreview: () => void
}

export function ReportPreviewPanel({
  visualization,
  onVisualizationChange,
  queryResult,
  queryError,
  isRunning,
  chartData,
  pieData,
  previewExpanded,
  onToggleExpand,
  onClosePreview,
}: ReportPreviewPanelProps) {
  const previewRows = queryResult?.rows.slice(0, PREVIEW_ROW_LIMIT) ?? []

  const tableColumns: Column<Record<string, unknown>>[] = queryResult
    ? queryResult.columns.map((col) => ({
        header: col,
        accessor: (row: Record<string, unknown>) => {
          const v = row[col]
          if (v === null || v === undefined) return '—'
          return String(v)
        },
        isNumeric: isNumericColumn(col, queryResult.rows),
        className: isNumericColumn(col, queryResult.rows) ? 'font-mono' : '',
      }))
    : []

  const statusMessage = queryError
    ? queryError
    : queryResult
      ? `${queryResult.rowCount} row${queryResult.rowCount === 1 ? '' : 's'} · ${queryResult.latencyMs}ms${queryResult.truncated ? ' · truncated at 500' : ''}`
      : isRunning
        ? 'Running query...'
        : null

  const showChart =
    visualization !== 'TABLE_ONLY' &&
    queryResult &&
    (chartData.series.length > 0 || pieData.length > 0)

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-tertiary">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-secondary px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Preview
          </span>
          {statusMessage && (
            <span
              className={`text-[11px] ${queryError ? 'text-semantic-red' : 'text-text-secondary'}`}
            >
              {statusMessage}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
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
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded-sm px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary"
            title={previewExpanded ? 'Restore split view' : 'Expand preview'}
          >
            <i className={`ti ${previewExpanded ? 'ti-arrows-minimize' : 'ti-arrows-maximize'}`}></i>
          </button>
          <button
            type="button"
            onClick={onClosePreview}
            className="rounded-sm px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary"
            title="Close preview"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isRunning && !queryResult && !queryError && (
          <div className="flex h-full min-h-[120px] items-center justify-center gap-2 text-sm text-text-secondary">
            <LoadingButton loading variant="secondary" className="pointer-events-none px-3 py-1.5 text-xs">
              Running
            </LoadingButton>
          </div>
        )}

        {!isRunning && !queryResult && !queryError && (
          <p className="py-8 text-center text-sm text-text-secondary">No results yet.</p>
        )}

        {queryResult && queryResult.rows.length === 0 && !queryError && (
          <p className="py-8 text-center text-sm text-text-secondary">Query returned no rows.</p>
        )}

        {showChart && (
          <div className="mb-4 rounded-md border border-border bg-bg-primary p-3">
            <ReportChartPreview
              visualization={visualization}
              chartData={chartData}
              pieData={pieData}
              height={previewExpanded ? 360 : 220}
            />
          </div>
        )}

        {queryResult &&
          visualization !== 'TABLE_ONLY' &&
          !showChart &&
          queryResult.rows.length > 0 && (
            <p className="mb-3 text-sm text-text-secondary">
              No numeric columns for charting. Showing table only.
            </p>
          )}

        {previewRows.length > 0 && queryResult && (
          <div className="overflow-hidden rounded-md border border-border bg-bg-primary">
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-text-secondary">
              Results ({Math.min(PREVIEW_ROW_LIMIT, queryResult.rowCount)} of{' '}
              {queryResult.rowCount})
            </div>
            <DataTable
              data={previewRows}
              keyExtractor={(row) =>
                queryResult.columns.map((c) => String(row[c] ?? '')).join('|')
              }
              columns={tableColumns}
            />
          </div>
        )}
      </div>
    </div>
  )
}
