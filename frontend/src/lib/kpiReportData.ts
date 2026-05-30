import type { QueryExecuteResult } from '../api/reportBuilder'

export type KpiDataPairOption = {
  id: string
  label: string
  value: string
  rowIndex: number
  labelColumn: string
  valueColumn: string
}

export function formatKpiCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return String(value)
}

function optionLabel(column: string, rowIndex: number, rowCount: number): string {
  if (rowCount <= 1) return column
  return `${column} (row ${rowIndex + 1})`
}

/** Build selectable label/value pairs: column name → cell value for each column and row. */
export function extractKpiPairOptions(result: QueryExecuteResult): KpiDataPairOption[] {
  const { columns, rows } = result
  if (columns.length === 0 || rows.length === 0) return []

  const options: KpiDataPairOption[] = []
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    for (const column of columns) {
      options.push({
        id: `row-${rowIndex}-col-${column}`,
        label: optionLabel(column, rowIndex, rows.length),
        value: formatKpiCell(row[column]),
        rowIndex,
        labelColumn: column,
        valueColumn: column,
      })
    }
  }
  return options
}

export type KpiReportBinding = {
  label: string
  value: string
  savedReportId?: string
  labelColumn?: string
  valueColumn?: string
  rowIndex?: number
}

export function resolveKpiDisplay(
  widget: KpiReportBinding,
  result: QueryExecuteResult | null,
): { label: string; value: string } {
  const column = widget.valueColumn ?? widget.labelColumn
  if (!result || !widget.savedReportId || !column) {
    return { label: widget.label, value: widget.value }
  }

  const rowIndex = widget.rowIndex ?? 0
  const row = result.rows[rowIndex]
  if (!row) {
    return { label: widget.label, value: widget.value }
  }

  return {
    label: column,
    value: formatKpiCell(row[column]),
  }
}

export function pairOptionMatchesWidget(
  option: KpiDataPairOption,
  widget: Pick<KpiReportBinding, 'savedReportId' | 'labelColumn' | 'valueColumn' | 'rowIndex'>,
): boolean {
  const column = widget.valueColumn ?? widget.labelColumn
  return (
    column === option.valueColumn &&
    (widget.rowIndex ?? 0) === option.rowIndex
  )
}
