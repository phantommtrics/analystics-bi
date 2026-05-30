const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

function quoteSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function applySqlFilters(sql: string, filters: Record<string, string>): string {
  let result = sql
  for (const [key, value] of Object.entries(filters)) {
    if (!PARAM_NAME.test(key)) continue
    const quoted = quoteSqlLiteral(value)
    result = result.replace(new RegExp(`:${key}\\b`, 'g'), quoted)
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), quoted)
  }
  return result
}
