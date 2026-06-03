import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  auditLogsApi,
  AUDIT_PAGE_SIZE,
  type AuditLogEntry,
  type AuditLogFilters,
} from '../api/auditLogs'
import { TopBar } from '../components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { TablePagination } from '../components/ui/TablePagination'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FILTERS: AuditLogFilters = {
  dateFrom: '',
  dateTo: '',
  user: '',
  action: '',
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

export function AuditLog() {
  const { accessToken, hasPermission } = useAuth()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [draftFilters, setDraftFilters] = useState<AuditLogFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<AuditLogFilters>(EMPTY_FILTERS)
  const [actionOptions, setActionOptions] = useState<string[]>([])

  const canExport = hasPermission('audit', 'export_csv')

  const loadLogs = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const result = await auditLogsApi.list(accessToken, appliedFilters, page)
      setLogs(result.items)
      setTotal(result.total)
      if (result.page !== page) {
        setPage(result.page)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [accessToken, appliedFilters, page])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    if (!accessToken) return
    auditLogsApi
      .listActions(accessToken)
      .then((result) => setActionOptions(result.actions))
      .catch(() => {})
  }, [accessToken])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (appliedFilters.dateFrom) count += 1
    if (appliedFilters.dateTo) count += 1
    if (appliedFilters.user?.trim()) count += 1
    if (appliedFilters.action?.trim()) count += 1
    return count
  }, [appliedFilters])

  function applyFilters() {
    setAppliedFilters({
      dateFrom: draftFilters.dateFrom?.trim() || undefined,
      dateTo: draftFilters.dateTo?.trim() || undefined,
      user: draftFilters.user?.trim() || undefined,
      action: draftFilters.action?.trim() || undefined,
    })
    setPage(1)
    setShowFilters(false)
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setPage(1)
  }

  async function handleExport() {
    if (!accessToken || !canExport) return
    setExportLoading(true)
    setError('')
    try {
      await auditLogsApi.exportCsv(accessToken, appliedFilters)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="System Audit Log"
        showDateFilter={false}
        showExport={canExport}
        onExport={canExport ? handleExport : undefined}
        exportLoading={exportLoading}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <Card noPadding>
          <CardHeader className="mb-0 flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <CardTitle>Event History</CardTitle>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-text-secondary transition-colors hover:text-text-primary"
                >
                  Clear filters ({activeFilterCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDraftFilters({
                    dateFrom: appliedFilters.dateFrom ?? '',
                    dateTo: appliedFilters.dateTo ?? '',
                    user: appliedFilters.user ?? '',
                    action: appliedFilters.action ?? '',
                  })
                  setShowFilters((open) => !open)
                }}
                className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                    : 'border-border bg-bg-secondary text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                <i className="ti ti-filter"></i>
                Filter
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-brand-blue px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </CardHeader>

          {showFilters && (
            <div className="border-b border-border bg-bg-secondary/50 p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-text-primary">From date</span>
                  <input
                    type="date"
                    value={draftFilters.dateFrom ?? ''}
                    onChange={(e) =>
                      setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))
                    }
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-text-primary">To date</span>
                  <input
                    type="date"
                    value={draftFilters.dateTo ?? ''}
                    onChange={(e) =>
                      setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))
                    }
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-text-primary">
                    Username / email
                  </span>
                  <input
                    type="search"
                    placeholder="Search user…"
                    value={draftFilters.user ?? ''}
                    onChange={(e) =>
                      setDraftFilters((f) => ({ ...f, user: e.target.value }))
                    }
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-text-primary">Action</span>
                  <input
                    type="search"
                    list="audit-action-options"
                    placeholder="e.g. LOGIN_SUCCESS"
                    value={draftFilters.action ?? ''}
                    onChange={(e) =>
                      setDraftFilters((f) => ({ ...f, action: e.target.value }))
                    }
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                  />
                  <datalist id="audit-action-options">
                    {actionOptions.map((action) => (
                      <option key={action} value={action} />
                    ))}
                  </datalist>
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftFilters(appliedFilters)
                    setShowFilters(false)
                  }}
                  className="rounded-sm border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary hover:bg-bg-tertiary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="rounded-sm bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy/90"
                >
                  Apply filters
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-text-secondary">
              <i className="ti ti-loader mr-2 animate-spin text-lg"></i>
              Loading audit events…
            </div>
          ) : (
            <>
              <DataTable
                data={logs}
                keyExtractor={(r) => r.id}
                columns={[
                  {
                    header: 'Timestamp',
                    accessor: (r) => formatTimestamp(r.timestamp),
                    className: 'font-mono text-xs text-text-secondary whitespace-nowrap',
                  },
                  {
                    header: 'User',
                    accessor: 'user',
                    className: 'font-medium',
                  },
                  {
                    header: 'Action',
                    accessor: (r) => (
                      <span className="rounded-sm border border-border bg-bg-secondary px-2 py-1 font-mono text-xs">
                        {r.action}
                      </span>
                    ),
                  },
                  {
                    header: 'Resource',
                    accessor: (r) => r.resource ?? '—',
                    className: 'text-sm',
                  },
                  {
                    header: 'IP Address',
                    accessor: (r) => r.ip ?? '—',
                    className: 'font-mono text-xs text-text-secondary',
                  },
                ]}
              />
              <TablePagination
                page={page}
                pageSize={AUDIT_PAGE_SIZE}
                totalRows={total}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
