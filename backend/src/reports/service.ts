import { Prisma, ReportCategory, ReportVisualization, UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import {
  hasExplicitCustomReportView,
  hasReportsParentView,
  removeReportPermissions,
  syncReportPermissions,
} from './permissions.js'
import { normalizeShowInSidebarMenu } from './sidebarCategories.js'

const reportInclude = {
  dataSource: { select: { id: true, name: true, database: true, isActive: true } },
  createdBy: { select: { id: true, username: true, displayName: true } },
  updatedBy: { select: { id: true, username: true, displayName: true } },
} satisfies Prisma.SavedReportInclude

export type SavedReportListItem = {
  id: string
  name: string
  description: string | null
  category: ReportCategory
  visualization: ReportVisualization
  dataSourceId: string
  dataSourceName: string
  dataSourceDatabase: string
  isPublished: boolean
  showInSidebarMenu: boolean
  publishedAt: string | null
  createdByUsername: string | null
  updatedAt: string
  createdAt: string
}

export type SavedReportDetail = SavedReportListItem & {
  sql: string
  dataSourceActive: boolean
}

function authorName(user: { username: string; displayName: string | null } | null) {
  if (!user) return null
  return user.displayName?.trim() || user.username
}

function formatListItem(report: Prisma.SavedReportGetPayload<{ include: typeof reportInclude }>): SavedReportListItem {
  return {
    id: report.id,
    name: report.name,
    description: report.description,
    category: report.category,
    visualization: report.visualization,
    dataSourceId: report.dataSourceId,
    dataSourceName: report.dataSource.name,
    dataSourceDatabase: report.dataSource.database,
    isPublished: report.isPublished,
    showInSidebarMenu: report.showInSidebarMenu,
    publishedAt: report.publishedAt?.toISOString() ?? null,
    createdByUsername: authorName(report.createdBy),
    updatedAt: report.updatedAt.toISOString(),
    createdAt: report.createdAt.toISOString(),
  }
}

function formatDetail(report: Prisma.SavedReportGetPayload<{ include: typeof reportInclude }>): SavedReportDetail {
  return {
    ...formatListItem(report),
    sql: report.sql,
    dataSourceActive: report.dataSource.isActive,
  }
}

async function assertUniqueActiveName(name: string, excludeId?: string) {
  const existing = await prisma.savedReport.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (existing) {
    throw new Error('DUPLICATE_NAME')
  }
}

export type CreateSavedReportInput = {
  name: string
  description?: string | null
  category: ReportCategory
  showInSidebarMenu?: boolean
  sql: string
  visualization: ReportVisualization
  dataSourceId: string
  createdById?: string
}

export type UpdateSavedReportInput = {
  name?: string
  description?: string | null
  category?: ReportCategory
  showInSidebarMenu?: boolean
  sql?: string
  visualization?: ReportVisualization
  dataSourceId?: string
  updatedById?: string
}

export async function listSavedReports(options?: {
  category?: ReportCategory
  search?: string
  includeDeleted?: boolean
}): Promise<SavedReportListItem[]> {
  const where: Prisma.SavedReportWhereInput = {}

  if (!options?.includeDeleted) {
    where.deletedAt = null
  }

  if (options?.category) {
    where.category = options.category
  }

  if (options?.search?.trim()) {
    const q = options.search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }

  const reports = await prisma.savedReport.findMany({
    where,
    include: reportInclude,
    orderBy: [{ updatedAt: 'desc' }],
  })

  return reports.map(formatListItem)
}

export async function listSavedReportsByIds(ids: string[]): Promise<SavedReportListItem[]> {
  if (ids.length === 0) {
    return []
  }

  const reports = await prisma.savedReport.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: reportInclude,
    orderBy: [{ name: 'asc' }],
  })

  return reports.map(formatListItem)
}

export async function listAccessibleReports(
  permissions: string[],
  options?: {
    category?: ReportCategory
    search?: string
  },
  userType?: UserType,
): Promise<SavedReportListItem[]> {
  if (!hasReportsParentView(permissions)) {
    return []
  }

  const where: Prisma.SavedReportWhereInput = {
    deletedAt: null,
    isPublished: true,
  }

  if (options?.category) {
    where.category = options.category
  }

  if (options?.search?.trim()) {
    const q = options.search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }

  const reports = await prisma.savedReport.findMany({
    where,
    include: reportInclude,
    orderBy: [{ updatedAt: 'desc' }],
  })

  if (userType === UserType.OWNER || permissions.includes('*')) {
    return reports.map(formatListItem)
  }

  return reports
    .map(formatListItem)
    .filter((report) => hasExplicitCustomReportView(permissions, report.id))
}

