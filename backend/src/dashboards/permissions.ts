import { UserType } from '@prisma/client'
import { prisma } from '../prisma.js'

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

export async function syncDashboardPermissions(dashboardId: string, dashboardName: string) {
  const moduleKey = dashboardModuleKey(dashboardId)
  for (const actionKey of CUSTOM_DASHBOARD_ACTIONS) {
    await prisma.permission.upsert({
      where: { moduleKey_actionKey: { moduleKey, actionKey } },
      update: {
        name: `${dashboardName}`,
        description: `${actionKey} access for dashboard "${dashboardName}"`,
      },
      create: {
        moduleKey,
        actionKey,
        name: `${dashboardName}`,
        description: `${actionKey} access for dashboard "${dashboardName}"`,
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
    select: { id: true, name: true },
  })
  for (const dashboard of published) {
    await syncDashboardPermissions(dashboard.id, dashboard.name)
  }

  const unpublished = await prisma.dashboard.findMany({
    where: { deletedAt: null, isPublished: false },
    select: { id: true },
  })
  for (const dashboard of unpublished) {
    await removeDashboardPermissions(dashboard.id)
  }
}

export async function listCustomDashboardModuleKeys(): Promise<string[]> {
  const dashboards = await prisma.dashboard.findMany({
    where: { deletedAt: null, isPublished: true },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  return dashboards.map((d) => dashboardModuleKey(d.id))
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
  if (!hasDashboardParentView(permissions)) return false
  if (userType === UserType.OWNER || permissions.includes('*')) return true
  return hasExplicitCustomDashboardView(permissions, dashboardId)
}

export function buildPermissionModuleList(
  staticModules: readonly string[],
  customDashboardModules: string[],
): string[] {
  const dashboardIdx = staticModules.indexOf('dashboard')
  if (dashboardIdx === -1) {
    return [...staticModules, ...customDashboardModules]
  }
  return [
    ...staticModules.slice(0, dashboardIdx + 1),
    ...customDashboardModules,
    ...staticModules.slice(dashboardIdx + 1),
  ]
}
