import { formatKpiCell, getRowCell } from './kpiReportData'

export function buildStatementColumnOptions(
  columns: string[],
  sampleRow?: Record<string, unknown> | null,
  extraValues: string[] = [],
): { id: string; label: string; description?: string }[] {
  const seen = new Set<string>()
  const names: string[] = []

  for (const column of columns) {
    if (!column || seen.has(column)) continue
    seen.add(column)
    names.push(column)
  }

  for (const value of extraValues) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    names.push(value)
  }

  return names.map((column) => {
    const sample = sampleRow ? formatKpiCell(getRowCell(sampleRow, column)) : undefined
    return {
      id: column,
      label: column,
      description: sample && sample !== '—' ? `Sample: ${sample}` : undefined,
    }
  })
}
