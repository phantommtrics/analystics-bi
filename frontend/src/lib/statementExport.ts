import type { QueryExecuteResult } from '../api/reportBuilder'
import { activeCustomColumns, formatCustomColumnValue } from './statementCustomColumns'
import {
  activeCustomStatementColumns,
  formatCustomStatementCell,
} from './statementColumnFormat'
import type {
  BankStatementConfig,
  CustomStatementConfig,
  FinancialPlConfig,
  LedgerBalanceConfig,
  StatementConfig,
  StatementType,
} from './statementConfig'
import {
  cellNumber,
  cellString,
  cellValue,
  formatStatementDate,
} from './statementConfig'

function emptyExportRow(columns: string[]): Record<string, string> {
  return Object.fromEntries(columns.map((column) => [column, '']))
}

function metadataExportRow(columns: string[], description: string): Record<string, string> {
  const row = emptyExportRow(columns)
  row.Description = description
  return row
}

function formatAmount(value: number | undefined): string {
  if (value === undefined) return ''
  return value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatVariance(value: number | undefined): string {
  if (value === undefined) return ''
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function statementToExportResult(
  type: StatementType,
  config: StatementConfig,
  data: QueryExecuteResult,
  headerData?: QueryExecuteResult | null,
): QueryExecuteResult {
  const rows = data.rows
  const latencyMs = data.latencyMs
  const truncated = data.truncated

  switch (type) {
    case 'FINANCIAL_PL': {
      const plConfig = config as FinancialPlConfig
      const mapping = plConfig.columnMapping
      const customColumns = activeCustomColumns(plConfig.customColumns)
      const columns = ['Line Item', 'Current Period', 'Previous Period', 'Variance']
      for (const column of customColumns) columns.push(column.header)
      const exportRows = rows.map((row) => {
        const out: Record<string, string> = {
          'Line Item': cellString(row, mapping.label),
          'Current Period': formatAmount(cellNumber(row, mapping.current)),
          'Previous Period': formatAmount(cellNumber(row, mapping.previous)),
          Variance: formatVariance(cellNumber(row, mapping.variance)),
        }
        for (const column of customColumns) {
          out[column.header] = formatCustomColumnValue(row, column.sourceColumn)
        }
        return out
      })
      return {
        columns,
        rows: exportRows,
        rowCount: exportRows.length,
        latencyMs,
        truncated,
      }
    }
    case 'BANK_STATEMENT': {
      const bankConfig = config as BankStatementConfig
      const mapping = bankConfig.columnMapping
      const customColumns = activeCustomColumns(bankConfig.customColumns)
      const columns = ['Date', 'Description']
      if (mapping.reference) columns.push('Reference')
      if (mapping.debit) columns.push('Debit')
      if (mapping.credit) columns.push('Credit')
      if (mapping.balance) columns.push('Balance')
      for (const column of customColumns) columns.push(column.header)

      const exportRows = rows.map((row) => {
        const out: Record<string, string> = {
          Date: formatStatementDate(cellValue(row, mapping.date)),
          Description: cellString(row, mapping.description),
        }
        if (mapping.reference) out.Reference = cellString(row, mapping.reference)
        if (mapping.debit) out.Debit = formatAmount(cellNumber(row, mapping.debit))
        if (mapping.credit) out.Credit = formatAmount(cellNumber(row, mapping.credit))
        if (mapping.balance) out.Balance = formatAmount(cellNumber(row, mapping.balance))
        for (const column of customColumns) {
          out[column.header] = formatCustomColumnValue(row, column.sourceColumn)
        }
        return out
      })

      if (headerData?.rows?.[0]) {
        const header = headerData.rows[0]
        for (const [key, value] of Object.entries(header)) {
          exportRows.unshift(
            metadataExportRow(columns, `${key}: ${String(value ?? '')}`),
          )
        }
      }

      return { columns, rows: exportRows, rowCount: exportRows.length, latencyMs, truncated }
    }
    case 'LEDGER_BALANCE': {
      const ledgerConfig = config as LedgerBalanceConfig
      const mapping = ledgerConfig.columnMapping
      const customColumns = activeCustomColumns(ledgerConfig.customColumns)
      const columns = ['Account']
      if (mapping.description) columns.push('Description')
      if (mapping.debit) columns.push('Debit')
      if (mapping.credit) columns.push('Credit')
      if (mapping.net) columns.push('Net Balance')
      for (const column of customColumns) columns.push(column.header)

      const exportRows = rows.map((row) => {
        const out: Record<string, string> = {
          Account: cellString(row, mapping.account),
        }
        if (mapping.description) out.Description = cellString(row, mapping.description)
        if (mapping.debit) out.Debit = formatAmount(cellNumber(row, mapping.debit))
        if (mapping.credit) out.Credit = formatAmount(cellNumber(row, mapping.credit))
        if (mapping.net) out['Net Balance'] = formatAmount(cellNumber(row, mapping.net))
        for (const column of customColumns) {
          out[column.header] = formatCustomColumnValue(row, column.sourceColumn)
        }
        return out
      })

      return { columns, rows: exportRows, rowCount: exportRows.length, latencyMs, truncated }
    }
    case 'CUSTOM': {
      const customConfig = config as CustomStatementConfig
      const columnDefs = activeCustomStatementColumns(customConfig.columns)
      const columns = columnDefs.map((column) => column.header)
      const exportRows = rows.map((row) => {
        const out: Record<string, string> = {}
        for (const column of columnDefs) {
          const raw = cellValue(row, column.sourceColumn)
          out[column.header] =
            raw === null || raw === undefined || raw === ''
              ? ''
              : formatCustomStatementCell(raw, column)
        }
        return out
      })
      return { columns, rows: exportRows, rowCount: exportRows.length, latencyMs, truncated }
    }
    default:
      return data
  }
}
