import type { UserType } from '../auth/types'

export type DashboardFilters = {
  dateFrom: string
  dateTo: string
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function defaultDashboardFilters(): DashboardFilters {
  const today = new Date()
  const from = new Date(today.getFullYear(), today.getMonth(), 1)
  return {
    dateFrom: formatIsoDate(from),
    dateTo: formatIsoDate(today),
  }
}

export function filtersFromSearchParams(params: URLSearchParams): DashboardFilters {
  const dateFrom = params.get('dateFrom')
  const dateTo = params.get('dateTo')
  if (dateFrom && dateTo) {
    return { dateFrom, dateTo }
  }
  return defaultDashboardFilters()
}

export function filtersToQueryRecord(filters: DashboardFilters): Record<string, string> {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }
}

export function dashboardModuleKey(dashboardId: string): string {
  return `custom-dashboard-${dashboardId}`
}

export function hasDashboardParentView(permissions: string[]): boolean {
  return permissions.includes('*') || permissions.includes('dashboard:view')
}

export function hasExplicitPermission(
  permissions: string[],
  moduleKey: string,
  actionKey = 'view',
): boolean {
  if (permissions.includes('*')) return true
  return permissions.includes(`${moduleKey}:${actionKey}`)
}

export function canViewCustomDashboard(
  permissions: string[],
  dashboardId: string,
  userType?: UserType,
): boolean {
  if (!hasDashboardParentView(permissions)) return false
  if (userType === 'OWNER' || permissions.includes('*')) return true
  return hasExplicitPermission(permissions, dashboardModuleKey(dashboardId), 'view')
}

export const DATE_FILTER_PRESETS = [
  {
    label: 'Today',
    getRange: () => {
      const today = new Date()
      const iso = formatIsoDate(today)
      return { dateFrom: iso, dateTo: iso }
    },
  },
  {
    label: 'Last 7 days',
    getRange: () => {
      const today = new Date()
      const from = new Date(today)
      from.setDate(from.getDate() - 6)
      return { dateFrom: formatIsoDate(from), dateTo: formatIsoDate(today) }
    },
  },
  {
    label: 'Last 30 days',
    getRange: () => {
      const today = new Date()
      const from = new Date(today)
      from.setDate(from.getDate() - 29)
      return { dateFrom: formatIsoDate(from), dateTo: formatIsoDate(today) }
    },
  },
  {
    label: 'This month',
    getRange: () => defaultDashboardFilters(),
  },
] as const

export function formatFilterLabel(filters: DashboardFilters): string {
  if (filters.dateFrom === filters.dateTo) {
    return new Date(`${filters.dateFrom}T12:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  const from = new Date(`${filters.dateFrom}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const to = new Date(`${filters.dateTo}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${from} – ${to}`
}
