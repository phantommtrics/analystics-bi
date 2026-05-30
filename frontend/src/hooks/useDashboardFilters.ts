import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  defaultDashboardFilters,
  filtersFromSearchParams,
  type DashboardFilters,
} from '../lib/dashboardFilters'

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  )

  useEffect(() => {
    if (searchParams.get('dateFrom') && searchParams.get('dateTo')) return
    const defaults = defaultDashboardFilters()
    const next = new URLSearchParams(searchParams)
    next.set('dateFrom', defaults.dateFrom)
    next.set('dateTo', defaults.dateTo)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  function setFilters(next: DashboardFilters) {
    const params = new URLSearchParams(searchParams)
    params.set('dateFrom', next.dateFrom)
    params.set('dateTo', next.dateTo)
    setSearchParams(params, { replace: true })
  }

  return { filters, setFilters }
}
