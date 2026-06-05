import { useCallback, useEffect, useState } from 'react'
import type { QueryExecuteResult } from '../api/reportBuilder'
import { reportsApi } from '../api/reports'
import type { StatementConfig } from '../lib/statementConfig'

type StatementDataState = {
  data: QueryExecuteResult | null
  headerData: QueryExecuteResult | null
  loading: boolean
  error: string
}

export function useStatementData(
  accessToken: string | null,
  config: StatementConfig | null | undefined,
  queryFilters: Record<string, string> | undefined,
  statementId?: string,
) {
  const [state, setState] = useState<StatementDataState>({
    data: null,
    headerData: null,
    loading: false,
    error: '',
  })

  const filtersKey = queryFilters ? JSON.stringify(queryFilters) : ''
  const dataReportId = config?.dataReportId ?? ''
  const headerReportId = config?.headerReportId ?? ''

  const load = useCallback(async () => {
    if (!accessToken || !config?.dataReportId || !queryFilters) {
      setState({ data: null, headerData: null, loading: false, error: '' })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const executeOptions = statementId ? { statementId } : undefined
      const data = await reportsApi.execute(
        accessToken,
        config.dataReportId,
        queryFilters,
        executeOptions,
      )

      let headerData: QueryExecuteResult | null = null
      if (config.headerReportId) {
        headerData = await reportsApi.execute(
          accessToken,
          config.headerReportId,
          queryFilters,
          executeOptions,
        )
      }

      setState({ data, headerData, loading: false, error: '' })
    } catch (err) {
      setState({
        data: null,
        headerData: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load statement data',
      })
    }
  }, [accessToken, config, queryFilters, statementId])

  useEffect(() => {
    load()
  }, [load, filtersKey, dataReportId, headerReportId])

  return { ...state, reload: load }
}
