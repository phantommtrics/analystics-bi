import { ReportScheduleRecurrence } from '@prisma/client'

export type RecurrenceInput = {
  recurrence: ReportScheduleRecurrence
  timeMinutes?: number | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  timezoneOffsetMinutes: number
  scheduledAt?: Date
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export function parseTimeInput(value: string): number {
  const [h, m] = value.split(':').map((p) => Number.parseInt(p, 10))
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error('INVALID_TIME')
  }
  return h * 60 + m
}

export function formatTimeMinutes(timeMinutes: number): string {
  const h = Math.floor(timeMinutes / 60)
  const m = timeMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function localDayUtc(
  year: number,
  month: number,
  day: number,
  timeMinutes: number,
  timezoneOffsetMinutes: number,
): Date {
  const h = Math.floor(timeMinutes / 60)
  const m = timeMinutes % 60
  return new Date(
    Date.UTC(year, month - 1, day, h, m, 0, 0) + timezoneOffsetMinutes * 60_000,
  )
}

function utcToLocalYmd(utc: Date, timezoneOffsetMinutes: number) {
  const localMs = utc.getTime() - timezoneOffsetMinutes * 60_000
  const d = new Date(localMs)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  }
}

function addLocalDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000)
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  }
}

function localIsoWeekday(year: number, month: number, day: number, timezoneOffsetMinutes: number) {
  const noon = localDayUtc(year, month, day, 12 * 60, timezoneOffsetMinutes)
  const dow = noon.getUTCDay()
  return dow === 0 ? 7 : dow
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function clampDayOfMonth(year: number, month: number, dayOfMonth: number) {
  return Math.min(dayOfMonth, daysInMonth(year, month))
}

export function validateRecurrenceInput(input: RecurrenceInput): void {
  if (input.recurrence === ReportScheduleRecurrence.ONCE) {
    if (!input.scheduledAt) {
      throw new Error('SCHEDULE_REQUIRED')
    }
    if (input.scheduledAt.getTime() <= Date.now()) {
      throw new Error('SCHEDULE_IN_PAST')
    }
    return
  }

  if (input.timeMinutes == null || input.timeMinutes < 0 || input.timeMinutes > 1439) {
    throw new Error('INVALID_TIME')
  }

  if (input.recurrence === ReportScheduleRecurrence.WEEKLY) {
    if (input.dayOfWeek == null || input.dayOfWeek < 1 || input.dayOfWeek > 7) {
      throw new Error('INVALID_DAY_OF_WEEK')
    }
  }

  if (input.recurrence === ReportScheduleRecurrence.MONTHLY) {
    if (input.dayOfMonth == null || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
      throw new Error('INVALID_DAY_OF_MONTH')
    }
  }
}

export function computeNextRunAt(input: RecurrenceInput, after: Date = new Date()): Date {
  validateRecurrenceInput({ ...input, scheduledAt: input.scheduledAt ?? after })

  if (input.recurrence === ReportScheduleRecurrence.ONCE) {
    return input.scheduledAt!
  }

  const timeMinutes = input.timeMinutes!
  const tz = input.timezoneOffsetMinutes

  if (input.recurrence === ReportScheduleRecurrence.DAILY) {
    let { year, month, day } = utcToLocalYmd(after, tz)
    for (let i = 0; i < 370; i++) {
      const candidate = localDayUtc(year, month, day, timeMinutes, tz)
      if (candidate.getTime() > after.getTime()) {
        return candidate
      }
      ;({ year, month, day } = addLocalDays(year, month, day, 1))
    }
    throw new Error('COULD_NOT_COMPUTE_NEXT_RUN')
  }

  if (input.recurrence === ReportScheduleRecurrence.WEEKLY) {
    const targetDow = input.dayOfWeek!
    let { year, month, day } = utcToLocalYmd(after, tz)
    for (let i = 0; i < 370; i++) {
      if (localIsoWeekday(year, month, day, tz) === targetDow) {
        const candidate = localDayUtc(year, month, day, timeMinutes, tz)
        if (candidate.getTime() > after.getTime()) {
          return candidate
        }
      }
      ;({ year, month, day } = addLocalDays(year, month, day, 1))
    }
    throw new Error('COULD_NOT_COMPUTE_NEXT_RUN')
  }

  const targetDom = input.dayOfMonth!
  let { year, month } = utcToLocalYmd(after, tz)
  for (let i = 0; i < 24; i++) {
    const day = clampDayOfMonth(year, month, targetDom)
    const candidate = localDayUtc(year, month, day, timeMinutes, tz)
    if (candidate.getTime() > after.getTime()) {
      return candidate
    }
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  throw new Error('COULD_NOT_COMPUTE_NEXT_RUN')
}

export function formatRecurrenceSummary(schedule: {
  recurrence: ReportScheduleRecurrence
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
}): string {
  if (schedule.recurrence === ReportScheduleRecurrence.ONCE) {
    return 'One time'
  }
  const time =
    schedule.timeMinutes != null ? formatTimeMinutes(schedule.timeMinutes) : '??:??'
  switch (schedule.recurrence) {
    case ReportScheduleRecurrence.DAILY:
      return `Daily at ${time}`
    case ReportScheduleRecurrence.WEEKLY: {
      const idx = (schedule.dayOfWeek ?? 1) - 1
      const day = WEEKDAY_NAMES[idx] ?? '?'
      return `Weekly on ${day} at ${time}`
    }
    case ReportScheduleRecurrence.MONTHLY: {
      const dom = schedule.dayOfMonth ?? 1
      const suffix =
        dom >= 11 && dom <= 13
          ? 'th'
          : dom % 10 === 1
            ? 'st'
            : dom % 10 === 2
              ? 'nd'
              : dom % 10 === 3
                ? 'rd'
                : 'th'
      return `Monthly on day ${dom}${suffix} at ${time}`
    }
    default:
      return schedule.recurrence
  }
}

export function isRecurring(recurrence: ReportScheduleRecurrence) {
  return recurrence !== ReportScheduleRecurrence.ONCE
}
