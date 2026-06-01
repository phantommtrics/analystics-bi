import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { reportsApi, type SavedReportSummary } from '../api/reports'
import { useAuth } from '../auth/AuthContext'
import {
  REPORT_CATEGORIES,
  categoryMeta,
  formatReportDate,
  type ReportCategory,
} from '../lib/reportConstants'

const categoryFilters: Array<{ value: 'All' | ReportCategory; label: string }> = [
  { value: 'All', label: 'All' },
  ...REPORT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
]

export function ReportCatalog() {
  const { accessToken, hasPermission } = useAuth()
  const navigate = useNavigate()
  const canEdit = hasPermission('reports', 'edit') || hasPermission('report-builder', 'edit')
  const canCreateReport = hasPermission('report-builder', 'edit')
  const canDelete =
    hasPermission('reports', 'delete') || hasPermission('report-builder', 'delete')

  const [reports, setReports] = useState<SavedReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'All' | ReportCategory>('All')
  const [pendingDelete, setPendingDelete] = useState<SavedReportSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadReports = useCallback(async () => {
    if (!accessToken) return
    const list = await reportsApi.list(accessToken, {
      search: search.trim() || undefined,
      category: activeCategory === 'All' ? undefined : activeCategory,
      accessibleOnly: true,
    })
    setReports(list)
  }, [accessToken, search, activeCategory])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    loadReports()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [accessToken, loadReports])

  const filteredReports = useMemo(() => reports, [reports])

  function openInBuilder(reportId: string) {
    navigate(`/reports/builder?reportId=${encodeURIComponent(reportId)}`)
  }

  function openReportView(reportId: string) {
    navigate(`/reports/view/${encodeURIComponent(reportId)}`)
  }

  async function confirmDelete() {
    if (!accessToken || !pendingDelete) return
    setDeleteLoading(true)
    try {
      await reportsApi.delete(accessToken, pendingDelete.id)
      await loadReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report')
    } finally {
      setDeleteLoading(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Report Catalog"
        showDateFilter={false}
        showExport={false}
        primaryAction={
          canCreateReport
            ? {
                label: 'New report',
                onClick: () => navigate('/reports/builder'),
                icon: 'ti-plus',
              }
            : undefined
        }
        toolbar={
          <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-bg-secondary p-1">
              {categoryFilters.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setActiveCategory(cat.value)}
                  className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat.value ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-80">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"></i>
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-sm border border-border bg-bg-primary py-2 pl-10 pr-4 text-sm text-text-primary outline-none transition-colors focus:border-brand-blue"
              />
            </div>
          </div>
        }
      />

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {error && (
          <div className="rounded-md border border-semantic-red/20 bg-semantic-red/10 px-3 py-2 text-sm text-semantic-red">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between px-1 text-xs text-text-secondary">
          <span>
            {loading ? (
              'Loading...'
            ) : (
              <>
                Showing{' '}
                <span className="font-medium text-text-primary">
                  {filteredReports.length}
                </span>{' '}
                saved report{filteredReports.length === 1 ? '' : 's'}
                {!loading && ' you can access'}
              </>
            )}
          </span>
        </div>

        <Card noPadding className="overflow-hidden">
          <div className="hidden grid-cols-12 gap-4 border-b border-border bg-bg-secondary px-5 py-3 text-micro font-medium uppercase tracking-wider text-text-secondary md:grid">
            <div className="col-span-4">Report</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Data source</div>
            <div className="col-span-2">Updated</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-border">
            {loading ? (
              <div className="py-16 text-center text-sm text-text-secondary">
                Loading reports...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="py-16 text-center text-text-secondary">
                <i className="ti ti-file-search mb-2 block text-3xl"></i>
                <p className="text-sm">No published reports available</p>
                {canCreateReport && (
                  <button
                    onClick={() => navigate('/reports/builder')}
                    className="mt-2 text-xs text-brand-blue hover:underline"
                  >
                    Create and publish a report
                  </button>
                )}
              </div>
            ) : (
              filteredReports.map((report) => {
                const meta = categoryMeta[report.category]

                return (
                  <div
                    key={report.id}
                    className="group grid grid-cols-12 items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-tertiary"
                  >
                    <div className="col-span-12 flex min-w-0 items-center gap-3 md:col-span-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue`}
                      >
                        <i className={`ti ${meta.icon} text-xl`}></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text-primary">
                          {report.name}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
                          {report.description || 'No description'}
                          {report.createdByUsername
                            ? ` · ${report.createdByUsername}`
                            : ''}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                    </div>

                    <div className="col-span-6 text-xs text-text-secondary md:col-span-2">
                      <div className="font-medium text-text-primary">
                        {report.dataSourceName}
                      </div>
                      <div>{report.dataSourceDatabase}</div>
                    </div>

                    <div className="col-span-6 text-xs text-text-secondary md:col-span-2">
                      {formatReportDate(report.updatedAt)}
                    </div>

                    <div className="col-span-12 flex items-center justify-end gap-1 md:col-span-2">
                      {canEdit && (
                        <button
                          type="button"
                          className="rounded-sm px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
                          title="Open in builder"
                          onClick={() => openInBuilder(report.id)}
                        >
                          <i className="ti ti-edit mr-1"></i>
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-sm p-1.5 text-text-secondary transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
                        title="Run report"
                        onClick={() => openReportView(report.id)}
                      >
                        <i className="ti ti-player-play text-base"></i>
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          className="rounded-sm p-1.5 text-text-secondary transition-colors hover:bg-semantic-red/10 hover:text-semantic-red"
                          title="Delete report"
                          onClick={() => setPendingDelete(report)}
                        >
                          <i className="ti ti-trash text-base"></i>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete report?"
        message={`Remove "${pendingDelete?.name}" from the catalog? The report will be soft-deleted.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
