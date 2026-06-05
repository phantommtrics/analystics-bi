import { Fragment, useMemo } from 'react'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import { formatGMD } from '../../lib/format'
import {
  activeCustomColumns,
  formatCustomColumnValue,
} from '../../lib/statementCustomColumns'
import { cellNumber, cellString, type LedgerBalanceConfig } from '../../lib/statementConfig'
import { StatementDocument } from './StatementDocument'

interface LedgerBalanceRendererProps {
  config: LedgerBalanceConfig
  data: QueryExecuteResult | null
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

export function LedgerBalanceRenderer({
  config,
  data,
  title,
  subtitle,
  loading,
  error,
  showExport,
  exportPermissions,
  onExport,
}: LedgerBalanceRendererProps) {
  const mapping = config.columnMapping
  const customColumns = activeCustomColumns(config.customColumns)
  const rows = data?.rows ?? []

  const baseColumnCount =
    1 +
    (mapping.description ? 1 : 0) +
    (mapping.debit ? 1 : 0) +
    (mapping.credit ? 1 : 0) +
    (mapping.net ? 1 : 0)
  const totalColumns = baseColumnCount + customColumns.length

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

  const totals = useMemo(() => {
    let debit = 0
    let credit = 0
    let net = 0
    for (const row of rows) {
      debit += cellNumber(row, mapping.debit) ?? 0
      credit += cellNumber(row, mapping.credit) ?? 0
      net += cellNumber(row, mapping.net) ?? 0
    }
    return { debit, credit, net }
  }, [rows, mapping.debit, mapping.credit, mapping.net])

  return (
    <StatementDocument
      title={title ?? config.headerTitle ?? 'Ledger Balance Statement'}
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
            <tr className="border-b border-border bg-bg-tertiary">
              <th className="px-5 py-3 text-xs font-medium uppercase text-text-secondary">
                Account
              </th>
              {mapping.description && (
                <th className="px-5 py-3 text-xs font-medium uppercase text-text-secondary">
                  Description
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
              {mapping.net && (
                <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                  Net Balance
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
                  colSpan={totalColumns}
                  className="px-5 py-8 text-center text-sm text-text-secondary"
                >
                  No account balances available
                </td>
              </tr>
            ) : (
              groupedRows.map(({ group, rows: groupRows }) => (
                <Fragment key={group ?? 'all'}>
                  {group && (
                    <tr className="border-b border-border bg-bg-tertiary">
                      <td
                        colSpan={totalColumns}
                        className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-text-primary"
                      >
                        {group}
                      </td>
                    </tr>
                  )}
                  {groupRows.map((row, index) => (
                    <tr
                      key={`${group ?? 'all'}-${index}`}
                      className="border-b border-border transition-colors hover:bg-brand-blue/5"
                    >
                      <td className="px-5 py-3 text-sm font-medium text-text-primary">
                        {cellString(row, mapping.account)}
                      </td>
                      {mapping.description && (
                        <td className="px-5 py-3 text-sm text-text-secondary">
                          {cellString(row, mapping.description)}
                        </td>
                      )}
                      {mapping.debit && (
                        <td className="px-5 py-3 text-right font-mono text-sm text-text-primary">
                          {formatAmount(cellNumber(row, mapping.debit))}
                        </td>
                      )}
                      {mapping.credit && (
                        <td className="px-5 py-3 text-right font-mono text-sm text-text-primary">
                          {formatAmount(cellNumber(row, mapping.credit))}
                        </td>
                      )}
                      {mapping.net && (
                        <td className="px-5 py-3 text-right font-mono text-sm font-medium text-text-primary">
                          {formatAmount(cellNumber(row, mapping.net))}
                        </td>
                      )}
                      {customColumns.map((column) => (
                        <td key={column.id} className="px-5 py-3 text-sm text-text-primary">
                          {formatCustomColumnValue(row, column.sourceColumn)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
            {rows.length > 0 && (
              <tr className="border-t-2 border-border bg-brand-navy/5 font-bold dark:bg-brand-blue/20">
                <td
                  className="px-5 py-3 text-sm text-text-primary"
                  colSpan={mapping.description ? 2 : 1}
                >
                  Total
                </td>
                {mapping.debit && (
                  <td className="px-5 py-3 text-right font-mono text-sm">
                    {formatAmount(totals.debit)}
                  </td>
                )}
                {mapping.credit && (
                  <td className="px-5 py-3 text-right font-mono text-sm">
                    {formatAmount(totals.credit)}
                  </td>
                )}
                {mapping.net && (
                  <td className="px-5 py-3 text-right font-mono text-sm">
                    {formatAmount(totals.net)}
                  </td>
                )}
                {customColumns.map((column) => (
                  <td key={column.id} className="px-5 py-3 text-sm text-text-secondary">
                    —
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </StatementDocument>
  )
}
