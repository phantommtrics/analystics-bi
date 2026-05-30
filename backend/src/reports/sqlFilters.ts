const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

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

/** Expand dashboard date filters into common SQL placeholder aliases. */
export function expandDashboardFilters(filters: Record<string, string>): Record<string, string> {
  const expanded = { ...filters }
  const dateFrom = filters.dateFrom
  const dateTo = filters.dateTo

  if (dateFrom) {
    expanded.startDate = dateFrom
    expanded.start_date = dateFrom
    expanded.fromDate = dateFrom
    expanded.from_date = dateFrom
  }

  if (dateTo) {
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

export function applySqlFilters(sql: string, filters: Record<string, string>): string {
  const expanded = expandDashboardFilters(filters)
  let result = sql
  for (const [key, value] of Object.entries(expanded)) {
    if (!PARAM_NAME.test(key)) continue
    const quoted = quoteSqlLiteral(value)
    result = result.replace(new RegExp(`:${key}\\b`, 'g'), quoted)
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), quoted)
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), quoted)
  }
  return result
}
