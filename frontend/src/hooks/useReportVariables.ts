import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  defaultDashboardFilters,
  filtersFromSearchParams,
  filtersToQueryRecord,
  writeFiltersToSearchParams,
  type DashboardFilters,
} from '../lib/dashboardFilters'
import {
  applyDateRangeToVariables,
  buildExecuteFilters,
  defaultValueForVariable,
  extractSqlVariables,
  isDateVariable,
  sqlHasDateVariables,
} from '../lib/sqlVariables'

const RESERVED_PARAMS = new Set(['reportId', 'run', 'dateFilter', 'datePreset', 'dateFrom', 'dateTo'])

export function useReportVariables(sql: string) {
  const [searchParams, setSearchParams] = useSearchParams()
  const variables = useMemo(() => extractSqlVariables(sql), [sql])
  const hasDateVariables = useMemo(() => sqlHasDateVariables(variables), [variables])

  const dateFilters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  )

  const dateFiltersEnabled = dateFilters.enabled

  const values = useMemo(() => {
    const record: Record<string, string> = {}
    for (const name of variables) {
      if (isDateVariable(name)) continue
      const fromUrl = searchParams.get(name)
      record[name] = fromUrl ?? defaultValueForVariable(name)
    }
    return record
  }, [variables, searchParams])

  const queryFilters = useMemo(() => {
    const custom: Record<string, string> = {}
    for (const name of variables) {
      if (!isDateVariable(name) && values[name]) {
        custom[name] = values[name]
      }
    }

    if (hasDateVariables) {
      if (!dateFiltersEnabled) return undefined
      const datePart = filtersToQueryRecord(dateFilters) ?? {}
      return buildExecuteFilters({ ...datePart, ...custom })
    }

    if (Object.keys(custom).length === 0) return {}
    return buildExecuteFilters(custom)
  }, [variables, values, hasDateVariables, dateFiltersEnabled, dateFilters])

  const setVariable = useCallback(
    (name: string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) {
            next.set(name, value)
          } else {
            next.delete(name)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setDateFilters = useCallback(
    (next: DashboardFilters) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          writeFiltersToSearchParams(params, next)
          if (next.enabled) {
            const merged = applyDateRangeToVariables(
              variables,
              next.dateFrom,
              next.dateTo,
              {},
            )
            for (const [key, val] of Object.entries(merged)) {
              if (variables.includes(key) && val) {
                params.set(key, val)
              }
            }
          } else {
            for (const name of variables) {
              if (isDateVariable(name)) params.delete(name)
            }
          }
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams, variables],
  )

  const setDateRange = useCallback(
    (dateFrom: string, dateTo: string) => {
      setDateFilters({
        enabled: true,
        preset: 'custom',
        dateFrom,
        dateTo,
      })
    },
    [setDateFilters],
  )

  useEffect(() => {
    if (variables.length === 0 || !dateFiltersEnabled) return
    const missing = variables.filter(
      (name) => !isDateVariable(name) && !searchParams.get(name),
    )
    if (missing.length === 0) return

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        let changed = false
        for (const name of missing) {
          if (RESERVED_PARAMS.has(name)) continue
          const defaultVal = defaultValueForVariable(name)
          if (defaultVal) {
            next.set(name, defaultVal)
            changed = true
          }
        }
        return changed ? next : prev
      },
      { replace: true },
    )
  }, [variables, searchParams, setSearchParams, dateFiltersEnabled])

  useEffect(() => {
    if (!hasDateVariables || !dateFiltersEnabled) return
    const hasDateParams =
      searchParams.get('dateFilter') === 'none' ||
      searchParams.get('datePreset') ||
      (searchParams.get('dateFrom') && searchParams.get('dateTo'))
    if (hasDateParams) return

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        writeFiltersToSearchParams(next, defaultDashboardFilters())
        return next
      },
      { replace: true },
    )
  }, [hasDateVariables, dateFiltersEnabled, searchParams, setSearchParams])

  return {
    variables,
    values,
    queryFilters,
    hasDateVariables,
    dateFilters,
    dateFiltersEnabled,
    setVariable,
    setDateRange,
    setDateFilters,
  }
}
