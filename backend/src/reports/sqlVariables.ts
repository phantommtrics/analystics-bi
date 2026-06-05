import {
  buildVariableToken,
  extractSqlVariableDefs,
  extractSqlVariables,
  parseVariableToken,
} from './variableTokens.js'

export {
  buildVariableToken,
  extractSqlVariableDefs,
  extractSqlVariables,
  hasFilterValue,
  isRequiredVariable,
  parseArrayValue,
  parseVariableToken,
  type SqlVariableDef,
} from './variableTokens.js'

const DATE_FROM_ALIASES = new Set([
  'dateFrom',
  'startDate',
  'start_date',
  'fromDate',
  'from_date',
])

const DATE_TO_ALIASES = new Set([
  'dateTo',
  'endDate',
  'end_date',
  'toDate',
  'to_date',
  'dateToEnd',
  'endDateTime',
  'dateToExclusive',
])

export function isDateVariable(name: string): boolean {
  const { baseName } = parseVariableToken(name)
  return DATE_FROM_ALIASES.has(baseName) || DATE_TO_ALIASES.has(baseName)
}

export function isDateFromVariable(name: string): boolean {
  return DATE_FROM_ALIASES.has(parseVariableToken(name).baseName)
}

export function isDateToVariable(name: string): boolean {
  return DATE_TO_ALIASES.has(parseVariableToken(name).baseName)
}

export function sqlHasDateVariables(variables: string[]): boolean {
  return variables.some(isDateVariable)
}

export function defaultValueForVariable(name: string, anchorIso: string): string {
  const { baseName } = parseVariableToken(name)
  const anchor = new Date(`${anchorIso}T12:00:00`)
  const y = anchor.getFullYear()
  const m = String(anchor.getMonth() + 1).padStart(2, '0')
  const d = String(anchor.getDate()).padStart(2, '0')
  const isoAnchor = `${y}-${m}-${d}`
  const monthStart = `${y}-${m}-01`

  if (DATE_FROM_ALIASES.has(baseName)) return monthStart
  if (DATE_TO_ALIASES.has(baseName)) return isoAnchor
  return ''
}

export function applyDateRangeToVariables(
  variables: string[],
  dateFrom: string,
  dateTo: string,
  current: Record<string, string>,
): Record<string, string> {
  const next = { ...current }
  for (const name of variables) {
    if (isDateFromVariable(name)) next[name] = dateFrom
    if (isDateToVariable(name)) next[name] = dateTo
  }
  if (variables.some(isDateFromVariable)) {
    next.dateFrom = dateFrom
  }
  if (variables.some(isDateToVariable)) {
    next.dateTo = dateTo
  }
  return next
}
