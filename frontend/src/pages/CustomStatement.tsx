import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ReportFiltersDropdown } from '../components/shared/ReportFiltersDropdown'
import { StatementPreview } from '../components/statement/StatementPreview'
import { TopBar } from '../components/layout/TopBar'
import { statementsApi, type StatementDetail } from '../api/statements'
import { useAuth } from '../auth/AuthContext'
import { useStatementData } from '../hooks/useStatementData'
import { useStatementReportSql } from '../hooks/useStatementReportSql'
import { useReportVariables } from '../hooks/useReportVariables'
import { canViewCustomStatement } from '../lib/statementFilters'
import { formatQueryFiltersLabel } from '../lib/dashboardFilters'
import { statementToExportResult } from '../lib/statementExport'
import {
  buildStatementExportPermissions,
  exportQueryResultToCsv,
  exportQueryResultToPdf,
  exportQueryResultToXlsx,
  hasAnyExportPermission,
  sanitizeExportFilename,
  type WidgetExportContext,
} from '../lib/widgetExport'

export function CustomStatement() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, hasPermission, user } = useAuth()

  const [statement, setStatement] = useState<StatementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canUseBuilder = hasPermission('statement-builder', 'view')
  const permissions = user?.permissions ?? []
  const canViewCustom = id ? canViewCustomStatement(permissions, id, user?.userType) : false

  const { sqlSources, loading: sqlLoading } = useStatementReportSql(
    accessToken,
    statement?.config.dataReportId,
    statement?.config.headerReportId,
  )
  const {
    variables,
    values: variableValues,
    queryFilters,
    hasDateVariables,
    dateFilters,
    filtersReady,
    setVariable,
    setDateFilters,
  } = useReportVariables(sqlSources)

  const effectiveQueryFilters =
    sqlLoading || !filtersReady ? undefined : queryFilters

  const { data, headerData, loading: dataLoading, error: dataError } = useStatementData(
    accessToken,
    statement?.config.dataReportId,
    statement?.config.headerReportId,
    effectiveQueryFilters,
    statement?.isPublished ? id : undefined,
  )

  const loadStatement = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    setError('')
    try {
      const detail = await statementsApi.get(accessToken, id)
      setStatement(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statement')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  useEffect(() => {
    loadStatement()
  }, [loadStatement])

  const filterLabel = useMemo(
    () =>
      formatQueryFiltersLabel(dateFilters, {
        hasDateVariables,
        variables,
        values: variableValues,
      }),
    [dateFilters, hasDateVariables, variables, variableValues],
  )

  const exportPermissions = useMemo(
    () => buildStatementExportPermissions(hasPermission, id),
    [hasPermission, id],
  )

  const showExport = hasAnyExportPermission(exportPermissions) && Boolean(data)

  const exportContext = useMemo<WidgetExportContext>(
    () => ({
      reportDescription: statement?.description ?? undefined,
      filterLabel: filterLabel || undefined,
    }),
    [statement?.description, filterLabel],
  )

  const handleExport = useCallback(
    async (format: 'csv' | 'pdf' | 'xlsx') => {
      if (!statement || !data) return

      const exportResult = statementToExportResult(
        statement.type,
        statement.config,
        data,
        headerData,
      )
      const filename = sanitizeExportFilename(statement.name)
      const meta = {
        reportName: statement.config.headerTitle ?? statement.name,
        ...exportContext,
      }

      if (format === 'csv') {
        exportQueryResultToCsv(exportResult, filename)
        return
      }
      if (format === 'pdf') {
        await exportQueryResultToPdf(exportResult, filename, meta)
        return
      }
      await exportQueryResultToXlsx(exportResult, filename)
    },
    [statement, data, headerData, exportContext],
  )

  if (!id) {
    return <Navigate to="/statements" replace />
  }

  if (!loading && statement && !statement.isPublished && !canUseBuilder) {
    return <Navigate to="/statements" replace />
  }

  if (!loading && statement && !canUseBuilder && !canViewCustom) {
    return <Navigate to="/statements" replace />
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={statement?.name ?? 'Statement'}
        showDateFilter={false}
        showExport={false}
        toolbar={
          statement && (variables.length > 0 || hasDateVariables) ? (
            <ReportFiltersDropdown
              variables={variables}
              values={variableValues}
              hasDateVariables={hasDateVariables}
              dateFilters={dateFilters}
              onVariableChange={setVariable}
              onDateFiltersChange={setDateFilters}
            />
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-md border border-semantic-red/20 bg-semantic-red/10 px-3 py-2 text-sm text-semantic-red">
            {error}
          </div>
        )}

        {loading || !statement ? (
          <div className="py-16 text-center text-sm text-text-secondary">Loading statement...</div>
        ) : (
          <div className="space-y-4">
            {filterLabel && (
              <p className="text-xs text-text-secondary">Filters: {filterLabel}</p>
            )}
            <StatementPreview
              type={statement.type}
              config={statement.config}
              data={data}
              headerData={headerData}
              title={statement.config.headerTitle ?? statement.name}
              subtitle={statement.config.headerSubtitle ?? statement.description ?? undefined}
              loading={dataLoading || sqlLoading || !filtersReady}
              error={dataError}
              showExport={showExport}
              exportPermissions={exportPermissions}
              onExport={handleExport}
            />
          </div>
        )}
      </div>
    </div>
  )
}
