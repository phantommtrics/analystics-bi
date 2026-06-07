import { StatementType } from '@prisma/client'
import type { ExecuteQueryResult } from '../datasources/postgres.js'
import {
  type BankStatementConfig,
  type CustomStatementConfig,
  type FinancialPlConfig,
  type LedgerBalanceConfig,
  type StatementConfig,
  parseStatementConfig,
} from './config.js'
import {
  activeCustomStatementColumns,
  formatCustomStatementCell,
  type CustomStatementColumnDef,
} from './columnFormat.js'

function getRowCell(row: Record<string, unknown>, column: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, column)) {
    return row[column]
  }
  const key = Object.keys(row).find((k) => k.toLowerCase() === column.toLowerCase())
  return key !== undefined ? row[key] : undefined
}

function cellString(row: Record<string, unknown>, column?: string): string {
  if (!column) return ''
  const value = getRowCell(row, column)
  if (value === null || value === undefined) return ''
  return String(value)
}

function cellNumber(row: Record<string, unknown>, column?: string): number | undefined {
  if (!column) return undefined
  const value = row[column]
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function formatAmount(value: number | undefined): string {
  if (value === undefined) return ''
  return value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatVariance(value: number | undefined): string {
  if (value === undefined) return ''
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

type CustomColumn = { id: string; header: string; sourceColumn: string }

function activeCustomColumns(customColumns: CustomColumn[] | undefined): CustomColumn[] {
  return (customColumns ?? []).filter(
    (column) => column.header.trim().length > 0 && column.sourceColumn.trim().length > 0,
  )
}

function formatCustomColumnValue(row: Record<string, unknown>, sourceColumn: string): string {
  const numeric = cellNumber(row, sourceColumn)
  if (numeric !== undefined) {
    return numeric.toLocaleString('en-GB', { maximumFractionDigits: 2 })
  }
  return cellString(row, sourceColumn)
}

export function statementToExportResult(
  type: StatementType,
  config: StatementConfig,
  data: ExecuteQueryResult,
  headerData?: ExecuteQueryResult | null,
): ExecuteQueryResult {
  const rows = data.rows
  const latencyMs = data.latencyMs
  const truncated = data.truncated

  switch (type) {
    case StatementType.FINANCIAL_PL: {
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
    case StatementType.BANK_STATEMENT: {
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
          Date: cellString(row, mapping.date),
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
          exportRows.unshift({
            Date: '',
            Description: `${key}: ${String(value ?? '')}`,
          })
        }
      }

      return {
        columns,
        rows: exportRows,
        rowCount: exportRows.length,
        latencyMs,
        truncated,
      }
    }
    case StatementType.LEDGER_BALANCE: {
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

      return {
        columns,
        rows: exportRows,
        rowCount: exportRows.length,
        latencyMs,
        truncated,
      }
    }
    case StatementType.CUSTOM: {
      const customConfig = config as CustomStatementConfig
      const columnDefs = activeCustomStatementColumns(
        customConfig.columns as CustomStatementColumnDef[],
      )
      const exportColumns = columnDefs.map((column) => column.header)
      const exportRows = rows.map((row) => {
        const out: Record<string, string> = {}
        for (const column of columnDefs) {
          const raw = getRowCell(row, column.sourceColumn)
          out[column.header] =
            raw === null || raw === undefined || raw === ''
              ? ''
              : formatCustomStatementCell(raw, column)
        }
        return out
      })
      return {
        columns: exportColumns,
        rows: exportRows,
        rowCount: exportRows.length,
        latencyMs,
        truncated,
      }
    }
    default:
      return data
  }
}

export function parseStatementExportConfig(
  type: StatementType,
  config: unknown,
): StatementConfig {
  return parseStatementConfig(type, config)
}
