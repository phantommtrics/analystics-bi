import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  defaultDashboardFilters,
  filtersFromSearchParams,
  writeFiltersToSearchParams,
  type DashboardFilters,
} from '../lib/dashboardFilters'

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  )

  useEffect(() => {
    const hasMode =
      searchParams.get('dateFilter') === 'none' ||
      searchParams.get('datePreset') ||
      (searchParams.get('dateFrom') && searchParams.get('dateTo'))
    if (hasMode) return

    const next = new URLSearchParams(searchParams)
    writeFiltersToSearchParams(next, defaultDashboardFilters())
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  function setFilters(next: DashboardFilters) {
    const params = new URLSearchParams(searchParams)
    writeFiltersToSearchParams(params, next)
    setSearchParams(params, { replace: true })
  }

  return { filters, setFilters, filtersEnabled: filters.enabled }
}
