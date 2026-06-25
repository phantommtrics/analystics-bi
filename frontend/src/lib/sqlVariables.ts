const PARAM_BASE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const COLON_TOKEN_TAIL = String.raw`(?=\s|,|\)|;|$|\]|\}|::|\|)`

const COLON_TOKEN = new RegExp(
  String.raw`(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)(\[\])?(\?)?` + COLON_TOKEN_TAIL,
  'g',
)
const MUSTACHE_TOKEN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(\[\])?(\?)?\s*\}\}/g
const TEMPLATE_TOKEN = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)(\[\])?(\?)?\}/g

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

export type SqlVariableDef = {
  token: string
  baseName: string
  optional: boolean
  array: boolean
}

export function buildVariableToken(
  baseName: string,
  options?: { array?: boolean; optional?: boolean },
): string {
  let token = baseName
  if (options?.array) token += '[]'
  if (options?.optional) token += '?'
  return token
}

export function parseVariableToken(token: string): SqlVariableDef {
  let baseName = token
  let optional = false
  let array = false

  if (baseName.endsWith('[]?')) {
    baseName = baseName.slice(0, -3)
    array = true
    optional = true
  } else if (baseName.endsWith('[]')) {
    baseName = baseName.slice(0, -2)
    array = true
  } else if (baseName.endsWith('?')) {
    baseName = baseName.slice(0, -1)
    optional = true
  }

  return {
    token,
    baseName,
    optional,
    array,
  }
}

function addToken(found: Map<string, SqlVariableDef>, baseName: string, array: boolean, optional: boolean) {
  if (!PARAM_BASE.test(baseName)) return
  const token = buildVariableToken(baseName, { array, optional })
  found.set(token, { token, baseName, optional, array })
}

export function extractSqlVariableDefs(sql: string): SqlVariableDef[] {
  const found = new Map<string, SqlVariableDef>()
  for (const re of [COLON_TOKEN, MUSTACHE_TOKEN, TEMPLATE_TOKEN]) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(sql)) !== null) {
      addToken(found, match[1], Boolean(match[2]), Boolean(match[3]))
    }
  }
  return [...found.values()].sort((a, b) => a.token.localeCompare(b.token))
}

export function extractSqlVariables(sql: string): string[] {
  return extractSqlVariableDefs(sql).map((d) => d.token)
}

export function parseArrayValue(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
          .filter(Boolean)
      }
    } catch {
      // fall through
    }
  }

  return trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function hasFilterValue(value: string | undefined, def: SqlVariableDef): boolean {
  if (value === undefined || value === '') return false
  if (def.array) return parseArrayValue(value).length > 0
  return value.trim().length > 0
}

export function isRequiredVariable(def: SqlVariableDef): boolean {
  return !def.optional
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function resolveDateFrom(filters: Record<string, string>): string | undefined {
  return (
    filters.dateFrom ||
    filters.startDate ||
    filters.start_date ||
    filters.fromDate ||
    filters.from_date
  )
}

function resolveDateTo(filters: Record<string, string>): string | undefined {
  return (
    filters.dateTo ||
    filters.endDate ||
    filters.end_date ||
    filters.toDate ||
    filters.to_date
  )
}

/** Expand date filters into common SQL placeholder aliases (mirrors backend). */
export function expandQueryFilters(filters: Record<string, string>): Record<string, string> {
  const expanded = { ...filters }
  const dateFrom = resolveDateFrom(filters)
  const dateTo = resolveDateTo(filters)

  if (dateFrom) {
    expanded.dateFrom = dateFrom
    expanded.startDate = dateFrom
    expanded.start_date = dateFrom
    expanded.fromDate = dateFrom
    expanded.from_date = dateFrom
  }

  if (dateTo) {
    expanded.dateTo = dateTo
    expanded.endDate = dateTo
    expanded.end_date = dateTo
    expanded.toDate = dateTo
    expanded.to_date = dateTo
    expanded.dateToEnd = `${dateTo} 23:59:59`
    expanded.endDateTime = `${dateTo} 23:59:59.999`
    expanded.dateToExclusive = addDays(dateTo, 1)
  }

  return expanded
}

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

export function formatVariableLabel(name: string): string {
  const { baseName } = parseVariableToken(name)
  return baseName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function variableInputHint(def: SqlVariableDef): string {
  if (def.array) {
    return 'Comma-separated values, e.g. east, west'
  }
  return `:${def.token}`
}

export function defaultValueForVariable(name: string): string {
  const { baseName } = parseVariableToken(name)
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const isoToday = `${y}-${m}-${d}`
  const monthStart = `${y}-${m}-01`

  if (DATE_FROM_ALIASES.has(baseName)) return monthStart
  if (DATE_TO_ALIASES.has(baseName)) return isoToday
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
  if (variables.includes('dateFrom') || variables.some(isDateFromVariable)) {
    next.dateFrom = dateFrom
  }
  if (variables.includes('dateTo') || variables.some(isDateToVariable)) {
    next.dateTo = dateTo
  }
  return next
}

export function buildExecuteFilters(values: Record<string, string>): Record<string, string> {
  return expandQueryFilters(values)
}

export const SQL_VARIABLE_HINT =
  'Use :name for required values, :name? for optional, :name[] for lists (IN clauses). Wrap optional filters in [[ ... ]] so they are omitted when empty. Example: [[AND status = :status?]] and WHERE region IN (:regions[]).'
