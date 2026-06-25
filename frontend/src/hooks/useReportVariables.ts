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
  extractSqlVariableDefs,
  hasFilterValue,
  isDateVariable,
  isRequiredVariable,
  parseVariableToken,
  sqlHasDateVariables,
  type SqlVariableDef,
} from '../lib/sqlVariables'

const RESERVED_PARAMS = new Set([
  'reportId',
  'run',
  'dashboardId',
  'dateFilter',
  'datePreset',
  'dateFrom',
  'dateTo',
])

function mergeSqlVariableDefs(sources: string[]): SqlVariableDef[] {
  const found = new Map<string, SqlVariableDef>()
  for (const sql of sources) {
    for (const def of extractSqlVariableDefs(sql)) {
      found.set(def.token, def)
    }
  }
  return [...found.values()].sort((a, b) => a.token.localeCompare(b.token))
}

export function useReportVariables(sql: string | string[]) {
  const [searchParams, setSearchParams] = useSearchParams()

  const sqlSources = useMemo(
    () => (Array.isArray(sql) ? sql : [sql]),
    [sql],
  )

  const variableDefs = useMemo(() => mergeSqlVariableDefs(sqlSources), [sqlSources])
  const variables = useMemo(() => variableDefs.map((d) => d.token), [variableDefs])
  const hasDateVariables = useMemo(() => sqlHasDateVariables(variables), [variables])
  const customVariableDefs = useMemo(
    () => variableDefs.filter((d) => !isDateVariable(d.token)),
    [variableDefs],
  )
  const customVariables = useMemo(
    () => customVariableDefs.map((d) => d.token),
    [customVariableDefs],
  )

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
    for (const def of customVariableDefs) {
      const val = values[def.token]
      if (hasFilterValue(val, def)) {
        custom[def.token] = val
      } else if (def.optional) {
        custom[def.token] = ''
      }
    }

    if (hasDateVariables) {
      if (!dateFiltersEnabled) return undefined
      if (!dateFilters.dateFrom.trim() || !dateFilters.dateTo.trim()) return undefined
      const datePart = filtersToQueryRecord(dateFilters) ?? {}
      return buildExecuteFilters({ ...datePart, ...custom })
    }

    if (Object.keys(custom).length === 0) return {}
    return buildExecuteFilters(custom)
  }, [customVariableDefs, values, hasDateVariables, dateFiltersEnabled, dateFilters])

  const filtersReady = useMemo(() => {
    if (hasDateVariables) {
      if (!dateFiltersEnabled) return false
      if (!dateFilters.dateFrom.trim() || !dateFilters.dateTo.trim()) return false
    }
    return customVariableDefs
      .filter(isRequiredVariable)
      .every((def) => hasFilterValue(values[def.token], def))
  }, [hasDateVariables, dateFiltersEnabled, dateFilters, customVariableDefs, values])

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
    if (customVariables.length === 0) return
    const missing = customVariables.filter((name) => !searchParams.get(name))
    if (missing.length === 0) return

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        let changed = false
        for (const name of missing) {
          if (RESERVED_PARAMS.has(name)) continue
          const def = parseVariableToken(name)
          if (def.optional) continue
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
  }, [customVariables, searchParams, setSearchParams])

  useEffect(() => {
    if (!hasDateVariables || dateFilters.enabled) return
    setDateFilters(defaultDashboardFilters())
  }, [hasDateVariables, dateFilters.enabled, setDateFilters])

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
    variableDefs,
    customVariables,
    customVariableDefs,
    values,
    queryFilters,
    hasDateVariables,
    dateFilters,
    dateFiltersEnabled,
    filtersReady,
    setVariable,
    setDateRange,
    setDateFilters,
  }
}
