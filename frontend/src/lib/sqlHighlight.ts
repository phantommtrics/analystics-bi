export type SqlTokenKind =
  | 'keyword'
  | 'function'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'identifier'
  | 'plain'

const KEYWORDS = new Set(
  [
    'SELECT',
    'FROM',
    'WHERE',
    'GROUP',
    'BY',
    'ORDER',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'INSERT',
    'UPDATE',
    'DELETE',
    'INTO',
    'VALUES',
    'SET',
    'JOIN',
    'INNER',
    'LEFT',
    'RIGHT',
    'OUTER',
    'FULL',
    'CROSS',
    'ON',
    'AS',
    'AND',
    'OR',
    'NOT',
    'IN',
    'IS',
    'NULL',
    'LIKE',
    'ILIKE',
    'BETWEEN',
    'EXISTS',
    'CASE',
    'WHEN',
    'THEN',
    'ELSE',
    'END',
    'DISTINCT',
    'UNION',
    'ALL',
    'ASC',
    'DESC',
    'WITH',
    'RECURSIVE',
    'CREATE',
    'DROP',
    'ALTER',
    'TABLE',
    'INDEX',
    'VIEW',
    'PRIMARY',
    'KEY',
    'FOREIGN',
    'REFERENCES',
    'CONSTRAINT',
    'DEFAULT',
    'TRUE',
    'FALSE',
    'OVER',
    'PARTITION',
    'WINDOW',
    'FETCH',
    'NEXT',
    'ROWS',
    'ONLY',
    'USING',
    'NATURAL',
    'LATERAL',
    'RETURNING',
  ].map((k) => k.toLowerCase()),
)

const FUNCTIONS = new Set(
  [
    'COUNT',
    'SUM',
    'AVG',
    'MIN',
    'MAX',
    'DATE',
    'DATETIME',
    'TIMESTAMP',
    'NOW',
    'CURRENT_DATE',
    'CURRENT_TIMESTAMP',
    'COALESCE',
    'NULLIF',
    'CAST',
    'CONVERT',
    'CONCAT',
    'SUBSTRING',
    'TRIM',
    'ROUND',
    'ABS',
    'UPPER',
    'LOWER',
    'LENGTH',
    'IFNULL',
    'EXTRACT',
    'YEAR',
    'MONTH',
    'DAY',
    'RANK',
    'ROW_NUMBER',
    'LAG',
    'LEAD',
  ].map((f) => f.toLowerCase()),
)

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function classifyWord(word: string): SqlTokenKind {
  const lower = word.toLowerCase()
  if (KEYWORDS.has(lower)) return 'keyword'
  if (FUNCTIONS.has(lower)) return 'function'
  if (/^\d+(\.\d+)?$/.test(word)) return 'number'
  return 'identifier'
}

const TOKEN_PATTERN =
  /('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(--[^\n]*)|(\/\*[\s\S]*?\*\/)|(\b\d+\.?\d*\b)|(\b[A-Za-z_][\w]*\b)|([(),.*;=<>!+\-/%]+)|(\s+)|(.)/g

export function highlightSql(code: string): string {
  let html = ''
  let match: RegExpExecArray | null

  TOKEN_PATTERN.lastIndex = 0
  while ((match = TOKEN_PATTERN.exec(code)) !== null) {
    const [
      ,
      singleQuote,
      doubleQuote,
      lineComment,
      blockComment,
      number,
      word,
      operator,
      whitespace,
      other,
    ] = match
    const text = match[0]

    let kind: SqlTokenKind = 'plain'
    if (singleQuote || doubleQuote) kind = 'string'
    else if (lineComment || blockComment) kind = 'comment'
    else if (number) kind = 'number'
    else if (word) kind = classifyWord(word)
    else if (operator) kind = 'operator'
    else if (whitespace) kind = 'plain'
    else if (other) kind = 'plain'

    const escaped = escapeHtml(text)
    if (kind === 'plain') {
      html += escaped
    } else {
      html += `<span class="sql-${kind}">${escaped}</span>`
    }
  }

  return html
}
