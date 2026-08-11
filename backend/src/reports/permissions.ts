import { ReportCategory, UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import {
  SIDEBAR_CATEGORY_LABELS,
  SIDEBAR_REPORT_CATEGORIES,
} from './sidebarCategories.js'

export const CUSTOM_REPORT_PREFIX = 'custom-report-'

export const CUSTOM_REPORT_ACTIONS = [
  'view',
  'export_pdf',
  'export_csv',
  'schedule',
] as const

export type CustomReportAction = (typeof CUSTOM_REPORT_ACTIONS)[number]

export function reportModuleKey(reportId: string): string {
  return `${CUSTOM_REPORT_PREFIX}${reportId}`
}

export function isCustomReportModule(moduleKey: string): boolean {
  return moduleKey.startsWith(CUSTOM_REPORT_PREFIX)
}

export function reportIdFromModuleKey(moduleKey: string): string | null {
  if (!isCustomReportModule(moduleKey)) return null
  return moduleKey.slice(CUSTOM_REPORT_PREFIX.length)
}

export type ReportPermissionMeta = {
  name: string
  category: ReportCategory
  showInSidebarMenu: boolean
}

export function permissionDisplayName(meta: ReportPermissionMeta): string {
  if (meta.showInSidebarMenu && SIDEBAR_REPORT_CATEGORIES.has(meta.category)) {
    const section = SIDEBAR_CATEGORY_LABELS[meta.category] ?? meta.category
    return `${section} — ${meta.name}`
  }
  return meta.name
}

export async function syncReportPermissions(
  reportId: string,
  meta: ReportPermissionMeta,
) {
  const moduleKey = reportModuleKey(reportId)
  const displayName = permissionDisplayName(meta)
  for (const actionKey of CUSTOM_REPORT_ACTIONS) {
    await prisma.permission.upsert({
      where: { moduleKey_actionKey: { moduleKey, actionKey } },
      update: {
        name: displayName,
        description: `${actionKey} access for report "${meta.name}"`,
      },
      create: {
        moduleKey,
        actionKey,
        name: displayName,
        description: `${actionKey} access for report "${meta.name}"`,
      },
    })
  }
}

export async function removeReportPermissions(reportId: string) {
  const moduleKey = reportModuleKey(reportId)
  await prisma.rolePermission.deleteMany({
    where: { permission: { moduleKey } },
  })
  await prisma.permission.deleteMany({ where: { moduleKey } })
}

export async function ensureAllReportPermissions() {
  const published = await prisma.savedReport.findMany({
    where: { deletedAt: null, isPublished: true },
    select: { id: true, name: true, category: true, showInSidebarMenu: true },
  })
  for (const report of published) {
    await syncReportPermissions(report.id, report)
  }

  const unpublished = await prisma.savedReport.findMany({
    where: { deletedAt: null, isPublished: false },
    select: { id: true },
  })
  for (const report of unpublished) {
    await removeReportPermissions(report.id)
  }
}

export async function listCatalogReportModuleKeys(): Promise<string[]> {
  const reports = await prisma.savedReport.findMany({
    where: { deletedAt: null, isPublished: true, showInSidebarMenu: false },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  return reports.map((r) => reportModuleKey(r.id))
}

/** Sidebar reports grouped by parent section module (agents, balance, …). */
/** @deprecated Use listCatalogReportModuleKeys */
export async function listCustomReportModuleKeys(): Promise<string[]> {
  const reports = await prisma.savedReport.findMany({
    where: { deletedAt: null, isPublished: true },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  return reports.map((r) => reportModuleKey(r.id))
}

export function hasExplicitCustomReportView(
  permissions: string[],
  reportId: string,
): boolean {
  return permissions.includes(`${reportModuleKey(reportId)}:view`)
}

export function hasReportsParentView(permissions: string[]): boolean {
  return permissions.includes('*') || permissions.includes('reports:view')
}

export function userCanViewReport(
  permissions: string[],
  reportId: string,
  userType?: UserType,
): boolean {
  if (userType === UserType.OWNER || permissions.includes('*')) return true
  // Explicit per-report grant is enough (cross-org). Org membership is not an ACL.
  return hasExplicitCustomReportView(permissions, reportId)
}

/** Report IDs embedded in published dashboards the user can view. */
export async function reportIdsAccessibleViaDashboards(
  permissions: string[],
  userType?: UserType,
): Promise<Set<string>> {
  if (userType === UserType.OWNER || permissions.includes('*')) {
    return new Set()
  }

  const { hasDashboardParentView, hasExplicitCustomDashboardView } = await import(
    '../dashboards/permissions.js'
  )
  if (!hasDashboardParentView(permissions)) {
    return new Set()
  }

  const { extractReportIdsFromLayout, parseDashboardLayout } = await import(
    '../dashboards/layout.js'
  )

  const dashboards = await prisma.dashboard.findMany({
    where: { deletedAt: null, isPublished: true },
    select: { id: true, layout: true },
  })

  const ids = new Set<string>()
  for (const dashboard of dashboards) {
    if (!hasExplicitCustomDashboardView(permissions, dashboard.id)) continue
    for (const reportId of extractReportIdsFromLayout(parseDashboardLayout(dashboard.layout))) {
      ids.add(reportId)
    }
  }
  return ids
}

export async function userCanAccessPublishedReport(
  permissions: string[],
  reportId: string,
  userType?: UserType,
): Promise<boolean> {
  if (userCanViewReport(permissions, reportId, userType)) return true
  if (!hasReportsParentView(permissions)) return false
  const viaDashboards = await reportIdsAccessibleViaDashboards(permissions, userType)
  return viaDashboards.has(reportId)
}

function hasReportsParentExport(
  permissions: string[],
  action: 'export_pdf' | 'export_csv',
): boolean {
  return permissions.includes('*') || permissions.includes(`reports:${action}`)
}

function hasExplicitCustomReportExport(
  permissions: string[],
  reportId: string,
  action: 'export_pdf' | 'export_csv',
): boolean {
  return permissions.includes(`${reportModuleKey(reportId)}:${action}`)
}

export function userCanExportReport(
  permissions: string[],
  reportId: string,
  action: 'export_pdf' | 'export_csv',
  userType?: UserType,
): boolean {
  if (!hasReportsParentView(permissions)) return false
  if (userType === UserType.OWNER || permissions.includes('*')) return true
  return (
    hasReportsParentExport(permissions, action) &&
    hasExplicitCustomReportExport(permissions, reportId, action)
  )
}
