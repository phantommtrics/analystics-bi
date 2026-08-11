import { ReportCategory, UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import {
  SIDEBAR_CATEGORY_LABELS,
  SIDEBAR_REPORT_CATEGORIES,
} from './sidebarCategories.js'
import { SIDEBAR_CATEGORY_SECTION_MODULE } from '../reports/sidebarCategories.js'
import { userCanExportReport } from '../reports/permissions.js'

export const CUSTOM_DASHBOARD_PREFIX = 'custom-dashboard-'

export const CUSTOM_DASHBOARD_ACTIONS = ['view', 'export_pdf', 'export_csv'] as const

export type CustomDashboardAction = (typeof CUSTOM_DASHBOARD_ACTIONS)[number]

export function dashboardModuleKey(dashboardId: string): string {
  return `${CUSTOM_DASHBOARD_PREFIX}${dashboardId}`
}

export function isCustomDashboardModule(moduleKey: string): boolean {
  return moduleKey.startsWith(CUSTOM_DASHBOARD_PREFIX)
}

export function dashboardIdFromModuleKey(moduleKey: string): string | null {
  if (!isCustomDashboardModule(moduleKey)) return null
  return moduleKey.slice(CUSTOM_DASHBOARD_PREFIX.length)
}

export type DashboardPermissionMeta = {
  name: string
  showInSidebarMenu: boolean
  sidebarCategory: ReportCategory | null
}

export function permissionDisplayName(meta: DashboardPermissionMeta): string {
  if (
    meta.showInSidebarMenu &&
    meta.sidebarCategory &&
    SIDEBAR_REPORT_CATEGORIES.has(meta.sidebarCategory)
  ) {
    const section = SIDEBAR_CATEGORY_LABELS[meta.sidebarCategory] ?? meta.sidebarCategory
    return `${section} — ${meta.name}`
  }
  return meta.name
}

export async function syncDashboardPermissions(
  dashboardId: string,
  meta: DashboardPermissionMeta,
) {
  const moduleKey = dashboardModuleKey(dashboardId)
  const displayName = permissionDisplayName(meta)
  for (const actionKey of CUSTOM_DASHBOARD_ACTIONS) {
    await prisma.permission.upsert({
      where: { moduleKey_actionKey: { moduleKey, actionKey } },
      update: {
        name: displayName,
        description: `${actionKey} access for dashboard "${meta.name}"`,
      },
      create: {
        moduleKey,
        actionKey,
        name: displayName,
        description: `${actionKey} access for dashboard "${meta.name}"`,
      },
    })
  }
}

export async function removeDashboardPermissions(dashboardId: string) {
  const moduleKey = dashboardModuleKey(dashboardId)
  await prisma.rolePermission.deleteMany({
    where: { permission: { moduleKey } },
  })
  await prisma.permission.deleteMany({ where: { moduleKey } })
}

export async function ensureAllDashboardPermissions() {
  const published = await prisma.dashboard.findMany({
    where: { deletedAt: null, isPublished: true },
    select: { id: true, name: true, showInSidebarMenu: true, sidebarCategory: true },
  })
  for (const dashboard of published) {
    await syncDashboardPermissions(dashboard.id, dashboard)
  }

  const unpublished = await prisma.dashboard.findMany({
    where: { deletedAt: null, isPublished: false },
    select: { id: true },
  })
  for (const dashboard of unpublished) {
    await removeDashboardPermissions(dashboard.id)
  }
}

/** Published dashboards shown under the main Dashboard menu (not a sidebar section). */
export async function listMainMenuDashboardModuleKeys(): Promise<string[]> {
  const dashboards = await prisma.dashboard.findMany({
    where: { deletedAt: null, isPublished: true, showInSidebarMenu: false },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  return dashboards.map((d) => dashboardModuleKey(d.id))
}

export async function listSidebarDashboardModulesBySection(): Promise<
  Record<string, string[]>
> {
  const dashboards = await prisma.dashboard.findMany({
    where: { deletedAt: null, isPublished: true, showInSidebarMenu: true },
    select: { id: true, sidebarCategory: true },
    orderBy: { name: 'asc' },
  })

  const grouped: Record<string, string[]> = {}
  for (const dashboard of dashboards) {
    if (!dashboard.sidebarCategory) continue
    const sectionKey = SIDEBAR_CATEGORY_SECTION_MODULE[dashboard.sidebarCategory]
    if (!sectionKey) continue
    const moduleKey = dashboardModuleKey(dashboard.id)
    if (!grouped[sectionKey]) {
      grouped[sectionKey] = []
    }
    grouped[sectionKey].push(moduleKey)
  }
  return grouped
}

export function hasExplicitCustomDashboardView(
  permissions: string[],
  dashboardId: string,
): boolean {
  return permissions.includes(`${dashboardModuleKey(dashboardId)}:view`)
}

export function hasDashboardParentView(permissions: string[]): boolean {
  return permissions.includes('*') || permissions.includes('dashboard:view')
}

export function userCanViewDashboard(
  permissions: string[],
  dashboardId: string,
  userType?: UserType,
): boolean {
  if (userType === UserType.OWNER || permissions.includes('*')) return true
  return hasExplicitCustomDashboardView(permissions, dashboardId)
}

function hasDashboardParentExport(
  permissions: string[],
  action: 'export_pdf' | 'export_csv',
): boolean {
  return permissions.includes('*') || permissions.includes(`dashboard:${action}`)
}

function hasExplicitCustomDashboardExport(
  permissions: string[],
  dashboardId: string,
  action: 'export_pdf' | 'export_csv',
): boolean {
  return permissions.includes(`${dashboardModuleKey(dashboardId)}:${action}`)
}

export function userCanExportDashboard(
  permissions: string[],
  dashboardId: string,
  action: 'export_pdf' | 'export_csv',
  userType?: UserType,
): boolean {
  if (!hasDashboardParentView(permissions)) return false
  if (userType === UserType.OWNER || permissions.includes('*')) return true
  return (
    hasDashboardParentExport(permissions, action) &&
    hasExplicitCustomDashboardExport(permissions, dashboardId, action)
  )
}

export function userCanExportDashboardWidget(
  permissions: string[],
  dashboardId: string,
  reportId: string,
  action: 'export_pdf' | 'export_csv',
  userType?: UserType,
): boolean {
  return (
    userCanExportDashboard(permissions, dashboardId, action, userType) &&
    userCanExportReport(permissions, reportId, action, userType)
  )
}

export function insertModulesAfter(
  modules: readonly string[],
  afterKey: string,
  insert: string[],
): string[] {
  const idx = modules.indexOf(afterKey)
  if (idx === -1) {
    return [...modules, ...insert]
  }
  return [
    ...modules.slice(0, idx + 1),
    ...insert,
    ...modules.slice(idx + 1),
  ]
}

export function buildDashboardPermissionModuleList(
  staticModules: readonly string[],
  mainMenuDashboardModules: string[],
  sidebarBySection: Record<string, string[]>,
): string[] {
  let modules = insertModulesAfter(staticModules, 'dashboard', mainMenuDashboardModules)
  for (const sectionKey of Object.keys(sidebarBySection).sort()) {
    if (modules.includes(sectionKey)) {
      modules = insertModulesAfter(modules, sectionKey, sidebarBySection[sectionKey] ?? [])
    }
  }
  return modules
}
