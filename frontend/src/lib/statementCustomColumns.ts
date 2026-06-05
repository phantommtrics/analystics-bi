import type { StatementCustomColumn } from './statementConfig'
import { cellNumber, cellString } from './statementConfig'

export function activeCustomColumns(
  customColumns: StatementCustomColumn[] | undefined,
): StatementCustomColumn[] {
  return (customColumns ?? []).filter(
    (column) => column.header.trim().length > 0 && column.sourceColumn.trim().length > 0,
  )
}

export function formatCustomColumnValue(
  row: Record<string, unknown>,
  sourceColumn: string,
): string {
  const numeric = cellNumber(row, sourceColumn)
  if (numeric !== undefined) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return cellString(row, sourceColumn)
}
