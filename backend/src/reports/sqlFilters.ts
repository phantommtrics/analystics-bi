import {
  extractSqlVariableDefs,
  getFilterValue,
  hasFilterValue,
  isRequiredVariable,
  parseArrayValue,
  parseVariableToken,
  type SqlVariableDef,
} from './variableTokens.js'

/** Optional SQL sections removed when every optional variable inside is unset. */
const OPTIONAL_BLOCK = /\[\[([\s\S]*?)\]\]/g

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

function formatSubstitution(def: SqlVariableDef, rawValue: string | undefined): string | null {
  const value = rawValue?.trim() ?? ''

  if (!value) {
    if (def.optional) return 'NULL'
    return null
  }

  if (def.array) {
    const items = parseArrayValue(value)
    if (items.length === 0) {
      if (def.optional) return 'NULL'
      return null
    }
    return items.map((item) => quoteSqlLiteral(item)).join(', ')
  }

  return quoteSqlLiteral(value)
}

function removeOptionalBlocks(sql: string, filters: Record<string, string>): string {
  return sql.replace(OPTIONAL_BLOCK, (full, inner) => {
    const defs = extractSqlVariableDefs(inner)
    const optionalInBlock = defs.filter((d) => d.optional)
    if (optionalInBlock.length === 0) {
      return inner
    }

    const dropBlock = optionalInBlock.every(
      (def) => !hasFilterValue(getFilterValue(filters, def.token), def),
    )
    return dropBlock ? '' : inner
  })
}

function substituteToken(
  sql: string,
  def: SqlVariableDef,
  replacement: string,
): string {
  const colonRe = new RegExp(`(?<!:)${escapeRegExp(':' + def.token)}(?=\\s|,|\\)|;|$|\\]|\\}|\\|)`, 'g')
  let result = sql.replace(colonRe, replacement)
  result = result.replace(
    new RegExp(`\\{\\{\\s*${escapeRegExp(def.token)}\\s*\\}\\}`, 'g'),
    replacement,
  )
  result = result.replace(
    new RegExp(`\\$\\{${escapeRegExp(def.token)}\\}`, 'g'),
    replacement,
  )
  return result
}

function findUnsubstitutedTokens(sql: string): string[] {
  const found = new Set<string>()
  const re =
    /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)(\[\])?(\?)?(?=\s|,|\)|;|$|\]|\}|\|)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) {
    const token = match[1] + (match[2] ?? '') + (match[3] ?? '')
    found.add(token)
  }
  return [...found].sort()
}

export function findUnsubstitutedColonParams(sql: string): string[] {
  return findUnsubstitutedTokens(sql)
}

export function applySqlFilters(sql: string, filters: Record<string, string>): string {
  const expanded = expandDashboardFilters(filters)
  let result = removeOptionalBlocks(sql, expanded)

  const defs = extractSqlVariableDefs(result)
  const sorted = [...defs].sort((a, b) => b.token.length - a.token.length)

  for (const def of sorted) {
    const raw = getFilterValue(expanded, def.token)
    const replacement = formatSubstitution(def, raw)
    if (replacement === null) continue
    result = substituteToken(result, def, replacement)
  }

  const remaining = findUnsubstitutedTokens(result)
  const requiredUnset = remaining.filter((token) => {
    const def = parseVariableToken(token)
    return isRequiredVariable(def) && !hasFilterValue(getFilterValue(expanded, token), def)
  })

  if (requiredUnset.length > 0) {
    throw new Error(
      `Unset SQL variable(s): ${requiredUnset.join(', ')}. Provide values in the Variables panel or dashboard date filter.`,
    )
  }

  return result
}
