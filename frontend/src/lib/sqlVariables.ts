const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/** Match :param but not PostgreSQL ::cast (e.g. column::text). */
const COLON_PARAM = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)\b/g
const MUSTACHE_PARAM = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
const TEMPLATE_PARAM = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g

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

export function extractSqlVariables(sql: string): string[] {
  const found = new Set<string>()
  for (const re of [COLON_PARAM, MUSTACHE_PARAM, TEMPLATE_PARAM]) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(sql)) !== null) {
      const name = match[1]
      if (PARAM_NAME.test(name)) found.add(name)
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b))
}

export function isDateVariable(name: string): boolean {
  return DATE_FROM_ALIASES.has(name) || DATE_TO_ALIASES.has(name)
}

export function isDateFromVariable(name: string): boolean {
  return DATE_FROM_ALIASES.has(name)
}

export function isDateToVariable(name: string): boolean {
  return DATE_TO_ALIASES.has(name)
}

export function sqlHasDateVariables(variables: string[]): boolean {
  return variables.some(isDateVariable)
}

export function formatVariableLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function defaultValueForVariable(name: string): string {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const isoToday = `${y}-${m}-${d}`
  const monthStart = `${y}-${m}-01`

  if (isDateFromVariable(name)) return monthStart
  if (isDateToVariable(name)) return isoToday
  return ''
}

/** Apply a date range to whichever date placeholders exist in the SQL. */
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
  'Use :name, {{ name }}, or ${name} in SQL (not ::cast). Values are substituted as quoted literals when you run the query.'
