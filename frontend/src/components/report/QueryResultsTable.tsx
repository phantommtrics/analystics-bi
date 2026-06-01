import { useEffect, useMemo, useState } from 'react'
import type { QueryExecuteResult } from '../../api/reportBuilder'
import {
  buildQueryResultColumns,
  DEFAULT_QUERY_TABLE_PAGE_SIZE,
  paginateRows,
  placeholderColumnHeaders,
  queryResultRowKey,
  QUERY_TABLE_PAGE_SIZES,
  totalPages,
} from '../../lib/queryResultTable'
import { DataTable } from '../ui/DataTable'
import { DataTableSkeleton } from '../ui/DataTableSkeleton'
import { TablePagination } from '../ui/TablePagination'

interface QueryResultsTableProps {
  queryResult: QueryExecuteResult | null
  loading?: boolean
  /** Column names for skeleton when loading before first result. */
  skeletonColumns?: string[]
  defaultPageSize?: number
  skeletonRowCount?: number
  compact?: boolean
  className?: string
  showPageSizeSelector?: boolean
}

export function QueryResultsTable({
  queryResult,
  loading = false,
  skeletonColumns,
  defaultPageSize = DEFAULT_QUERY_TABLE_PAGE_SIZE,
  skeletonRowCount = 10,
  compact = false,
  className = '',
  showPageSizeSelector = true,
}: QueryResultsTableProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const columnHeaders = useMemo(() => {
    if (queryResult?.columns.length) return queryResult.columns
    if (skeletonColumns?.length) return skeletonColumns
    return placeholderColumnHeaders(5)
  }, [queryResult, skeletonColumns])

  const columns = useMemo(() => {
    if (!queryResult) return []
    return buildQueryResultColumns(queryResult)
  }, [queryResult])

  const rows = queryResult?.rows ?? []
  const pages = totalPages(rows.length, pageSize)

  const paginatedRows = useMemo(
    () => paginateRows(rows, page, pageSize),
    [rows, page, pageSize],
  )

  useEffect(() => {
    setPage(1)
  }, [queryResult, pageSize])

  useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])

  const showSkeleton = loading && !queryResult
  const showSkeletonOverlay = loading && queryResult

  if (!loading && !queryResult) {
    return null
  }

  if (showSkeleton) {
    return (
      <div
        className={`overflow-hidden rounded-md border border-border bg-bg-primary ${className}`}
      >
        <DataTableSkeleton
          columnHeaders={skeletonColumns}
          columnCount={columnHeaders.length}
          rowCount={skeletonRowCount}
          compact={compact}
        />
        <div
          className={`border-t border-border bg-bg-secondary text-text-secondary ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'}`}
        >
          Loading results…
        </div>
      </div>
    )
  }

  if (!queryResult) {
    return null
  }

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-border bg-bg-primary ${className}`}
    >
      {showSkeletonOverlay && (
        <div className="absolute inset-0 z-10 bg-bg-primary/80">
          <DataTableSkeleton
            columnHeaders={queryResult.columns}
            rowCount={Math.min(skeletonRowCount, pageSize)}
            compact={compact}
          />
        </div>
      )}

      <DataTable
        data={paginatedRows}
        columns={columns}
        keyExtractor={(row) => {
          const index = rows.indexOf(row)
          return queryResultRowKey(row, queryResult.columns, index >= 0 ? index : 0)
        }}
      />

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalRows={rows.length}
        pageSizeOptions={QUERY_TABLE_PAGE_SIZES}
        onPageChange={setPage}
        onPageSizeChange={showPageSizeSelector ? setPageSize : undefined}
        compact={compact}
      />
    </div>
  )
}
