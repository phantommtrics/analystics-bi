import { filtersToQueryRecord, filtersWithPreset } from './dashboardFilters'
import {
  buildExecuteFilters,
  defaultValueForVariable,
  hasFilterValue,
  isDateVariable,
  type SqlVariableDef,
} from './sqlVariables'

/** Broad date range for discovering columns in the statement builder. */
export function buildStatementPreviewFilters(
  variableDefs: SqlVariableDef[] = [],
  values: Record<string, string> = {},
): Record<string, string> {
  const datePart =
    filtersToQueryRecord(filtersWithPreset('last-365-days')) ?? {}

  const custom: Record<string, string> = {}
  for (const def of variableDefs) {
    if (isDateVariable(def.token)) continue
    const val = values[def.token]
    if (hasFilterValue(val, def)) {
      custom[def.token] = val
    } else if (def.optional) {
      custom[def.token] = ''
    } else {
      const defaultVal = defaultValueForVariable(def.token)
      if (defaultVal) custom[def.token] = defaultVal
    }
  }

  return buildExecuteFilters({ ...datePart, ...custom })
}
