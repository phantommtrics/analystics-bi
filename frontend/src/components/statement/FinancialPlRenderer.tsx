import type { QueryExecuteResult } from '../../api/reportBuilder'
import { formatGMD } from '../../lib/format'
import {
  activeCustomColumns,
  formatCustomColumnValue,
} from '../../lib/statementCustomColumns'
import {
  cellNumber,
  cellString,
  parseRowType,
  type FinancialPlConfig,
} from '../../lib/statementConfig'
import { StatementDocument } from './StatementDocument'

interface FinancialPlRendererProps {
  config: FinancialPlConfig
  data: QueryExecuteResult | null
  title?: string
  subtitle?: string
  loading?: boolean
  error?: string
  showExport?: boolean
  exportPermissions?: { csv: boolean; pdf: boolean; xlsx: boolean }
  onExport?: (format: 'csv' | 'pdf' | 'xlsx') => void | Promise<void>
}

export function FinancialPlRenderer({
  config,
  data,
  title,
  subtitle,
  loading,
  error,
  showExport,
  exportPermissions,
  onExport,
}: FinancialPlRendererProps) {
  const mapping = config.columnMapping
  const customColumns = activeCustomColumns(config.customColumns)
  const baseColumnCount = 4
  const totalColumns = baseColumnCount + customColumns.length
  const rows = data?.rows ?? []

  return (
    <StatementDocument
      title={title ?? config.headerTitle ?? 'Profit & Loss Statement'}
      subtitle={subtitle ?? config.headerSubtitle}
      loading={loading}
      error={error}
      showExport={showExport}
      exportPermissions={exportPermissions}
      onExport={onExport}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="w-1/2 px-5 py-3 text-xs font-medium uppercase text-text-secondary">
                Line Item
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                Current Period
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                Previous Period
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                Variance
              </th>
              {customColumns.map((column) => (
                <th
                  key={column.id}
                  className="px-5 py-3 text-xs font-medium uppercase text-text-secondary"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="px-5 py-8 text-center text-sm text-text-secondary">
                  No data available
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const rowType = parseRowType(
                  mapping.rowType ? row[mapping.rowType] : 'normal',
                )
                const label = cellString(row, mapping.label)
                const current = cellNumber(row, mapping.current)
                const previous = cellNumber(row, mapping.previous)
                const variance = cellNumber(row, mapping.variance)

                if (rowType === 'header') {
                  return (
                    <tr key={index} className="border-b border-border bg-bg-tertiary">
                      <td
                        colSpan={totalColumns}
                        className="px-5 py-3 text-xs font-bold tracking-wider text-text-primary"
                      >
                        {label}
                      </td>
                    </tr>
                  )
                }

                const varColor =
                  variance !== undefined
                    ? variance > 0
                      ? 'text-semantic-green'
                      : variance < 0
                        ? 'text-semantic-red'
                        : 'text-text-secondary'
                    : 'text-text-secondary'

                return (
                  <tr
                    key={index}
                    className={`
                      border-b border-border transition-colors hover:bg-[#EAF0FB] dark:hover:bg-brand-blue/10
                      ${rowType === 'subtotal' ? 'bg-bg-tertiary font-medium' : ''}
                      ${rowType === 'total' ? 'bg-brand-navy/5 text-lg font-bold dark:bg-brand-blue/20' : ''}
                    `}
                  >
                    <td
                      className={`px-5 py-3 text-sm ${rowType === 'subtotal' || rowType === 'total' ? 'text-text-primary' : 'pl-8 text-text-secondary'}`}
                    >
                      {label}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm text-text-primary">
                      {current !== undefined ? formatGMD(current) : '-'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm text-text-secondary">
                      {previous !== undefined ? formatGMD(previous) : '-'}
                    </td>
                    <td className={`px-5 py-3 text-right font-mono text-sm ${varColor}`}>
                      {variance !== undefined
                        ? `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`
                        : '-'}
                    </td>
                    {customColumns.map((column) => (
                      <td key={column.id} className="px-5 py-3 text-sm text-text-primary">
                        {formatCustomColumnValue(row, column.sourceColumn)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </StatementDocument>
  )
}
