import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { DashboardGrid } from '../components/dashboard/DashboardGrid'
import { TopBar } from '../components/layout/TopBar'
import { dashboardsApi, type DashboardDetail } from '../api/dashboards'
import { type SavedReportSummary } from '../api/reports'
import { useAuth } from '../auth/AuthContext'
import { useDashboardFilters } from '../hooks/useDashboardFilters'
import { canViewCustomDashboard, dashboardModuleKey, filtersToQueryRecord, serializeQueryFilters } from '../lib/dashboardFilters'
import type { DashboardLayout } from '../lib/dashboardLayout'

export function CustomDashboard() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, hasPermission, user } = useAuth()
  const { filters, setFilters } = useDashboardFilters()

  const [dashboard, setDashboard] = useState<DashboardDetail | null>(null)
  const [reports, setReports] = useState<SavedReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const permissions = user?.permissions ?? []
  const canViewCustom = id ? canViewCustomDashboard(permissions, id, user?.userType) : false
  const queryFilters = useMemo(() => filtersToQueryRecord(filters), [filters])
  const filterKey = useMemo(() => serializeQueryFilters(queryFilters), [queryFilters])

  const loadDashboard = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    setError('')
    try {
      const [detail, reportList] = await Promise.all([
        dashboardsApi.get(accessToken, id),
        dashboardsApi.getReports(accessToken, id),
      ])
      setDashboard(detail)
      setReports(reportList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      setDashboard(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  if (!id) {
    return <Navigate to="/" replace />
  }

  if (!loading && dashboard && !dashboard.isPublished && !hasPermission('dashboard-builder', 'view')) {
    return <Navigate to="/" replace />
  }

  if (!loading && !canViewCustom && !hasPermission('dashboard-builder', 'view')) {
    return <Navigate to="/" replace />
  }

  const layout: DashboardLayout = dashboard?.layout ?? {
    gridCols: 12,
    rowHeight: 80,
    widgets: [],
  }
  const reportsById = new Map(reports.map((r) => [r.id, r]))

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={dashboard?.name ?? 'Dashboard'}
        showDateFilter
        dateFilter={filters}
        onDateFilterChange={setFilters}
        showExport={
          canViewCustom && hasPermission(dashboardModuleKey(id), 'export_pdf')
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <p className="text-sm text-text-secondary">Loading dashboard...</p>
        )}
        {error && (
          <div className="rounded-md border border-semantic-red/20 bg-semantic-red/10 px-3 py-2 text-sm text-semantic-red">
            {error}
          </div>
        )}
        {!loading && !error && dashboard && (
          <>
            {dashboard.description && (
              <p className="mb-4 text-sm text-text-secondary">{dashboard.description}</p>
            )}
            {!filters.enabled && (
              <div className="mb-4 rounded-md border border-dashed border-border bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
                <i className="ti ti-filter-off mr-2"></i>
                No date filter selected — report widgets will not load data until you choose a
                range.
              </div>
            )}
            <DashboardGrid
              key={filterKey}
              accessToken={accessToken!}
              layout={layout}
              reports={reports}
              reportsById={reportsById}
              canEdit={false}
              previewMode
              dashboardId={id}
              queryFilters={queryFilters}
              onChange={() => {}}
            />
          </>
        )}
      </div>
    </div>
  )
}
