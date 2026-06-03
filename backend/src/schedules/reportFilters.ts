import { ReportScheduleRecurrence } from '@prisma/client'
import { expandDashboardFilters } from '../reports/sqlFilters.js'
import {
  applyDateRangeToVariables,
  defaultValueForVariable,
  extractSqlVariables,
  isDateVariable,
  sqlHasDateVariables,
} from '../reports/sqlVariables.js'
import { dateRangeEndingOnAnchor } from './dateRanges.js'
import { scheduleLocalAnchorDate } from './localTime.js'

export type ScheduleFilterContext = {
  scheduledAt: Date
  timezoneOffsetMinutes: number
  recurrence: ReportScheduleRecurrence
}

function recurrenceRangeKind(
  recurrence: ReportScheduleRecurrence,
): 'day' | 'week' | 'month' {
  switch (recurrence) {
    case ReportScheduleRecurrence.WEEKLY:
      return 'week'
    case ReportScheduleRecurrence.MONTHLY:
      return 'month'
    default:
      return 'day'
  }
}

export function scheduleDateRange(ctx: ScheduleFilterContext) {
  const anchorIso = scheduleLocalAnchorDate(ctx.scheduledAt, ctx.timezoneOffsetMinutes)
  return dateRangeEndingOnAnchor(anchorIso, recurrenceRangeKind(ctx.recurrence))
}

export function formatScheduleFilterLabel(range: { dateFrom: string; dateTo: string }): string {
  if (range.dateFrom === range.dateTo) {
    return range.dateFrom
  }
  return `${range.dateFrom} – ${range.dateTo}`
}

/** Build SQL filter values for a scheduled run using the schedule's local date/time as anchor. */
export function buildScheduleExecuteFilters(
  sql: string,
  ctx: ScheduleFilterContext,
): Record<string, string> {
  const variables = extractSqlVariables(sql)
  const anchorIso = scheduleLocalAnchorDate(ctx.scheduledAt, ctx.timezoneOffsetMinutes)

  if (!sqlHasDateVariables(variables)) {
    const custom: Record<string, string> = {}
    for (const name of variables) {
      const value = defaultValueForVariable(name, anchorIso)
      if (value) custom[name] = value
    }
    return expandDashboardFilters(custom)
  }

  const range = scheduleDateRange(ctx)
  const withDates = applyDateRangeToVariables(variables, range.dateFrom, range.dateTo, {})

  for (const name of variables) {
    if (isDateVariable(name)) continue
    if (!withDates[name]) {
      const value = defaultValueForVariable(name, anchorIso)
      if (value) withDates[name] = value
    }
  }

  return expandDashboardFilters(withDates)
}
