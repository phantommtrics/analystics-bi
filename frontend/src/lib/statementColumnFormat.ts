export type CustomStatementColumnDataType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'percent'
  | 'boolean'

export type CustomStatementColumnAlign = 'left' | 'center' | 'right'

export interface CustomStatementColumnDef {
  id: string
  header: string
  sourceColumn: string
  dataType: CustomStatementColumnDataType
  currency?: string
  decimals?: number
  align?: CustomStatementColumnAlign
  highlightNegative?: boolean
  monospace?: boolean
}

export const STATEMENT_COLUMN_DATA_TYPES: Array<{
  value: CustomStatementColumnDataType
  label: string
  description: string
}> = [
  { value: 'text', label: 'Text', description: 'Plain text values' },
  { value: 'number', label: 'Number', description: 'Numeric values with decimal places' },
  { value: 'currency', label: 'Currency', description: 'Monetary amounts with currency code' },
  { value: 'date', label: 'Date', description: 'Date only' },
  { value: 'datetime', label: 'Date & time', description: 'Date with time' },
  { value: 'percent', label: 'Percent', description: 'Percentage values' },
  { value: 'boolean', label: 'Yes / No', description: 'Boolean or true/false values' },
]

export const STATEMENT_CURRENCY_PRESETS = [
  'GMD',
  'USD',
  'EUR',
  'GBP',
  'NGN',
  'XOF',
  'XAF',
] as const

export const STATEMENT_COLUMN_ALIGN_OPTIONS: Array<{
  value: CustomStatementColumnAlign
  label: string
}> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

export function defaultColumnDecimals(dataType: CustomStatementColumnDataType): number {
  switch (dataType) {
    case 'currency':
      return 2
    case 'number':
      return 2
    case 'percent':
      return 1
    default:
      return 0
  }
}

export function defaultColumnAlign(
  dataType: CustomStatementColumnDataType,
): CustomStatementColumnAlign {
  switch (dataType) {
    case 'number':
    case 'currency':
    case 'percent':
      return 'right'
    default:
      return 'left'
  }
}

export function activeCustomStatementColumns(
  columns: CustomStatementColumnDef[] | undefined,
): CustomStatementColumnDef[] {
  return (columns ?? []).filter(
    (column) => column.header.trim().length > 0 && column.sourceColumn.trim().length > 0,
  )
}

export function formatCustomStatementCell(
  value: unknown,
  column: CustomStatementColumnDef,
): string {
  if (value === null || value === undefined || value === '') return '—'

  const decimals = column.decimals ?? defaultColumnDecimals(column.dataType)

  switch (column.dataType) {
    case 'text':
      return String(value)
    case 'boolean': {
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      const normalized = String(value).toLowerCase()
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return 'Yes'
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return 'No'
      return String(value)
    }
    case 'number': {
      const num = Number(value)
      if (!Number.isFinite(num)) return String(value)
      return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    }
    case 'currency': {
      const num = Number(value)
      if (!Number.isFinite(num)) return String(value)
      const code = column.currency?.trim() || 'GMD'
      return `${code} ${num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`
    }
    case 'percent': {
      const num = Number(value)
      if (!Number.isFinite(num)) return String(value)
      return `${num > 0 ? '+' : ''}${num.toFixed(decimals)}%`
    }
    case 'date': {
      const date = value instanceof Date ? value : new Date(String(value))
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
    }
    case 'datetime': {
      const date = value instanceof Date ? value : new Date(String(value))
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    }
    default:
      return String(value)
  }
}

export function customStatementCellNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

export function isNegativeNumericCell(value: unknown): boolean {
  const num = customStatementCellNumber(value)
  return num !== undefined && num < 0
}
