import { Pool, type PoolClient, type PoolConfig } from 'pg'
import type { SslMode } from '@prisma/client'

export type PostgresConnectionConfig = {
  host: string
  port: number
  database: string
  username: string
  password: string
  sslMode: SslMode
}

export type TestConnectionResult =
  | { ok: true; latencyMs: number }
  | { ok: false; message: string }

const poolCache = new Map<string, Pool>()

function sslConfig(sslMode: SslMode): PoolConfig['ssl'] {
  if (sslMode === 'DISABLE') {
    return false
  }
  return { rejectUnauthorized: false }
}

function buildPoolConfig(config: PostgresConnectionConfig): PoolConfig {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: sslConfig(config.sslMode),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  }
}

async function configureReadOnlyClient(client: PoolClient) {
  await client.query('SET default_transaction_read_only = on')
  // Many client DB roles omit public from search_path; qualify tables in SQL regardless.
  await client.query('SET search_path TO public, pg_catalog')
}

export function createPool(config: PostgresConnectionConfig): Pool {
  const pool = new Pool(buildPoolConfig(config))
  pool.on('connect', (client) => {
    void configureReadOnlyClient(client).catch(() => {
      // Pool will surface query errors on use if read-only setup fails.
    })
  })
  return pool
}

export function getOrCreatePool(dataSourceId: string, config: PostgresConnectionConfig): Pool {
  const existing = poolCache.get(dataSourceId)
  if (existing) {
    return existing
  }
  const pool = createPool(config)
  poolCache.set(dataSourceId, pool)
  return pool
}

export async function destroyPool(dataSourceId: string) {
  const pool = poolCache.get(dataSourceId)
  if (!pool) {
    return
  }
  poolCache.delete(dataSourceId)
  await pool.end()
}

export async function testConnection(config: PostgresConnectionConfig): Promise<TestConnectionResult> {
  const pool = createPool(config)
  const started = Date.now()
  try {
    const client = await pool.connect()
    try {
      await configureReadOnlyClient(client)
      await client.query('SELECT 1 AS ok')
      return { ok: true, latencyMs: Date.now() - started }
    } finally {
      client.release()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    return { ok: false, message: sanitizeErrorMessage(message) }
  } finally {
    await pool.end()
  }
}

const READ_ONLY_SQL_PATTERN = /^\s*(with\b|select\b)/i

/** Skip leading whitespace and SQL comments so `-- note` before SELECT is allowed. */
function skipLeadingCommentsAndWhitespace(sql: string): string {
  let i = 0
  while (i < sql.length) {
    while (i < sql.length && /\s/.test(sql[i])) i++
    if (sql.startsWith('--', i)) {
      const lineEnd = sql.indexOf('\n', i)
      i = lineEnd === -1 ? sql.length : lineEnd + 1
      continue
    }
    if (sql.startsWith('/*', i)) {
      const blockEnd = sql.indexOf('*/', i + 2)
      i = blockEnd === -1 ? sql.length : blockEnd + 2
      continue
    }
    break
  }
  return sql.slice(i).trimStart()
}

export function assertReadOnlySql(sql: string) {
  const trimmed = skipLeadingCommentsAndWhitespace(sql.trim())
  if (!trimmed) {
    throw new Error('SQL query is empty')
  }
  if (!READ_ONLY_SQL_PATTERN.test(trimmed)) {
    throw new Error('Only read-only SELECT queries are allowed')
  }
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/password[^\s]*/gi, 'password=[redacted]')
}

const DEFAULT_MAX_ROWS = 500
const QUERY_TIMEOUT_MS = 30_000

export type QueryRow = Record<string, unknown>

export type ExecuteQueryResult = {
  columns: string[]
  rows: QueryRow[]
  rowCount: number
  latencyMs: number
  truncated: boolean
}

function assertSingleStatement(sql: string) {
  const withoutTrailing = sql.trim().replace(/;+\s*$/, '')
  if (withoutTrailing.includes(';')) {
    throw new Error('Only a single SQL statement is allowed')
  }
}

function serializeCell(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('base64')
  }
  return value
}

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

function assertSafeIdentifier(name: string, label: string) {
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new Error(`Invalid ${label}`)
  }
}

/** Quote identifiers when PostgreSQL would fold them (mixed case, etc.). */
function quoteSqlIdentifier(name: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) {
    return name
  }
  return `"${name.replace(/"/g, '""')}"`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * PostgreSQL rejects schema.database.table in one session ("cross-database references").
 * When the middle segment matches the connected database, rewrite to schema.table.
 */
