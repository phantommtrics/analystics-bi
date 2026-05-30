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

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return formatIsoDate(date)
}

/** Map dashboard date range to SQL placeholder values used by saved reports. */
export function filtersToQueryRecord(filters: DashboardFilters): Record<string, string> {
  const { dateFrom, dateTo } = filters
  return {
    dateFrom,
    dateTo,
    startDate: dateFrom,
    endDate: dateTo,
    start_date: dateFrom,
    end_date: dateTo,
    fromDate: dateFrom,
    toDate: dateTo,
    from_date: dateFrom,
    to_date: dateTo,
    dateToEnd: `${dateTo} 23:59:59`,
    endDateTime: `${dateTo} 23:59:59.999`,
    dateToExclusive: addDays(dateTo, 1),
  }
}

export function serializeQueryFilters(filters: Record<string, string>): string {
  return JSON.stringify(filters)
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
