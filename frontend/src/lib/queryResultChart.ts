export type ChartPreviewData = {
  labels: string[]
  series: { name: string; data: number[] }[]
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

function formatLabel(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.slice(0, 10)
  }
  return s
}

export function rowsToChartData(
  columns: string[],
  rows: Record<string, unknown>[],
): ChartPreviewData {
  if (columns.length === 0 || rows.length === 0) {
    return { labels: [], series: [] }
  }

  const labelColumn = columns[0]
  const labels = rows.map((row) => formatLabel(row[labelColumn]))

  const numericColumns = columns.slice(1).filter((col) =>
    rows.some((row) => toNumber(row[col]) !== null),
  )

  if (numericColumns.length === 0) {
    const fallbackCol = columns.find(
      (col, i) => i > 0 && rows.some((row) => toNumber(row[col]) !== null),
    )
    if (!fallbackCol) {
      return { labels, series: [] }
    }
    numericColumns.push(fallbackCol)
  }

  const series = numericColumns.map((col) => ({
    name: col,
    data: rows.map((row) => toNumber(row[col]) ?? 0),
  }))

  return { labels, series }
}

export function isNumericColumn(
  column: string,
  rows: Record<string, unknown>[],
): boolean {
  return rows.some((row) => toNumber(row[column]) !== null)
}

export type PieSlice = { name: string; value: number }

/** First numeric series vs label column — suitable for pie/donut charts. */
export function rowsToPieData(
  columns: string[],
  rows: Record<string, unknown>[],
): PieSlice[] {
  const chart = rowsToChartData(columns, rows)
  if (chart.series.length === 0 || chart.labels.length === 0) {
    return []
  }
  const primary = chart.series[0]
  return chart.labels.map((label, i) => ({
    name: label || `Row ${i + 1}`,
    value: primary.data[i] ?? 0,
  }))
}
