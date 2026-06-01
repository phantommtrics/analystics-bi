const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/** Match :param but not PostgreSQL ::cast (e.g. column::text). */
const COLON_PARAM = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)\b/g

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function quoteSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
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

/** Expand dashboard date filters into common SQL placeholder aliases. */
export function expandDashboardFilters(filters: Record<string, string>): Record<string, string> {
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

export function findUnsubstitutedColonParams(sql: string): string[] {
  const found = new Set<string>()
  COLON_PARAM.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = COLON_PARAM.exec(sql)) !== null) {
    const name = match[1]
    if (PARAM_NAME.test(name)) found.add(name)
  }
  return [...found].sort()
}

export function applySqlFilters(sql: string, filters: Record<string, string>): string {
  const expanded = expandDashboardFilters(filters)
  let result = sql

  const keys = Object.keys(expanded).filter((key) => PARAM_NAME.test(key))
  keys.sort((a, b) => b.length - a.length)

  for (const key of keys) {
    const value = expanded[key]
    if (value === undefined || value === '') continue
    const quoted = quoteSqlLiteral(value)
    const colonRe = new RegExp(`(?<!:)${escapeRegExp(':' + key)}\\b`, 'g')
    result = result.replace(colonRe, quoted)
    result = result.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g'), quoted)
    result = result.replace(new RegExp(`\\$\\{${escapeRegExp(key)}\\}`, 'g'), quoted)
  }

  const remaining = findUnsubstitutedColonParams(result)
  if (remaining.length > 0) {
    throw new Error(
      `Unset SQL variable(s): ${remaining.join(', ')}. Provide values in the Variables panel or dashboard date filter.`,
    )
  }

  return result
}