export async function listAccessibleSidebarReports(
  permissions: string[],
  userType?: UserType,
): Promise<SavedReportListItem[]> {
  const reports = await listAccessibleReports(permissions, undefined, userType)
  return reports.filter((report) => report.showInSidebarMenu)
}

export async function getSavedReportById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<SavedReportDetail | null> {
  const report = await prisma.savedReport.findFirst({
    where: {
      id,
      ...(options?.includeDeleted ? {} : { deletedAt: null }),
    },
    include: reportInclude,
  })
  if (!report) {
    return null
  }
  return formatDetail(report)
}

export async function createSavedReport(input: CreateSavedReportInput): Promise<SavedReportDetail> {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: input.dataSourceId },
  })
  if (!dataSource) {
    throw new Error('DATA_SOURCE_NOT_FOUND')
  }

  await assertUniqueActiveName(input.name)

  const report = await prisma.savedReport.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      showInSidebarMenu: normalizeShowInSidebarMenu(
        input.category,
        input.showInSidebarMenu,
      ),
      sql: input.sql,
      visualization: input.visualization,
      dataSourceId: input.dataSourceId,
      isPublished: false,
      createdById: input.createdById,
      updatedById: input.createdById,
    },
    include: reportInclude,
  })

  return formatDetail(report)
}

export async function updateSavedReport(
  id: string,
  input: UpdateSavedReportInput,
): Promise<SavedReportDetail> {
  const existing = await prisma.savedReport.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  if (input.name) {
    await assertUniqueActiveName(input.name, id)
  }

  if (input.dataSourceId) {
    const dataSource = await prisma.dataSource.findUnique({
      where: { id: input.dataSourceId },
    })
    if (!dataSource) {
      throw new Error('DATA_SOURCE_NOT_FOUND')
    }
  }

  const nextCategory = input.category ?? existing.category
  const showInSidebarMenu =
    input.showInSidebarMenu !== undefined
      ? normalizeShowInSidebarMenu(nextCategory, input.showInSidebarMenu)
      : input.category !== undefined
        ? normalizeShowInSidebarMenu(nextCategory, existing.showInSidebarMenu)
        : undefined

  const report = await prisma.savedReport.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      showInSidebarMenu,
      sql: input.sql,
      visualization: input.visualization,
      dataSourceId: input.dataSourceId,
      updatedById: input.updatedById,
    },
    include: reportInclude,
  })

  if (existing.isPublished) {
    await syncReportPermissions(report.id, {
      name: report.name,
      category: report.category,
      showInSidebarMenu: report.showInSidebarMenu,
    })
  }

  return formatDetail(report)
}

export async function publishSavedReport(
  id: string,
  updatedById?: string,
): Promise<SavedReportDetail> {
  const existing = await prisma.savedReport.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }
  if (existing.isPublished) {
    const report = await prisma.savedReport.findFirstOrThrow({
      where: { id },
      include: reportInclude,
    })
    return formatDetail(report)
  }

  const report = await prisma.savedReport.update({
    where: { id },
    data: {
      isPublished: true,
      publishedAt: new Date(),
      updatedById,
    },
    include: reportInclude,
  })
  await syncReportPermissions(report.id, {
    name: report.name,
    category: report.category,
    showInSidebarMenu: report.showInSidebarMenu,
  })
  return formatDetail(report)
}

export async function unpublishSavedReport(
  id: string,
  updatedById?: string,
): Promise<SavedReportDetail> {
  const existing = await prisma.savedReport.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  const report = await prisma.savedReport.update({
    where: { id },
    data: {
      isPublished: false,
      publishedAt: null,
      updatedById,
    },
    include: reportInclude,
  })
  await removeReportPermissions(id)
  return formatDetail(report)
}

export async function softDeleteSavedReport(id: string, deletedById?: string): Promise<void> {
  const existing = await prisma.savedReport.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  await prisma.savedReport.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById,
    },
  })
  await removeReportPermissions(id)
}

export async function restoreSavedReport(id: string): Promise<SavedReportDetail> {
  const existing = await prisma.savedReport.findFirst({
    where: { id, deletedAt: { not: null } },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  await assertUniqueActiveName(existing.name, id)

  const report = await prisma.savedReport.update({
    where: { id },
    data: {
      deletedAt: null,
      deletedById: null,
    },
    include: reportInclude,
  })

  return formatDetail(report)
}
