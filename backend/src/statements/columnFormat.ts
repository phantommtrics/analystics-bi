export type CustomStatementColumnDataType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'percent'
  | 'boolean'

export type CustomStatementColumnAlign = 'left' | 'center' | 'right'

export type CustomStatementColumnDef = {
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
      return num.toLocaleString('en-GB', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    }
    case 'currency': {
      const num = Number(value)
      if (!Number.isFinite(num)) return String(value)
      const code = column.currency?.trim() || 'GMD'
      return `${code} ${num.toLocaleString('en-GB', {
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
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    }
    case 'datetime': {
      const date = value instanceof Date ? value : new Date(String(value))
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
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
