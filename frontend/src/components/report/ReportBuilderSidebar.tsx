import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../ui/Badge'
import { LoadingButton } from '../ui/LoadingButton'
import { TablePagination } from '../ui/TablePagination'
import type { SavedReportSummary } from '../../api/reports'
import { categoryMeta, formatReportDate } from '../../lib/reportConstants'
import { paginateRows } from '../../lib/queryResultTable'

const SIDEBAR_PAGE_SIZES = [6, 12, 20] as const
const DEFAULT_SIDEBAR_PAGE_SIZE = 6

interface ReportBuilderSidebarProps {
  reports: SavedReportSummary[]
  activeReportId: string | null
  openReportIds: string[]
  loading: boolean
  canEdit: boolean
  canDelete: boolean
  onSelect: (report: SavedReportSummary) => void
  onNew: () => void
  onDelete: (report: SavedReportSummary) => void
}

export function ReportBuilderSidebar({
  reports,
  activeReportId,
  openReportIds,
  loading,
  canEdit,
  canDelete,
  onSelect,
  onNew,
  onDelete,
}: ReportBuilderSidebarProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_SIDEBAR_PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return reports
    return reports.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.dataSourceName.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    )
  }, [reports, search])

  const paginatedReports = useMemo(
    () => paginateRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  )

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
    if (page > pages) {
      setPage(pages)
    }
  }, [filtered.length, page, pageSize])

  useEffect(() => {
    if (!activeReportId || filtered.length === 0) return
    const idx = filtered.findIndex((r) => r.id === activeReportId)
    if (idx === -1) return
    const pageForActive = Math.floor(idx / pageSize) + 1
    setPage((current) => (current === pageForActive ? current : pageForActive))
  }, [activeReportId, filtered, pageSize])

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-bg-primary lg:h-full lg:max-h-full lg:w-[280px] lg:border-b-0 lg:border-r">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Saved reports</h2>
            <p className="text-xs text-text-secondary">
              {search.trim() ? `${filtered.length} of ${reports.length}` : reports.length} total
            </p>
          </div>
          {canEdit && (
            <LoadingButton
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={onNew}
            >
              <i className="ti ti-plus"></i>
              New
            </LoadingButton>
          )}
        </div>
        <div className="relative mt-3">
          <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-text-secondary"></i>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved reports..."
            className="w-full rounded-md border border-border bg-bg-secondary py-2 pl-8 pr-3 text-xs outline-none focus:border-brand-blue"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-4 text-xs text-text-secondary">Loading reports...</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-4 text-xs text-text-secondary">
            {search ? 'No reports match your search.' : 'No saved reports yet. Create one from the editor.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {paginatedReports.map((report) => {
              const meta = categoryMeta[report.category]
              const isOpen = openReportIds.includes(report.id)
              const isActive = report.id === activeReportId || isOpen
              return (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(report)}
                    className={`group w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                      report.id === activeReportId
                        ? 'border-brand-blue/40 bg-brand-blue/5'
                        : isOpen
                          ? 'border-brand-blue/20 bg-brand-blue/[0.02]'
                          : 'border-transparent hover:border-border hover:bg-bg-secondary'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-medium text-text-primary">
                        {report.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {report.isPublished ? (
                          <span className="rounded-full bg-brand-blue/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-brand-blue">
                            Live
                          </span>
                        ) : (
                          <span className="rounded-full bg-bg-secondary px-1.5 py-0.5 text-[9px] font-medium uppercase text-text-secondary">
                            Draft
                          </span>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            title="Delete report"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDelete(report)
                            }}
                            className="shrink-0 rounded p-1 text-text-secondary opacity-0 transition-opacity hover:bg-semantic-red/10 hover:text-semantic-red group-hover:opacity-100"
                          >
                            <i className="ti ti-trash text-sm"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                      <span className="text-[10px] text-text-secondary">
                        {report.dataSourceName}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-text-secondary">
                      Updated {formatReportDate(report.updatedAt)}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <TablePagination
          compact
          page={page}
          pageSize={pageSize}
          totalRows={filtered.length}
          pageSizeOptions={SIDEBAR_PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      )}
    </aside>
  )
}
