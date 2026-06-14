import { Prisma, ReportCategory, StatementType, UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import {
  type StatementConfig,
  extractReportIdsFromConfig,
  parseStatementConfig,
} from './config.js'
import {
  hasExplicitCustomStatementView,
  hasStatementParentView,
  removeStatementPermissions,
  syncStatementPermissions,
} from './permissions.js'
import { listSavedReportsByIds, type SavedReportListItem } from '../reports/service.js'

const statementInclude = {
  createdBy: { select: { id: true, username: true, displayName: true } },
  updatedBy: { select: { id: true, username: true, displayName: true } },
} satisfies Prisma.StatementInclude

export type StatementListItem = {
  id: string
  name: string
  description: string | null
  type: StatementType
  category: ReportCategory
  isPublished: boolean
  publishedAt: string | null
  createdByUsername: string | null
  updatedAt: string
  createdAt: string
}

export type StatementDetail = StatementListItem & {
  config: StatementConfig
}

function authorName(user: { username: string; displayName: string | null } | null) {
  if (!user) return null
  return user.displayName?.trim() || user.username
}

function formatListItem(
  row: Prisma.StatementGetPayload<{ include: typeof statementInclude }>,
): StatementListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    category: row.category,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdByUsername: authorName(row.createdBy),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

function formatDetail(
  row: Prisma.StatementGetPayload<{ include: typeof statementInclude }>,
): StatementDetail {
  return {
    ...formatListItem(row),
    config: parseStatementConfig(row.type, row.config),
  }
}

async function assertUniqueActiveName(name: string, organizationId: string, excludeId?: string) {
  const existing = await prisma.statement.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      deletedAt: null,
      organizationId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (existing) {
    throw new Error('DUPLICATE_NAME')
  }
}

async function validateReportIds(config: StatementConfig) {
  const ids = extractReportIdsFromConfig(config)
  if (ids.length === 0) return
  const count = await prisma.savedReport.count({
    where: { id: { in: ids }, deletedAt: null },
  })
  if (count !== ids.length) {
    throw new Error('INVALID_REPORT')
  }
}

export async function listStatements(
  search?: string,
  category?: ReportCategory,
  type?: StatementType,
  organizationId?: string,
): Promise<StatementListItem[]> {
  const where: Prisma.StatementWhereInput = { deletedAt: null }
  if (organizationId) where.organizationId = organizationId
  if (search?.trim()) {
    const q = search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (category) {
    where.category = category
  }
  if (type) {
    where.type = type
  }

  const rows = await prisma.statement.findMany({
    where,
    include: statementInclude,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(formatListItem)
}

export async function listAccessibleStatements(
  permissions: string[],
  search?: string,
  category?: ReportCategory,
  type?: StatementType,
  userType?: UserType,
): Promise<StatementListItem[]> {
  if (!hasStatementParentView(permissions)) {
    return []
  }

  const where: Prisma.StatementWhereInput = { deletedAt: null, isPublished: true }
  if (search?.trim()) {
    const q = search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (category) {
    where.category = category
  }
  if (type) {
    where.type = type
  }

  const rows = await prisma.statement.findMany({
    where,
    include: statementInclude,
    orderBy: { updatedAt: 'desc' },
  })

  if (userType === UserType.OWNER || permissions.includes('*')) {
    return rows.map(formatListItem)
  }

  return rows
    .map(formatListItem)
    .filter((statement) => hasExplicitCustomStatementView(permissions, statement.id))
}

export async function listStatementReports(statementId: string): Promise<SavedReportListItem[]> {
  const row = await prisma.statement.findFirst({
    where: { id: statementId, deletedAt: null },
    select: { type: true, config: true },
  })
  if (!row) {
    throw new Error('NOT_FOUND')
  }

  const config = parseStatementConfig(row.type, row.config)
  const reportIds = extractReportIdsFromConfig(config)
  return listSavedReportsByIds(reportIds)
}

export async function statementContainsReport(
  statementId: string,
  reportId: string,
): Promise<boolean> {
  const row = await prisma.statement.findFirst({
    where: { id: statementId, deletedAt: null, isPublished: true },
    select: { type: true, config: true },
  })
  if (!row) {
    return false
  }

  const config = parseStatementConfig(row.type, row.config)
  return extractReportIdsFromConfig(config).includes(reportId)
}

export async function getStatementById(id: string): Promise<StatementDetail | null> {
  const row = await prisma.statement.findFirst({
    where: { id, deletedAt: null },
    include: statementInclude,
  })
  if (!row) return null
  return formatDetail(row)
}

export type CreateStatementInput = {
  name: string
  description?: string | null
  type: StatementType
  category?: ReportCategory
  config: StatementConfig
  createdById?: string
  organizationId: string
}

export async function createStatement(input: CreateStatementInput): Promise<StatementDetail> {
  await assertUniqueActiveName(input.name, input.organizationId)
  await validateReportIds(input.config)

  const row = await prisma.statement.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      category: input.category ?? ReportCategory.GENERAL,
      config: input.config as Prisma.InputJsonValue,
      isPublished: false,
      organizationId: input.organizationId,
      createdById: input.createdById,
      updatedById: input.createdById,
    },
    include: statementInclude,
  })
  return formatDetail(row)
}

export type UpdateStatementInput = {
  name?: string
  description?: string | null
  type?: StatementType
  category?: ReportCategory
  config?: StatementConfig
  updatedById?: string
}

export async function updateStatement(
  id: string,
  input: UpdateStatementInput,
): Promise<StatementDetail> {
  const existing = await prisma.statement.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  if (input.name) {
    await assertUniqueActiveName(input.name, existing.organizationId, id)
  }

  const nextType = input.type ?? existing.type
  if (input.config) {
    parseStatementConfig(nextType, input.config)
    await validateReportIds(input.config)
  }

  const row = await prisma.statement.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      type: input.type,
      category: input.category,
      ...(input.config ? { config: input.config as Prisma.InputJsonValue } : {}),
      updatedById: input.updatedById,
    },
    include: statementInclude,
  })
  if (existing.isPublished) {
    await syncStatementPermissions(row.id, { name: row.name })
  }
  return formatDetail(row)
}

export async function publishStatement(
  id: string,
  updatedById?: string,
): Promise<StatementDetail> {
  const existing = await prisma.statement.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }
  if (existing.isPublished) {
    return formatDetail(
      await prisma.statement.findFirstOrThrow({
        where: { id },
        include: statementInclude,
      }),
    )
  }

  const row = await prisma.statement.update({
    where: { id },
    data: {
      isPublished: true,
      publishedAt: new Date(),
      updatedById,
    },
    include: statementInclude,
  })
  await syncStatementPermissions(row.id, { name: row.name })
  return formatDetail(row)
}

export async function unpublishStatement(
  id: string,
  updatedById?: string,
): Promise<StatementDetail> {
  const existing = await prisma.statement.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  const row = await prisma.statement.update({
    where: { id },
    data: {
      isPublished: false,
      publishedAt: null,
      updatedById,
    },
    include: statementInclude,
  })
  await removeStatementPermissions(id)
  return formatDetail(row)
}

export async function softDeleteStatement(id: string, deletedById?: string): Promise<void> {
  const existing = await prisma.statement.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }
  await prisma.statement.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById },
  })
  await removeStatementPermissions(id)
}
