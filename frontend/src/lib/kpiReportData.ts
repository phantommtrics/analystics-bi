import type { QueryExecuteResult } from '../api/reportBuilder'
import {
  filtersToQueryRecord,
  filtersWithPreset,
  serializeQueryFilters,
} from './dashboardFilters'

export type KpiDataPairOption = {
  id: string
  label: string
  value: string
  rowIndex: number
  labelColumn: string
  valueColumn: string
}

/** Broader range used only when picking KPI columns in the builder. */
export function buildKpiPreviewFilters(): Record<string, string> {
  return filtersToQueryRecord(filtersWithPreset('last-365-days')) ?? {}
}

export function getRowCell(row: Record<string, unknown>, column: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, column)) {
    return row[column]
  }
  const key = Object.keys(row).find((k) => k.toLowerCase() === column.toLowerCase())
  return key !== undefined ? row[key] : undefined
}

export function formatKpiCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    const text = Number.isInteger(value)
      ? String(value)
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return text === '' ? '—' : text
  }
  const text = String(value)
  return text === '' ? '—' : text
}

function optionLabel(column: string, rowIndex: number, rowCount: number): string {
  if (rowCount <= 1) return column
  return `${column} (row ${rowIndex + 1})`
}

/** Build selectable label/value pairs: column name → cell value for each column and row. */
export function extractKpiPairOptions(result: QueryExecuteResult): KpiDataPairOption[] {
  const { columns, rows } = result
  if (columns.length === 0) return []

  if (rows.length === 0) {
    return columns.map((column) => ({
      id: `col-${column}`,
      label: column,
      value: '—',
      rowIndex: 0,
      labelColumn: column,
      valueColumn: column,
    }))
  }

  const options: KpiDataPairOption[] = []
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    for (const column of columns) {
      options.push({
        id: `row-${rowIndex}-col-${column}`,
        label: optionLabel(column, rowIndex, rows.length),
        value: formatKpiCell(getRowCell(row, column)),
        rowIndex,
        labelColumn: column,
        valueColumn: column,
      })
    }
  }
  return options
}

export async function fetchKpiPairOptions(
  execute: (filters: Record<string, string>) => Promise<QueryExecuteResult>,
  dashboardFilters: Record<string, string>,
): Promise<{ options: KpiDataPairOption[]; usedPreviewFilters: boolean }> {
  const filterAttempts: Record<string, string>[] = [dashboardFilters]
  const previewFilters = buildKpiPreviewFilters()
  if (serializeQueryFilters(previewFilters) !== serializeQueryFilters(dashboardFilters)) {
    filterAttempts.push(previewFilters)
  }
  if (!filterAttempts.some((f) => serializeQueryFilters(f) === serializeQueryFilters({}))) {
    filterAttempts.push({})
  }

  let columnsResult: QueryExecuteResult | null = null

  for (const filters of filterAttempts) {
    try {
      const result = await execute(filters)
      if (result.rows.length > 0) {
        return {
          options: extractKpiPairOptions(result),
          usedPreviewFilters: serializeQueryFilters(filters) !== serializeQueryFilters(dashboardFilters),
        }
      }
      if (result.columns.length > 0) {
        columnsResult = result
      }
    } catch {
      // try next filter set
    }
  }

  return {
    options: extractKpiPairOptions(
      columnsResult ?? { columns: [], rows: [], rowCount: 0, latencyMs: 0, truncated: false },
    ),
    usedPreviewFilters: false,
  }
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
  if (!widget.savedReportId || !column) {
    return { label: widget.label, value: widget.value }
  }

  if (!result) {
    return { label: column, value: widget.value }
  }

  if (result.rows.length === 0) {
    return { label: column, value: '—' }
  }

  const rowIndex = widget.rowIndex ?? 0
  const row = result.rows[rowIndex] ?? result.rows[0]
  if (!row) {
    return { label: column, value: '—' }
  }

  return {
    label: column,
    value: formatKpiCell(getRowCell(row, column)),
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
