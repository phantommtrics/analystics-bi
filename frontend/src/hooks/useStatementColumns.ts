import { useEffect, useMemo, useState } from 'react'
import type { QueryExecuteResult } from '../api/reportBuilder'
import { reportsApi } from '../api/reports'
import { buildStatementPreviewFilters } from '../lib/statementPreviewFilters'
import { serializeQueryFilters } from '../lib/dashboardFilters'
import type { SqlVariableDef } from '../lib/sqlVariables'

export function useStatementColumns(
  accessToken: string | null,
  dataReportId: string | undefined,
  data: QueryExecuteResult | null,
  options: {
    queryFilters?: Record<string, string>
    variableDefs: SqlVariableDef[]
    values: Record<string, string>
  },
) {
  const [columns, setColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const dataColumnsKey = data?.columns?.join('\0') ?? ''
  const queryFiltersKey = options.queryFilters
    ? serializeQueryFilters(options.queryFilters)
    : ''

  const previewFilters = useMemo(
    () => buildStatementPreviewFilters(options.variableDefs, options.values),
    [options.variableDefs, options.values],
  )
  const previewFiltersKey = serializeQueryFilters(previewFilters)

  useEffect(() => {
    if (data?.columns?.length) {
      setColumns(data.columns)
      setLoading(false)
    }
  }, [dataReportId, dataColumnsKey, data?.columns])

  useEffect(() => {
    if (!accessToken || !dataReportId) {
      setColumns([])
      setLoading(false)
      return
    }

    if (data?.columns?.length) {
      return
    }

    let cancelled = false
    setLoading(true)
    setColumns([])

    const filterAttempts: Record<string, string>[] = []
    const seen = new Set<string>()

    function pushFilters(filters: Record<string, string>) {
      const key = serializeQueryFilters(filters)
      if (seen.has(key)) return
      seen.add(key)
      filterAttempts.push(filters)
    }

    if (options.queryFilters) {
      pushFilters(options.queryFilters)
    }
    pushFilters(previewFilters)
    pushFilters({})

    const reportId = dataReportId

    async function discoverColumns() {
      const token = accessToken
      if (!token || !reportId) return

      for (const filters of filterAttempts) {
        try {
          const result = await reportsApi.execute(token, reportId, filters)
          if (cancelled) return
          if (result.columns.length > 0) {
            setColumns(result.columns)
            setLoading(false)
            return
          }
        } catch {
          // try next filter set
        }
      }

      if (!cancelled) {
        setColumns([])
        setLoading(false)
      }
    }

    void discoverColumns()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    dataReportId,
    dataColumnsKey,
    queryFiltersKey,
    previewFiltersKey,
    options.queryFilters,
    previewFilters,
  ])

  return { columns, loading }
}
