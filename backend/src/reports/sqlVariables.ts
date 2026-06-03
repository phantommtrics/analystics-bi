const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

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

export function defaultValueForVariable(name: string, anchorIso: string): string {
  const anchor = new Date(`${anchorIso}T12:00:00`)
  const y = anchor.getFullYear()
  const m = String(anchor.getMonth() + 1).padStart(2, '0')
  const d = String(anchor.getDate()).padStart(2, '0')
  const isoAnchor = `${y}-${m}-${d}`
  const monthStart = `${y}-${m}-01`

  if (isDateFromVariable(name)) return monthStart
  if (isDateToVariable(name)) return isoAnchor
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
