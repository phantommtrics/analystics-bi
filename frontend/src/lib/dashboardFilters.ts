import type { UserType } from '../auth/types'
import { expandQueryFilters, formatVariableLabel, isDateVariable } from './sqlVariables'
import {
  currentMonthRange,
  currentQuarterRange,
  currentWeekRange,
  currentYearRange,
  lastMonthRange,
  lastQuarterRange,
  lastWeekRange,
  lastYearRange,
  rollingDaysRange,
  todayRange,
  yesterdayRange,
  type DateRange,
} from './dateFilterRanges'

export { expandQueryFilters } from './sqlVariables'

export type DateFilterPresetId =
  | 'none'
  | 'custom'
  | 'today'
  | 'yesterday'
  | 'current-week'
  | 'current-month'
  | 'current-quarter'
  | 'current-year'
  | 'last-week'
  | 'last-month'
  | 'last-quarter'
  | 'last-year'
  | 'last-7-days'
  | 'last-30-days'
  | 'last-90-days'
  | 'last-365-days'

export type DashboardFilters = {
  /** When false, report widgets must not fetch data. */
  enabled: boolean
  dateFrom: string
  dateTo: string
  preset: DateFilterPresetId
}

export type DatePresetGroup = {
  label: string
  presets: Array<{
    id: Exclude<DateFilterPresetId, 'none' | 'custom'>
    label: string
    getRange: () => DateRange
  }>
}

export const DATE_PRESET_GROUPS: DatePresetGroup[] = [
  {
    label: 'Current',
    presets: [
      { id: 'current-week', label: 'This week', getRange: currentWeekRange },
      { id: 'current-month', label: 'This month', getRange: currentMonthRange },
      { id: 'current-quarter', label: 'This quarter', getRange: currentQuarterRange },
      { id: 'current-year', label: 'This year', getRange: currentYearRange },
    ],
  },
  {
    label: 'Previous',
    presets: [
      { id: 'last-week', label: 'Last week', getRange: lastWeekRange },
      { id: 'last-month', label: 'Last month', getRange: lastMonthRange },
      { id: 'last-quarter', label: 'Last quarter', getRange: lastQuarterRange },
      { id: 'last-year', label: 'Last year', getRange: lastYearRange },
    ],
  },
  {
    label: 'Rolling',
    presets: [
      { id: 'today', label: 'Today', getRange: todayRange },
      { id: 'yesterday', label: 'Yesterday', getRange: yesterdayRange },
      { id: 'last-7-days', label: 'Last 7 days', getRange: () => rollingDaysRange(7) },
      { id: 'last-30-days', label: 'Last 30 days', getRange: () => rollingDaysRange(30) },
      { id: 'last-90-days', label: 'Last 90 days', getRange: () => rollingDaysRange(90) },
      { id: 'last-365-days', label: 'Last year', getRange: () => rollingDaysRange(365) },
    ],
  },
]

export const ALL_DATE_PRESETS = DATE_PRESET_GROUPS.flatMap((g) => g.presets)

export function getPresetRange(presetId: DateFilterPresetId): DateRange | null {
  if (presetId === 'none' || presetId === 'custom') return null
  const preset = ALL_DATE_PRESETS.find((p) => p.id === presetId)
  return preset ? preset.getRange() : null
}

export function defaultDashboardFilters(): DashboardFilters {
  const range = currentMonthRange()
  return {
    enabled: true,
    preset: 'current-month',
    ...range,
  }
}

export function filtersWithPreset(
  presetId: Exclude<DateFilterPresetId, 'none' | 'custom'>,
): DashboardFilters {
  const range = getPresetRange(presetId)!
  return { enabled: true, preset: presetId, ...range }
}

export function filtersDisabled(): DashboardFilters {
  return { enabled: false, preset: 'none', dateFrom: '', dateTo: '' }
}

export function filtersFromSearchParams(params: URLSearchParams): DashboardFilters {
  if (params.get('dateFilter') === 'none') {
    return filtersDisabled()
  }

  const presetParam = params.get('datePreset') as DateFilterPresetId | null
  if (presetParam && presetParam !== 'custom' && presetParam !== 'none') {
    const range = getPresetRange(presetParam)
    if (range) {
      return { enabled: true, preset: presetParam, ...range }
    }
  }

  const dateFrom = params.get('dateFrom')
  const dateTo = params.get('dateTo')
  if (dateFrom && dateTo) {
    return {
      enabled: true,
      preset: 'custom',
      dateFrom,
      dateTo,
    }
  }

  return defaultDashboardFilters()
}

export function writeFiltersToSearchParams(
  params: URLSearchParams,
  filters: DashboardFilters,
): void {
  if (!filters.enabled || filters.preset === 'none') {
    params.set('dateFilter', 'none')
    params.delete('datePreset')
    params.delete('dateFrom')
    params.delete('dateTo')
    return
  }

  params.delete('dateFilter')
  if (filters.preset !== 'custom') {
    params.set('datePreset', filters.preset)
  } else {
    params.delete('datePreset')
  }
  params.set('dateFrom', filters.dateFrom)
  params.set('dateTo', filters.dateTo)
}

/** Map dashboard date range to SQL placeholder values; undefined when filter disabled. */
export function filtersToQueryRecord(
  filters: DashboardFilters,
): Record<string, string> | undefined {
  if (!filters.enabled) return undefined
  return expandQueryFilters({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  })
}

export const NO_QUERY_FILTERS_KEY = '__no_date_filter__'

export function serializeQueryFilters(
  filters: Record<string, string> | undefined,
): string {
  if (!filters) return NO_QUERY_FILTERS_KEY
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

export function formatQueryFiltersLabel(
  dateFilters: DashboardFilters,
  options?: {
    hasDateVariables?: boolean
    variables?: string[]
    values?: Record<string, string>
  },
): string {
  const parts: string[] = []
  if (options?.hasDateVariables) {
    parts.push(formatFilterLabel(dateFilters))
  }
  for (const name of options?.variables ?? []) {
    if (isDateVariable(name)) continue
    const value = options?.values?.[name]?.trim()
    if (!value) continue
    parts.push(`${formatVariableLabel(name)}: ${value}`)
  }
  if (parts.length === 0) return 'No filters'
  return parts.join(' · ')
}

export function formatFilterLabel(filters: DashboardFilters): string {
  if (!filters.enabled) return 'No date filter'

  if (filters.preset !== 'custom') {
    const preset = ALL_DATE_PRESETS.find((p) => p.id === filters.preset)
    if (preset) return preset.label
  }

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

/** @deprecated Use DATE_PRESET_GROUPS */
export const DATE_FILTER_PRESETS = ALL_DATE_PRESETS.map((p) => ({
  label: p.label,
  getRange: p.getRange,
}))
