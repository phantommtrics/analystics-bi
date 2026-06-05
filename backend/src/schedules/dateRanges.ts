import { ReportScheduleRecurrence } from '@prisma/client'

export type DateRange = { dateFrom: string; dateTo: string }

export type ScheduleDateRangeInput = {
  anchorIso: string
  recurrence: ReportScheduleRecurrence
  dayOfMonth?: number | null
}

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso)
  d.setDate(d.getDate() + days)
  return formatIsoDate(d)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function previousMonthSameDay(anchorIso: string, dayOfMonth: number): string {
  const anchor = parseIsoDate(anchorIso)
  let year = anchor.getFullYear()
  let month = anchor.getMonth() + 1

  month -= 1
  if (month < 1) {
    month = 12
    year -= 1
  }

  const day = Math.min(dayOfMonth, daysInMonth(year, month))
  return formatIsoDate(new Date(year, month - 1, day))
}

/** Date range for a scheduled report, using the period before the schedule run (n-1). */
export function scheduleReportDateRange(input: ScheduleDateRangeInput): DateRange {
  const { anchorIso, recurrence, dayOfMonth } = input

  if (recurrence === ReportScheduleRecurrence.ONCE) {
    return { dateFrom: anchorIso, dateTo: anchorIso }
  }

  if (recurrence === ReportScheduleRecurrence.DAILY) {
    const previous = addDays(anchorIso, -1)
    return { dateFrom: previous, dateTo: previous }
  }

  if (recurrence === ReportScheduleRecurrence.WEEKLY) {
    return {
      dateFrom: addDays(anchorIso, -7),
      dateTo: addDays(anchorIso, -1),
    }
  }

  const dom = dayOfMonth ?? parseIsoDate(anchorIso).getDate()
  return {
    dateFrom: previousMonthSameDay(anchorIso, dom),
    dateTo: addDays(anchorIso, -1),
  }
}
