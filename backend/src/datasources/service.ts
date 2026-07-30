import type { DataSource, SslMode } from '@prisma/client'
import { prisma } from '../prisma.js'
import { log, truncateSql } from '../utils/logger.js'
import { decrypt, encrypt } from './crypto.js'
import {
  destroyPool,
  executeReadOnlyQuery,
  getSchemaTableColumns,
  listSchemaTables,
  testConnection,
  type ExecuteQueryResult,
  type PostgresConnectionConfig,
  type SchemaColumn,
  type SchemaTable,
  type TestConnectionResult,
} from './postgres.js'

export type DataSourcePublic = {
  id: string
  name: string
  type: DataSource['type']
  host: string
  port: number
  database: string
  username: string
  sslMode: SslMode
  isActive: boolean
  organizationId: string
  organizationName: string
  createdAt: Date
  updatedAt: Date
}

type DataSourceWithOrganization = DataSource & {
  organization: { id: string; name: string }
}

export type CreateDataSourceInput = {
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  sslMode: SslMode
  isActive?: boolean
  createdById?: string
  organizationId: string
}

export type UpdateDataSourceInput = {
  name?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  sslMode?: SslMode
  isActive?: boolean
}

function toConnectionConfig(record: DataSource, password: string): PostgresConnectionConfig {
  return {
    host: record.host,
    port: record.port,
    database: record.database,
    username: record.username,
    password,
    sslMode: record.sslMode,
  }
}

export function formatDataSource(record: DataSourceWithOrganization): DataSourcePublic {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    host: record.host,
    port: record.port,
    database: record.database,
    username: record.username,
    sslMode: record.sslMode,
    isActive: record.isActive,
    organizationId: record.organization.id,
    organizationName: record.organization.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function getConnectionConfig(record: DataSource): PostgresConnectionConfig {
  const password = decrypt(record.passwordEncrypted)
  return toConnectionConfig(record, password)
}

export async function listDataSources(
  activeOnly = false,
  organizationId?: string,
): Promise<DataSourcePublic[]> {
  const records = await prisma.dataSource.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(organizationId ? { organizationId } : {}),
    },
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  return records.map(formatDataSource)
}

export async function getDataSourceById(id: string): Promise<DataSource | null> {
  return prisma.dataSource.findUnique({ where: { id } })
}

export async function createDataSource(input: CreateDataSourceInput): Promise<DataSourcePublic> {
  const record = await prisma.dataSource.create({
    data: {
      name: input.name,
      host: input.host,
      port: input.port,
      database: input.database,
      username: input.username,
      passwordEncrypted: encrypt(input.password),
      sslMode: input.sslMode,
      isActive: input.isActive ?? true,
      createdById: input.createdById,
      organizationId: input.organizationId,
    },
    include: { organization: { select: { id: true, name: true } } },
  })
  return formatDataSource(record)
}

export async function updateDataSource(
  id: string,
  input: UpdateDataSourceInput,
): Promise<DataSourcePublic> {
  const existing = await prisma.dataSource.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  await destroyPool(id)

  const record = await prisma.dataSource.update({
    where: { id },
    data: {
      name: input.name,
      host: input.host,
      port: input.port,
      database: input.database,
      username: input.username,
      sslMode: input.sslMode,
      isActive: input.isActive,
      ...(input.password !== undefined
        ? { passwordEncrypted: encrypt(input.password) }
        : {}),
    },
    include: { organization: { select: { id: true, name: true } } },
  })
  return formatDataSource(record)
}

export async function deleteDataSource(id: string): Promise<void> {
  const existing = await prisma.dataSource.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }
  await destroyPool(id)
  await prisma.dataSource.delete({ where: { id } })
}

export async function testDataSourceConnection(id: string): Promise<TestConnectionResult> {
  const record = await prisma.dataSource.findUnique({ where: { id } })
  if (!record) {
    throw new Error('NOT_FOUND')
  }
  const config = getConnectionConfig(record)
  return testConnection(config)
}

export async function executeDataSourceQuery(
  dataSourceId: string,
  sql: string,
): Promise<ExecuteQueryResult> {
  const record = await prisma.dataSource.findUnique({ where: { id: dataSourceId } })
  if (!record) {
    throw new Error('NOT_FOUND')
  }
  if (!record.isActive) {
    throw new Error('INACTIVE')
  }
  const config = getConnectionConfig(record)
  log(
    'query',
    `Executing datasource="${record.name}" db=${record.database} sql=${truncateSql(sql)}`,
  )
  const result = await executeReadOnlyQuery(record.id, config, sql)
  log(
    'query',
    `Completed datasource="${record.name}" rows=${result.rowCount} latency=${result.latencyMs}ms${result.truncated ? ' (truncated)' : ''}`,
  )
  return result
}

async function requireActiveDataSource(dataSourceId: string) {
  const record = await prisma.dataSource.findUnique({ where: { id: dataSourceId } })
  if (!record) {
    throw new Error('NOT_FOUND')
  }
  if (!record.isActive) {
    throw new Error('INACTIVE')
  }
  return { record, config: getConnectionConfig(record) }
}

export async function listDataSourceTables(
  dataSourceId: string,
  search = '',
): Promise<SchemaTable[]> {
  const { record, config } = await requireActiveDataSource(dataSourceId)
  return listSchemaTables(record.id, config, search)
}

export async function getDataSourceTableColumns(
  dataSourceId: string,
  schema: string,
  table: string,
): Promise<SchemaColumn[]> {
  const { record, config } = await requireActiveDataSource(dataSourceId)
  return getSchemaTableColumns(record.id, config, schema, table)
}
