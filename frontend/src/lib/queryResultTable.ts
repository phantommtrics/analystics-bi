import type { Column } from '../components/ui/DataTable'
import type { QueryExecuteResult } from '../api/reportBuilder'
import { isNumericColumn } from './queryResultChart'

export const QUERY_TABLE_PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_QUERY_TABLE_PAGE_SIZE = 10
export const COMPACT_QUERY_TABLE_PAGE_SIZE = 15

export function buildQueryResultColumns(
  queryResult: QueryExecuteResult,
): Column<Record<string, unknown>>[] {
  return queryResult.columns.map((col) => ({
    header: col,
    accessor: (row: Record<string, unknown>) => {
      const v = row[col]
      if (v === null || v === undefined) return '—'
      return String(v)
    },
    isNumeric: isNumericColumn(col, queryResult.rows),
    className: isNumericColumn(col, queryResult.rows) ? 'font-mono' : '',
  }))
}

export function queryResultRowKey(
  row: Record<string, unknown>,
  columns: string[],
  index: number,
): string {
  if (columns.length === 0) return `row-${index}`
  const key = columns.map((c) => String(row[c] ?? '')).join('|')
  return key || `row-${index}`
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

export function totalPages(rowCount: number, pageSize: number): number {
  if (rowCount === 0) return 1
  return Math.max(1, Math.ceil(rowCount / pageSize))
}

export function formatQueryStatus(
  queryResult: QueryExecuteResult,
  options?: { loading?: boolean },
): string {
  if (options?.loading) return 'Loading…'
  return `${queryResult.rowCount} row${queryResult.rowCount === 1 ? '' : 's'} · ${queryResult.latencyMs}ms${queryResult.truncated ? ' · truncated at 500' : ''}`
}

export function placeholderColumnHeaders(count = 5): string[] {
  return Array.from({ length: count }, (_, i) => `Column ${i + 1}`)
}