export function normalizeCrossDatabaseReferences(sql: string, currentDatabase: string): string {
  const database = currentDatabase.trim()
  if (!database) return sql

  let result = sql.replace(new RegExp(`\\.${escapeRegExp(database)}\\.`, 'gi'), '.')
  result = result.replace(
    new RegExp(`\\.\"${escapeRegExp(database.replace(/"/g, '""'))}\"\\.`, 'g'),
    '.',
  )
  return result
}

/** schema.database.table for UI; quoted when needed for PascalCase / mixed-case names. */
export function formatQualifiedTableName(
  schema: string,
  table: string,
  database?: string,
): string {
  assertSafeIdentifier(schema, 'schema name')
  assertSafeIdentifier(table, 'table name')
  const schemaPart = quoteSqlIdentifier(schema)
  const tablePart = quoteSqlIdentifier(table)
  const db = database?.trim()
  if (db) {
    assertSafeIdentifier(db, 'database name')
    return `${schemaPart}.${quoteSqlIdentifier(db)}.${tablePart}`
  }
  return `${schemaPart}.${tablePart}`
}

export type SchemaTable = {
  schema: string
  name: string
  qualifiedName: string
}

export type SchemaColumn = {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
}

export async function listSchemaTables(
  dataSourceId: string,
  config: PostgresConnectionConfig,
  search = '',
): Promise<SchemaTable[]> {
  const pool = getOrCreatePool(dataSourceId, config)
  const client = await pool.connect()
  const trimmedSearch = search.trim().slice(0, 200)

  try {
    await configureReadOnlyClient(client)
    await client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`)

    const result = await client.query<{
      table_schema: string
      table_name: string
    }>(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
         AND table_type = 'BASE TABLE'
         AND has_table_privilege(format('%I.%I', table_schema, table_name), 'SELECT')
         AND (
           $1 = '' OR
           table_name ILIKE '%' || $1 || '%' OR
           (table_schema || '.' || table_name) ILIKE '%' || $1 || '%'
         )
       ORDER BY table_schema, table_name
       LIMIT 1000`,
      [trimmedSearch],
    )

    return result.rows.map((row) => ({
      schema: row.table_schema,
      name: row.table_name,
      qualifiedName: formatQualifiedTableName(
        row.table_schema,
        row.table_name,
        config.database,
      ),
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list tables'
    throw new Error(sanitizeErrorMessage(message))
  } finally {
    client.release()
  }
}

export async function getSchemaTableColumns(
  dataSourceId: string,
  config: PostgresConnectionConfig,
  schema: string,
  table: string,
): Promise<SchemaColumn[]> {
  assertSafeIdentifier(schema, 'schema name')
  assertSafeIdentifier(table, 'table name')

  const pool = getOrCreatePool(dataSourceId, config)
  const client = await pool.connect()

  try {
    await configureReadOnlyClient(client)
    await client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`)

    const result = await client.query<{
      column_name: string
      data_type: string
      is_nullable: string
      column_default: string | null
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table],
    )

    return result.rows.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load columns'
    throw new Error(sanitizeErrorMessage(message))
  } finally {
    client.release()
  }
}

export async function executeReadOnlyQuery(
  dataSourceId: string,
  config: PostgresConnectionConfig,
  sql: string,
  maxRows = DEFAULT_MAX_ROWS,
): Promise<ExecuteQueryResult> {
  assertReadOnlySql(sql)
  assertSingleStatement(sql)

  const pool = getOrCreatePool(dataSourceId, config)
  const started = Date.now()
  const client = await pool.connect()

  try {
    await configureReadOnlyClient(client)
    await client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`)

    const normalizedSql = normalizeCrossDatabaseReferences(sql.trim(), config.database)
    const result = await client.query(normalizedSql)
    const columns = result.fields.map((f) => f.name)
    const allRows = result.rows.map((row) => {
      const out: QueryRow = {}
      for (const col of columns) {
        out[col] = serializeCell(row[col])
      }
      return out
    })

    const truncated = allRows.length > maxRows
    const rows = truncated ? allRows.slice(0, maxRows) : allRows

    return {
      columns,
      rows,
      rowCount: rows.length,
      latencyMs: Date.now() - started,
      truncated,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed'
    throw new Error(sanitizeErrorMessage(message))
  } finally {
    client.release()
  }
}
