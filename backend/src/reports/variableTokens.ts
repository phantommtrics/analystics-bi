const PARAM_BASE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/** Allowed immediately after a :param token (e.g. whitespace or PostgreSQL ::cast). */
export const COLON_TOKEN_TAIL = String.raw`(?=\s|,|\)|;|$|\]|\}|::|\|)`

/** Match :param, :param?, :param[], :param[]? (not PostgreSQL ::cast on the param itself). */
const COLON_TOKEN = new RegExp(
  String.raw`(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)(\[\])?(\?)?` + COLON_TOKEN_TAIL,
  'g',
)
const MUSTACHE_TOKEN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(\[\])?(\?)?\s*\}\}/g
const TEMPLATE_TOKEN = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)(\[\])?(\?)?\}/g

export type SqlVariableDef = {
  /** Full placeholder token as written in SQL, e.g. agentIds[]? */
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

  if (!PARAM_BASE.test(baseName)) {
    throw new Error(`Invalid SQL variable name: ${token}`)
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
      // fall through to comma-separated
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

export function getFilterValue(filters: Record<string, string>, token: string): string | undefined {
  if (filters[token] !== undefined) return filters[token]
  const def = parseVariableToken(token)
  return filters[def.baseName]
}
