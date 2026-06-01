interface TablePaginationProps {
  page: number
  pageSize: number
  totalRows: number
  pageSizeOptions?: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  compact?: boolean
}

export function TablePagination({
  page,
  pageSize,
  totalRows,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  compact = false,
}: TablePaginationProps) {
  const pages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(page, pages)
  const start = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalRows)

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-t border-border bg-bg-secondary text-text-secondary ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'}`}
    >
      <span>
        {totalRows === 0
          ? 'No rows'
          : `Showing ${start}–${end} of ${totalRows}`}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-sm border border-border bg-bg-primary px-1.5 py-0.5 text-inherit outline-none focus:border-brand-blue"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="rounded-sm px-2 py-1 transition-colors hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <i className="ti ti-chevron-left"></i>
          </button>
          <span className="min-w-[4.5rem] text-center tabular-nums">
            {safePage} / {pages}
          </span>
          <button
            type="button"
            disabled={safePage >= pages}
            onClick={() => onPageChange(safePage + 1)}
            className="rounded-sm px-2 py-1 transition-colors hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <i className="ti ti-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  )
}
