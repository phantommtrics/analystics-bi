import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { ScrollableTabList } from '../components/ui/ScrollableTabList'
import { statementsApi, type StatementSummary } from '../api/statements'
import { useAuth } from '../auth/AuthContext'
import {
  REPORT_CATEGORIES,
  categoryMeta,
  formatReportDate,
  type ReportCategory,
} from '../lib/reportConstants'
import { STATEMENT_TYPES, statementTypeMeta } from '../lib/statementConstants'
import type { StatementType } from '../lib/statementConfig'

const categoryFilters: Array<{ value: 'All' | ReportCategory; label: string }> = [
  { value: 'All', label: 'All' },
  ...REPORT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
]

const typeFilters: Array<{ value: 'All' | StatementType; label: string }> = [
  { value: 'All', label: 'All types' },
  ...STATEMENT_TYPES.map((t) => ({ value: t.value, label: t.label })),
]

export function StatementCatalog() {
  const { accessToken, hasPermission } = useAuth()
  const navigate = useNavigate()
  const canEdit = hasPermission('statement-builder', 'edit')
  const canDelete = hasPermission('statement-builder', 'delete')
  const canCreate = hasPermission('statement-builder', 'edit')

  const [statements, setStatements] = useState<StatementSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'All' | ReportCategory>('All')
  const [activeType, setActiveType] = useState<'All' | StatementType>('All')
  const [pendingDelete, setPendingDelete] = useState<StatementSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadStatements = useCallback(async () => {
    if (!accessToken) return
    const list = await statementsApi.list(accessToken, {
      search: search.trim() || undefined,
      category: activeCategory === 'All' ? undefined : activeCategory,
      type: activeType === 'All' ? undefined : activeType,
      accessibleOnly: true,
    })
    setStatements(list)
  }, [accessToken, search, activeCategory, activeType])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    loadStatements()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load statements'))
      .finally(() => setLoading(false))
  }, [accessToken, loadStatements])

  const filteredStatements = useMemo(() => statements, [statements])

  function openStatement(statementId: string) {
    navigate(`/statements/${encodeURIComponent(statementId)}`)
  }

  function openInBuilder(statementId: string) {
    navigate(`/statement-builder?statementId=${encodeURIComponent(statementId)}`)
  }

  async function confirmDelete() {
    if (!accessToken || !pendingDelete) return
    setDeleteLoading(true)
    try {
      await statementsApi.delete(accessToken, pendingDelete.id)
      await loadStatements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete statement')
    } finally {
      setDeleteLoading(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Statement Catalog"
        showDateFilter={false}
        showExport={false}
        primaryAction={
          canCreate
            ? {
                label: 'New statement',
                onClick: () => navigate('/statement-builder'),
                icon: 'ti-plus',
              }
            : undefined
        }
        toolbar={
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <ScrollableTabList
              className="w-full min-w-0 lg:flex-1"
              items={categoryFilters}
              value={activeCategory}
              onChange={setActiveCategory}
              ariaLabel="Statement category filters"
            />
            <ScrollableTabList
              className="w-full min-w-0 lg:w-auto"
              items={typeFilters}
              value={activeType}
              onChange={setActiveType}
              ariaLabel="Statement type filters"
            />
            <div className="relative w-full shrink-0 lg:w-80">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"></i>
              <input
                type="text"
                placeholder="Search statements..."
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
                  {filteredStatements.length}
                </span>{' '}
                statement{filteredStatements.length === 1 ? '' : 's'}
                {!loading && ' you can access'}
              </>
            )}
          </span>
        </div>

        <Card noPadding className="overflow-hidden">
          <div className="hidden grid-cols-12 gap-4 border-b border-border bg-bg-secondary px-5 py-3 text-micro font-medium uppercase tracking-wider text-text-secondary md:grid">
            <div className="col-span-4">Statement</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Updated</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-border">
            {loading ? (
              <div className="py-16 text-center text-sm text-text-secondary">
                Loading statements...
              </div>
            ) : filteredStatements.length === 0 ? (
              <div className="py-16 text-center text-text-secondary">
                <i className="ti ti-receipt mb-2 block text-3xl"></i>
                <p className="text-sm">No published statements available</p>
                {canCreate && (
                  <button
                    onClick={() => navigate('/statement-builder')}
                    className="mt-2 text-xs text-brand-blue hover:underline"
                  >
                    Create and publish a statement
                  </button>
                )}
              </div>
            ) : (
              filteredStatements.map((statement) => {
                const category = categoryMeta[statement.category]
                const typeMeta = statementTypeMeta(statement.type)

                return (
                  <div
                    key={statement.id}
                    className="group grid grid-cols-12 items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-tertiary"
                  >
                    <div className="col-span-12 flex min-w-0 items-center gap-3 md:col-span-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                        <i className={`ti ${typeMeta.icon} text-xl`}></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text-primary">
                          {statement.name}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
                          {statement.description || 'No description'}
                          {statement.createdByUsername
                            ? ` · ${statement.createdByUsername}`
                            : ''}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <Badge variant="gray">{typeMeta.label}</Badge>
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <Badge variant={category.badgeVariant}>{category.label}</Badge>
                    </div>

                    <div className="col-span-6 text-xs text-text-secondary md:col-span-2">
                      {formatReportDate(statement.updatedAt)}
                    </div>

                    <div className="col-span-12 flex items-center justify-end gap-1 md:col-span-2">
                      {canEdit && (
                        <button
                          type="button"
                          className="rounded-sm px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
                          title="Open in builder"
                          onClick={() => openInBuilder(statement.id)}
                        >
                          <i className="ti ti-edit mr-1"></i>
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-sm p-1.5 text-text-secondary transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
                        title="Open statement"
                        onClick={() => openStatement(statement.id)}
                      >
                        <i className="ti ti-eye text-base"></i>
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          className="rounded-sm p-1.5 text-text-secondary transition-colors hover:bg-semantic-red/10 hover:text-semantic-red"
                          title="Delete statement"
                          onClick={() => setPendingDelete(statement)}
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
        title="Delete statement?"
        message={`Remove "${pendingDelete?.name}" from the catalog? The statement will be soft-deleted.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
