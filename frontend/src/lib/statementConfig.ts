import type { CustomStatementColumnDef } from './statementColumnFormat'
import { getRowCell } from './kpiReportData'

export type StatementType = 'FINANCIAL_PL' | 'BANK_STATEMENT' | 'LEDGER_BALANCE' | 'CUSTOM'

export type StatementRowType = 'header' | 'subtotal' | 'total' | 'normal'

export interface StatementCustomColumn {
  id: string
  header: string
  sourceColumn: string
}

export interface StatementConfigBase {
  headerTitle?: string
  headerSubtitle?: string
  dataReportId: string
  headerReportId?: string
  customColumns?: StatementCustomColumn[]
}

export function createStatementCustomColumnId() {
  return `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export interface FinancialPlConfig extends StatementConfigBase {
  columnMapping: {
    label: string
    current?: string
    previous?: string
    variance?: string
    rowType?: string
  }
}

export interface BankStatementConfig extends StatementConfigBase {
  showOpeningBalance?: boolean
  columnMapping: {
    date: string
    description: string
    reference?: string
    debit?: string
    credit?: string
    balance?: string
  }
}

export interface LedgerBalanceConfig extends StatementConfigBase {
  groupByColumn?: string
  columnMapping: {
    account: string
    description?: string
    debit?: string
    credit?: string
    net?: string
  }
}

export interface CustomStatementConfig extends Omit<StatementConfigBase, 'customColumns'> {
  columns: CustomStatementColumnDef[]
  groupByColumn?: string
}

export type StatementConfig =
  | FinancialPlConfig
  | BankStatementConfig
  | LedgerBalanceConfig
  | CustomStatementConfig

export function extractReportIdsFromConfig(config: StatementConfig): string[] {
  const ids = [config.dataReportId]
  if (config.headerReportId) {
    ids.push(config.headerReportId)
  }
  return [...new Set(ids)]
}

export function emptyFinancialPlConfig(): FinancialPlConfig {
  return {
    dataReportId: '',
    columnMapping: { label: '' },
  }
}

export function emptyBankStatementConfig(): BankStatementConfig {
  return {
    dataReportId: '',
    showOpeningBalance: true,
    columnMapping: { date: '', description: '' },
  }
}

export function emptyLedgerBalanceConfig(): LedgerBalanceConfig {
  return {
    dataReportId: '',
    columnMapping: { account: '' },
  }
}

export function emptyCustomStatementConfig(): CustomStatementConfig {
  return {
    dataReportId: '',
    columns: [
      {
        id: createStatementCustomColumnId(),
        header: '',
        sourceColumn: '',
        dataType: 'text',
      },
    ],
  }
}

export function emptyConfigForType(type: StatementType): StatementConfig {
  switch (type) {
    case 'FINANCIAL_PL':
      return emptyFinancialPlConfig()
    case 'BANK_STATEMENT':
      return emptyBankStatementConfig()
    case 'LEDGER_BALANCE':
      return emptyLedgerBalanceConfig()
    case 'CUSTOM':
      return emptyCustomStatementConfig()
  }
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function sanitizeConfigBase<T extends StatementConfigBase>(config: T): T {
  const next: StatementConfigBase = {
    ...config,
    dataReportId: config.dataReportId.trim(),
    headerTitle: trimOptional(config.headerTitle),
    headerSubtitle: trimOptional(config.headerSubtitle),
    headerReportId: trimOptional(config.headerReportId),
  }

  if (config.customColumns) {
    const customColumns = config.customColumns.filter(
      (column) => column.header.trim().length > 0 && column.sourceColumn.trim().length > 0,
    )
    next.customColumns = customColumns.length > 0 ? customColumns : undefined
  }

  return next as T
}

/** Normalize config before API save so optional fields and draft rows validate. */
export function sanitizeStatementConfigForSave(
  type: StatementType,
  config: StatementConfig,
): StatementConfig {
  switch (type) {
    case 'FINANCIAL_PL':
      return sanitizeConfigBase(config as FinancialPlConfig)
    case 'BANK_STATEMENT':
      return sanitizeConfigBase(config as BankStatementConfig)
    case 'LEDGER_BALANCE': {
      const next = sanitizeConfigBase(config as LedgerBalanceConfig)
      return {
        ...next,
        groupByColumn: trimOptional(next.groupByColumn),
      }
    }
    case 'CUSTOM': {
      const custom = config as CustomStatementConfig
      const next = sanitizeConfigBase(custom)
      return {
        ...next,
        groupByColumn: trimOptional(custom.groupByColumn),
        columns: custom.columns.map((column) => ({
          ...column,
          header: column.header.trim(),
          sourceColumn: column.sourceColumn.trim(),
          currency: trimOptional(column.currency),
        })),
      }
    }
  }
}

export function parseRowType(value: unknown): StatementRowType {
  const normalized = String(value ?? 'normal').toLowerCase()
  if (normalized === 'header') return 'header'
  if (normalized === 'subtotal') return 'subtotal'
  if (normalized === 'total') return 'total'
  return 'normal'
}

export function cellValue(row: Record<string, unknown>, column?: string): unknown {
  if (!column) return undefined
  return getRowCell(row, column)
}

export function cellNumber(row: Record<string, unknown>, column?: string): number | undefined {
  const value = cellValue(row, column)
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

export function cellString(row: Record<string, unknown>, column?: string): string {
  const value = cellValue(row, column)
  if (value === null || value === undefined) return ''
  return String(value)
}
