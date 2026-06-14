import { Prisma, ReportCategory, UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import {
  hasDashboardParentView,
  hasExplicitCustomDashboardView,
  removeDashboardPermissions,
  syncDashboardPermissions,
  userCanViewDashboard,
} from './permissions.js'
import {
  type DashboardLayout,
  emptyDashboardLayout,
  extractReportIdsFromLayout,
  isKpiWidget,
  isReportWidget,
  parseDashboardLayout,
} from './layout.js'
import { normalizeDashboardSidebarMenu } from './sidebarCategories.js'
import { listSavedReportsByIds, type SavedReportListItem } from '../reports/service.js'

const dashboardInclude = {
  createdBy: { select: { id: true, username: true, displayName: true } },
  updatedBy: { select: { id: true, username: true, displayName: true } },
} satisfies Prisma.DashboardInclude

export type DashboardListItem = {
  id: string
  name: string
  description: string | null
  widgetCount: number
  isPublished: boolean
  showInSidebarMenu: boolean
  sidebarCategory: ReportCategory | null
  publishedAt: string | null
  createdByUsername: string | null
  updatedAt: string
  createdAt: string
}

export type DashboardDetail = DashboardListItem & {
  layout: DashboardLayout
}

function authorName(user: { username: string; displayName: string | null } | null) {
  if (!user) return null
  return user.displayName?.trim() || user.username
}

function formatListItem(
  row: Prisma.DashboardGetPayload<{ include: typeof dashboardInclude }>,
): DashboardListItem {
  const layout = parseDashboardLayout(row.layout)
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    widgetCount: layout.widgets.length,
    isPublished: row.isPublished,
    showInSidebarMenu: row.showInSidebarMenu,
    sidebarCategory: row.sidebarCategory,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdByUsername: authorName(row.createdBy),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

function formatDetail(
  row: Prisma.DashboardGetPayload<{ include: typeof dashboardInclude }>,
): DashboardDetail {
  return {
    ...formatListItem(row),
    layout: parseDashboardLayout(row.layout),
  }
}

async function assertUniqueActiveName(name: string, organizationId: string, excludeId?: string) {
  const existing = await prisma.dashboard.findFirst({
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

async function validateReportIds(layout: DashboardLayout) {
  const ids = [
    ...new Set([
      ...layout.widgets.filter(isReportWidget).map((w) => w.savedReportId),
      ...layout.widgets
        .filter(isKpiWidget)
        .map((w) => w.savedReportId)
        .filter((id): id is string => Boolean(id)),
    ]),
  ]
  if (ids.length === 0) return
  const count = await prisma.savedReport.count({
    where: { id: { in: ids }, deletedAt: null },
  })
  if (count !== ids.length) {
    throw new Error('INVALID_REPORT')
  }
}

export async function listDashboards(
  search?: string,
  organizationId?: string,
): Promise<DashboardListItem[]> {
  const where: Prisma.DashboardWhereInput = { deletedAt: null }
  if (organizationId) where.organizationId = organizationId
  if (search?.trim()) {
    const q = search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.dashboard.findMany({
    where,
    include: dashboardInclude,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(formatListItem)
}

export async function listAccessibleDashboards(
  permissions: string[],
  search?: string,
  userType?: UserType,
  organizationId?: string,
): Promise<DashboardListItem[]> {
  if (!hasDashboardParentView(permissions)) {
    return []
  }

  const where: Prisma.DashboardWhereInput = { deletedAt: null, isPublished: true }
  if (organizationId) where.organizationId = organizationId
  if (search?.trim()) {
    const q = search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.dashboard.findMany({
    where,
    include: dashboardInclude,
    orderBy: { updatedAt: 'desc' },
  })

  if (userType === UserType.OWNER || permissions.includes('*')) {
    return rows.map(formatListItem)
  }

  return rows
    .map(formatListItem)
    .filter((dashboard) => hasExplicitCustomDashboardView(permissions, dashboard.id))
}

export async function listAccessibleSidebarDashboards(
  permissions: string[],
  userType?: UserType,
): Promise<DashboardListItem[]> {
  const dashboards = await listAccessibleDashboards(permissions, undefined, userType)
  return dashboards.filter((dashboard) => dashboard.showInSidebarMenu)
}

export async function listDashboardReports(dashboardId: string): Promise<SavedReportListItem[]> {
  const row = await prisma.dashboard.findFirst({
    where: { id: dashboardId, deletedAt: null },
    select: { layout: true },
  })
  if (!row) {
    throw new Error('NOT_FOUND')
  }

  const layout = parseDashboardLayout(row.layout)
  const reportIds = extractReportIdsFromLayout(layout)
  return listSavedReportsByIds(reportIds)
}

export async function dashboardContainsReport(
  dashboardId: string,
  reportId: string,
): Promise<boolean> {
  const row = await prisma.dashboard.findFirst({
    where: { id: dashboardId, deletedAt: null, isPublished: true },
    select: { layout: true },
  })
  if (!row) {
    return false
  }

  const layout = parseDashboardLayout(row.layout)
  return extractReportIdsFromLayout(layout).includes(reportId)
}

export async function getDashboardById(id: string): Promise<DashboardDetail | null> {
  const row = await prisma.dashboard.findFirst({
    where: { id, deletedAt: null },
    include: dashboardInclude,
  })
  if (!row) return null
  return formatDetail(row)
}

export type CreateDashboardInput = {
  name: string
  description?: string | null
  layout?: DashboardLayout
  showInSidebarMenu?: boolean
  sidebarCategory?: ReportCategory | null
  createdById?: string
  organizationId: string
}

export async function createDashboard(input: CreateDashboardInput): Promise<DashboardDetail> {
  await assertUniqueActiveName(input.name, input.organizationId)
  const layout = input.layout ?? emptyDashboardLayout()
  await validateReportIds(layout)

  const sidebar = normalizeDashboardSidebarMenu(
    input.showInSidebarMenu,
    input.sidebarCategory,
  )

  const row = await prisma.dashboard.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      layout: layout as Prisma.InputJsonValue,
      showInSidebarMenu: sidebar.showInSidebarMenu,
      sidebarCategory: sidebar.sidebarCategory,
      isPublished: false,
      organizationId: input.organizationId,
      createdById: input.createdById,
      updatedById: input.createdById,
    },
    include: dashboardInclude,
  })
  return formatDetail(row)
}

export type UpdateDashboardInput = {
  name?: string
  description?: string | null
  layout?: DashboardLayout
  showInSidebarMenu?: boolean
  sidebarCategory?: ReportCategory | null
  updatedById?: string
}

export async function updateDashboard(
  id: string,
  input: UpdateDashboardInput,
): Promise<DashboardDetail> {
  const existing = await prisma.dashboard.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  if (input.name) {
    await assertUniqueActiveName(input.name, existing.organizationId, id)
  }

  if (input.layout) {
    await validateReportIds(input.layout)
  }

  const nextSidebar =
    input.showInSidebarMenu !== undefined || input.sidebarCategory !== undefined
      ? normalizeDashboardSidebarMenu(
          input.showInSidebarMenu ?? existing.showInSidebarMenu,
          input.sidebarCategory !== undefined
            ? input.sidebarCategory
            : existing.sidebarCategory,
        )
      : null

  const row = await prisma.dashboard.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      ...(input.layout ? { layout: input.layout as Prisma.InputJsonValue } : {}),
      ...(nextSidebar
        ? {
            showInSidebarMenu: nextSidebar.showInSidebarMenu,
            sidebarCategory: nextSidebar.sidebarCategory,
          }
        : {}),
      updatedById: input.updatedById,
    },
    include: dashboardInclude,
  })
  if (existing.isPublished) {
    await syncDashboardPermissions(row.id, {
      name: row.name,
      showInSidebarMenu: row.showInSidebarMenu,
      sidebarCategory: row.sidebarCategory,
    })
  }
  return formatDetail(row)
}

export async function publishDashboard(
  id: string,
  updatedById?: string,
): Promise<DashboardDetail> {
  const existing = await prisma.dashboard.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }
  if (existing.isPublished) {
    return formatDetail(
      await prisma.dashboard.findFirstOrThrow({
        where: { id },
        include: dashboardInclude,
      }),
    )
  }

  const row = await prisma.dashboard.update({
    where: { id },
    data: {
      isPublished: true,
      publishedAt: new Date(),
      updatedById,
    },
    include: dashboardInclude,
  })
  await syncDashboardPermissions(row.id, {
    name: row.name,
    showInSidebarMenu: row.showInSidebarMenu,
    sidebarCategory: row.sidebarCategory,
  })
  return formatDetail(row)
}

export async function unpublishDashboard(
  id: string,
  updatedById?: string,
): Promise<DashboardDetail> {
  const existing = await prisma.dashboard.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  const row = await prisma.dashboard.update({
    where: { id },
    data: {
      isPublished: false,
      publishedAt: null,
      updatedById,
    },
    include: dashboardInclude,
  })
  await removeDashboardPermissions(id)
  return formatDetail(row)
}

export async function softDeleteDashboard(id: string, deletedById?: string): Promise<void> {
  const existing = await prisma.dashboard.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }
  await prisma.dashboard.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById },
  })
  await removeDashboardPermissions(id)
}
