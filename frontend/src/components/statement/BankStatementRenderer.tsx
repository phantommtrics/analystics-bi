import type { QueryExecuteResult } from '../../api/reportBuilder'
import { formatGMD } from '../../lib/format'
import {
  activeCustomColumns,
  formatCustomColumnValue,
} from '../../lib/statementCustomColumns'
import {
  cellNumber,
  cellString,
  cellValue,
  formatStatementDate,
  type BankStatementConfig,
} from '../../lib/statementConfig'
import { StatementDocument } from './StatementDocument'

interface BankStatementRendererProps {
  config: BankStatementConfig
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

function formatAmount(value: number | undefined) {
  if (value === undefined) return '-'
  return formatGMD(value)
}

export function BankStatementRenderer({
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
}: BankStatementRendererProps) {
  const mapping = config.columnMapping
  const customColumns = activeCustomColumns(config.customColumns)
  const rows = data?.rows ?? []
  const headerRow = headerData?.rows?.[0]

  const headerFields = headerRow
    ? Object.entries(headerRow).map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="text-text-secondary">{key}: </span>
          <span className="font-medium text-text-primary">{String(value ?? '')}</span>
        </div>
      ))
    : null

  return (
    <StatementDocument
      title={title ?? config.headerTitle ?? 'Account Statement'}
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
              <th className="px-5 py-3 text-xs font-medium uppercase text-text-secondary">
                Date
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase text-text-secondary">
                Description
              </th>
              {mapping.reference && (
                <th className="px-5 py-3 text-xs font-medium uppercase text-text-secondary">
                  Reference
                </th>
              )}
              {mapping.debit && (
                <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                  Debit
                </th>
              )}
              {mapping.credit && (
                <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                  Credit
                </th>
              )}
              {mapping.balance && (
                <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                  Balance
                </th>
              )}
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
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-sm text-text-secondary"
                >
                  No transactions available
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-border transition-colors even:bg-bg-secondary/40 hover:bg-brand-blue/5"
                >
                  <td className="whitespace-nowrap px-5 py-3 text-sm text-text-primary">
                    {formatStatementDate(cellValue(row, mapping.date))}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-primary">
                    {cellString(row, mapping.description)}
                  </td>
                  {mapping.reference && (
                    <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                      {cellString(row, mapping.reference)}
                    </td>
                  )}
                  {mapping.debit && (
                    <td className="px-5 py-3 text-right font-mono text-sm text-semantic-red">
                      {formatAmount(cellNumber(row, mapping.debit))}
                    </td>
                  )}
                  {mapping.credit && (
                    <td className="px-5 py-3 text-right font-mono text-sm text-semantic-green">
                      {formatAmount(cellNumber(row, mapping.credit))}
                    </td>
                  )}
                  {mapping.balance && (
                    <td className="px-5 py-3 text-right font-mono text-sm font-medium text-text-primary">
                      {formatAmount(cellNumber(row, mapping.balance))}
                    </td>
                  )}
                  {customColumns.map((column) => (
                    <td key={column.id} className="px-5 py-3 text-sm text-text-primary">
                      {formatCustomColumnValue(row, column.sourceColumn)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </StatementDocument>
  )
}
