import { Fragment, useMemo } from 'react'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import {
  activeCustomStatementColumns,
  defaultColumnAlign,
  formatCustomStatementCell,
  isNegativeNumericCell,
  type CustomStatementColumnDef,
} from '../../lib/statementColumnFormat'
import { cellString, cellValue, type CustomStatementConfig } from '../../lib/statementConfig'
import { StatementDocument } from './StatementDocument'

interface CustomStatementRendererProps {
  config: CustomStatementConfig
  data: QueryExecuteResult | null
  headerData: QueryExecuteResult | null
  title?: string
  subtitle?: string
  loading?: boolean
  error?: string
  showExport?: boolean
  exportPermissions?: { csv: boolean; pdf: boolean; xlsx: boolean }
  onExport?: (format: 'csv' | 'pdf' | 'xlsx') => void | Promise<void>
}

function alignClass(align: CustomStatementColumnDef['align']) {
  switch (align) {
    case 'center':
      return 'text-center'
    case 'right':
      return 'text-right'
    default:
      return 'text-left'
  }
}

function renderCell(row: Record<string, unknown>, column: CustomStatementColumnDef) {
  const raw = cellValue(row, column.sourceColumn)
  const formatted = formatCustomStatementCell(raw, column)
  const negative =
    column.highlightNegative &&
    (column.dataType === 'number' || column.dataType === 'currency') &&
    isNegativeNumericCell(raw)

  return (
    <span
      className={`${column.monospace ?? column.dataType !== 'text' ? 'font-mono' : ''} ${
        negative ? 'text-semantic-red' : ''
      } ${column.dataType === 'currency' && !negative ? 'text-text-primary' : ''}`}
    >
      {formatted}
    </span>
  )
}

export function CustomStatementRenderer({
  config,
  data,
  headerData,
  title,
  subtitle,
  loading,
  error,
  showExport,
  exportPermissions,
  onExport,
}: CustomStatementRendererProps) {
  const columnDefs = activeCustomStatementColumns(config.columns)
  const rows = data?.rows ?? []
  const headerRow = headerData?.rows?.[0]

  const groupedRows = useMemo(() => {
    if (!config.groupByColumn || rows.length === 0) {
      return [{ group: null as string | null, rows }]
    }

    const groups = new Map<string, Record<string, unknown>[]>()
    for (const row of rows) {
      const group = cellString(row, config.groupByColumn) || 'Other'
      const list = groups.get(group) ?? []
      list.push(row)
      groups.set(group, list)
    }

    return [...groups.entries()].map(([group, groupRows]) => ({
      group,
      rows: groupRows,
    }))
  }, [rows, config.groupByColumn])

  const headerFields = headerRow
    ? Object.entries(headerRow).map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="text-text-secondary">{key}: </span>
          <span className="font-medium text-text-primary">{String(value ?? '')}</span>
        </div>
      ))
    : null

  const colSpan = Math.max(columnDefs.length, 1)

  return (
    <StatementDocument
      title={title ?? config.headerTitle ?? 'Custom Statement'}
      subtitle={subtitle ?? config.headerSubtitle}
      loading={loading}
      error={error}
      showExport={showExport}
      exportPermissions={exportPermissions}
      onExport={onExport}
      headerContent={
        headerFields ? (
          <div className="mt-4 grid gap-2 rounded-md border border-border bg-bg-primary p-4 sm:grid-cols-2">
            {headerFields}
          </div>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bg-tertiary">
              {columnDefs.length === 0 ? (
                <th className="px-5 py-3 text-xs font-medium uppercase text-text-secondary">
                  Configure columns in the builder
                </th>
              ) : (
                columnDefs.map((column) => (
                  <th
                    key={column.id}
                    className={`px-5 py-3 text-xs font-medium uppercase text-text-secondary ${alignClass(
                      column.align ?? defaultColumnAlign(column.dataType),
                    )}`}
                  >
                    {column.header}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 || columnDefs.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-5 py-8 text-center text-sm text-text-secondary"
                >
                  {columnDefs.length === 0
                    ? 'Add at least one column with a display name and report field'
                    : 'No data available'}
                </td>
              </tr>
            ) : (
              groupedRows.map(({ group, rows: groupRows }) => (
                <Fragment key={group ?? 'all'}>
                  {group && (
                    <tr className="border-b border-border bg-bg-tertiary">
                      <td
                        colSpan={colSpan}
                        className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-text-primary"
                      >
                        {group}
                      </td>
                    </tr>
                  )}
                  {groupRows.map((row, index) => (
                    <tr
                      key={`${group ?? 'all'}-${index}`}
                      className="border-b border-border transition-colors even:bg-bg-secondary/40 hover:bg-brand-blue/5"
                    >
                      {columnDefs.map((column) => (
                        <td
                          key={column.id}
                          className={`px-5 py-3 text-sm ${alignClass(
                            column.align ?? defaultColumnAlign(column.dataType),
                          )}`}
                        >
                          {renderCell(row, column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </StatementDocument>
  )
}
