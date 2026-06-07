import { useCallback, useEffect, useRef, useState } from 'react'
import type { QueryExecuteResult } from '../api/reportBuilder'
import { reportsApi } from '../api/reports'

type StatementDataState = {
  data: QueryExecuteResult | null
  headerData: QueryExecuteResult | null
  loading: boolean
  error: string
}

export function useStatementData(
  accessToken: string | null,
  dataReportId: string | undefined,
  headerReportId: string | undefined,
  queryFilters: Record<string, string> | undefined,
  statementId?: string,
) {
  const [state, setState] = useState<StatementDataState>({
    data: null,
    headerData: null,
    loading: false,
    error: '',
  })
  const requestIdRef = useRef(0)

  const filtersKey = queryFilters ? JSON.stringify(queryFilters) : ''

  const load = useCallback(async () => {
    if (!accessToken || !dataReportId || !queryFilters) {
      setState({ data: null, headerData: null, loading: false, error: '' })
      return
    }

    const requestId = ++requestIdRef.current
    setState((prev) => ({ ...prev, loading: true, error: '' }))

    try {
      const executeOptions = statementId ? { statementId } : undefined
      const dataPromise = reportsApi.execute(
        accessToken,
        dataReportId,
        queryFilters,
        executeOptions,
      )
      const headerPromise = headerReportId
        ? reportsApi.execute(accessToken, headerReportId, queryFilters, executeOptions)
        : Promise.resolve(null)

      const [data, headerData] = await Promise.all([dataPromise, headerPromise])

      if (requestId !== requestIdRef.current) return

      setState({ data, headerData, loading: false, error: '' })
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setState({
        data: null,
        headerData: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load statement data',
      })
    }
  }, [accessToken, dataReportId, headerReportId, queryFilters, statementId])

  useEffect(() => {
    void load()
  }, [load, filtersKey, dataReportId, headerReportId])

  return { ...state, reload: load }
}
