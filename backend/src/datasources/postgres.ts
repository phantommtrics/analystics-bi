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

export function assertReadOnlySql(sql: string) {
  const trimmed = sql.trim()
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

    const result = await client.query(sql.trim())
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
