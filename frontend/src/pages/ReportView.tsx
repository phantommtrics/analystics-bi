import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import type { QueryExecuteResult } from '../api/reportBuilder'
import { reportsApi, type SavedReportDetail } from '../api/reports'
import { useAuth } from '../auth/AuthContext'
import { TopBar } from '../components/layout/TopBar'
import { ReportRunDisplay } from '../components/report/ReportRunDisplay'
import { useReportVariables } from '../hooks/useReportVariables'
import { formatQueryFiltersLabel } from '../lib/dashboardFilters'
import { categoryMeta } from '../lib/reportConstants'
import { canViewCustomReport } from '../lib/reportFilters'
import {
  buildReportExportPermissions,
  hasAnyExportPermission,
} from '../lib/widgetExport'

export function ReportView() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const { accessToken, hasPermission, user } = useAuth()

  const [report, setReport] = useState<SavedReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryResult, setQueryResult] = useState<QueryExecuteResult | null>(null)

  const permissions = user?.permissions ?? []
  const canView =
    reportId !== undefined &&
    canViewCustomReport(permissions, reportId, user?.userType)
  const canEditInBuilder = hasPermission('report-builder', 'edit')

  const {
    variables,
    values: variableValues,
    queryFilters,
    hasDateVariables,
    dateFilters,
    filtersReady,
    setVariable,
    setDateFilters,
  } = useReportVariables(report?.sql ?? '')

  const exportPermissions = useMemo(() => {
    const perms = buildReportExportPermissions(hasPermission, reportId)
    return { png: false, csv: perms.csv, pdf: perms.pdf, xlsx: perms.xlsx }
  }, [hasPermission, reportId])
  const showExport = hasAnyExportPermission(exportPermissions)
  const exportContext = useMemo(
    () => ({
      reportDescription: report?.description ?? undefined,
      filterLabel: formatQueryFiltersLabel(dateFilters, {
        hasDateVariables,
        variables,
        values: variableValues,
      }),
    }),
    [report?.description, hasDateVariables, dateFilters, variables, variableValues],
  )

  const loadReport = useCallback(async () => {
    if (!accessToken || !reportId) return
    setLoading(true)
    setLoadError('')
    try {
      const detail = await reportsApi.get(accessToken, reportId)
      if (!detail.isPublished) {
        setLoadError('This report is not published.')
        setReport(null)
        return
      }
      setReport(detail)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken, reportId])

  const runReport = useCallback(async () => {
    if (!accessToken || !reportId || queryFilters === undefined) return
    setIsRunning(true)
    setQueryError(null)
    try {
      const result = await reportsApi.execute(accessToken, reportId, queryFilters)
      setQueryResult(result)
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Failed to run report')
      setQueryResult(null)
    } finally {
      setIsRunning(false)
    }
  }, [accessToken, reportId, queryFilters])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  useEffect(() => {
    if (!report || queryFilters === undefined || !filtersReady) return
    runReport()
  }, [report, queryFilters, filtersReady, runReport])

  if (!reportId) {
    return <Navigate to="/reports" replace />
  }

  if (!loading && !canView && !hasPermission('report-builder', 'view')) {
    return <Navigate to="/" replace />
  }

  if (!loading && report && !canView && hasPermission('report-builder', 'view')) {
    return <Navigate to={`/reports/builder?reportId=${reportId}`} replace />
  }

  if (!loading && !canView) {
    return <Navigate to="/" replace />
  }

  const meta = report ? categoryMeta[report.category] : null
  const subtitle = report?.description
    ? report.description
    : meta
      ? meta.label
      : undefined

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={report?.name ?? 'Report'}
        showDateFilter={false}
        reportFilters={
          variables.length > 0
            ? {
                variables,
                values: variableValues,
                hasDateVariables,
                dateFilters,
                onVariableChange: setVariable,
                onDateFiltersChange: setDateFilters,
              }
            : undefined
        }
        showExport={false}
        primaryAction={
          canEditInBuilder && report
            ? {
                label: 'Edit in builder',
                icon: 'ti-settings',
                onClick: () => navigate(`/reports/builder?reportId=${report.id}`),
              }
            : undefined
        }
      />

      {loadError && (
        <div className="shrink-0 bg-semantic-red/10 px-6 py-2 text-sm text-semantic-red">
          {loadError}
          <Link to="/reports" className="ml-2 underline">
            Back to catalog
          </Link>
        </div>
      )}

      {loading && (
        <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
          Loading report…
        </div>
      )}

      {!loading && report && (
        <>
          {subtitle && (
            <p className="shrink-0 border-b border-border bg-bg-secondary px-6 py-2 text-sm text-text-secondary">
              {subtitle}
            </p>
          )}

          {!filtersReady && (
            <div className="shrink-0 border-b border-border bg-bg-secondary px-6 py-3 text-sm text-text-secondary">
              <i className="ti ti-filter-off mr-2"></i>
              {hasDateVariables && !dateFilters.enabled
                ? 'No date filter selected — choose a range in the header filter to load data.'
                : 'Set required report parameters in the header filter before this report can run.'}
            </div>
          )}

          <ReportRunDisplay
            reportName={report.name}
            visualization={report.visualization}
            tableOnly
            queryResult={queryResult}
            queryError={queryError}
            isRunning={isRunning}
            filtersPending={!filtersReady}
            showExport={showExport}
            exportContext={exportContext}
            exportPermissions={exportPermissions}
          />
        </>
      )}

      {!loading && !report && !loadError && (
        <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
          Report not found.
        </div>
      )}
    </div>
  )
}
