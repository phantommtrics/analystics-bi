export type ChartType = 'bar' | 'line' | 'pie' | 'table'

export type BarLineChartData = {
  labels: string[]
  series: { name: string; data: number[] }[]
}

export type PieChartDatum = { name: string; value: number }

function isNumericValue(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return true
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return true
  }
  return false
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  return Number(value) || 0
}

export function numericColumns(
  columns: string[],
  rows: Record<string, unknown>[],
): string[] {
  return columns.filter((col) => rows.some((row) => isNumericValue(row[col])))
}

export function rowsToBarLineChart(
  rows: Record<string, unknown>[],
  columns: string[],
): BarLineChartData | null {
  if (rows.length === 0 || columns.length < 2) {
    return null
  }

  const labelCol = columns[0]
  const valueCols = numericColumns(columns.slice(1), rows)
  if (valueCols.length === 0) {
    return null
  }

  return {
    labels: rows.map((row) => String(row[labelCol] ?? '')),
    series: valueCols.map((col) => ({
      name: col,
      data: rows.map((row) => toNumber(row[col])),
    })),
  }
}

export function rowsToPieChart(
  rows: Record<string, unknown>[],
  columns: string[],
): PieChartDatum[] | null {
  if (rows.length === 0 || columns.length < 2) {
    return null
  }

  const labelCol = columns[0]
  const valueCols = numericColumns(columns.slice(1), rows)
  const valueCol = valueCols[0]
  if (!valueCol) {
    return null
  }

  return rows.map((row) => ({
    name: String(row[labelCol] ?? ''),
    value: toNumber(row[valueCol]),
  }))
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
