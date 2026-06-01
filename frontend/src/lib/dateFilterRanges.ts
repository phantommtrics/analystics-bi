/** ISO date YYYY-MM-DD in local calendar. */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function todayIso(): string {
  return formatIsoDate(new Date())
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function endOfWeekSunday(date: Date): Date {
  const start = startOfWeekMonday(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return end
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function startOfQuarter(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3)
  return new Date(date.getFullYear(), q * 3, 1)
}

function endOfQuarter(date: Date): Date {
  const start = startOfQuarter(date)
  return new Date(start.getFullYear(), start.getMonth() + 3, 0)
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

export type CalendarPeriodView = 'week' | 'month' | 'year'

export type DateRange = { dateFrom: string; dateTo: string }

export function getCalendarPeriodRange(
  view: CalendarPeriodView,
  anchorIso: string,
  offset: number,
): DateRange {
  const anchor = parseIsoDate(anchorIso)

  if (view === 'week') {
    const weekStart = startOfWeekMonday(anchor)
    weekStart.setDate(weekStart.getDate() + offset * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return { dateFrom: formatIsoDate(weekStart), dateTo: formatIsoDate(weekEnd) }
  }

  if (view === 'month') {
    const monthStart = startOfMonth(addMonths(anchor, offset))
    const monthEnd = endOfMonth(monthStart)
    return { dateFrom: formatIsoDate(monthStart), dateTo: formatIsoDate(monthEnd) }
  }

  const yearStart = startOfYear(addYears(anchor, offset))
  const yearEnd = endOfYear(yearStart)
  return { dateFrom: formatIsoDate(yearStart), dateTo: formatIsoDate(yearEnd) }
}

export function formatCalendarPeriodLabel(
  view: CalendarPeriodView,
  range: DateRange,
): string {
  const from = parseIsoDate(range.dateFrom)
  const to = parseIsoDate(range.dateTo)

  if (view === 'week') {
    const a = from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const b = to.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return `${a} – ${b}`
  }

  if (view === 'month') {
    return from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  return from.getFullYear().toString()
}

export function currentWeekRange(): DateRange {
  const today = new Date()
  return {
    dateFrom: formatIsoDate(startOfWeekMonday(today)),
    dateTo: formatIsoDate(today),
  }
}

export function currentMonthRange(): DateRange {
  const today = new Date()
  return {
    dateFrom: formatIsoDate(startOfMonth(today)),
    dateTo: formatIsoDate(today),
  }
}

export function currentQuarterRange(): DateRange {
  const today = new Date()
  return {
    dateFrom: formatIsoDate(startOfQuarter(today)),
    dateTo: formatIsoDate(today),
  }
}

export function currentYearRange(): DateRange {
  const today = new Date()
  return {
    dateFrom: formatIsoDate(startOfYear(today)),
    dateTo: formatIsoDate(today),
  }
}

export function lastWeekRange(): DateRange {
  const today = new Date()
  const prevWeekEnd = addDays(startOfWeekMonday(today), -1)
  const prevWeekStart = startOfWeekMonday(prevWeekEnd)
  return {
    dateFrom: formatIsoDate(prevWeekStart),
    dateTo: formatIsoDate(prevWeekEnd),
  }
}

export function lastMonthRange(): DateRange {
  const today = new Date()
  const prev = addMonths(today, -1)
  return {
    dateFrom: formatIsoDate(startOfMonth(prev)),
    dateTo: formatIsoDate(endOfMonth(prev)),
  }
}

export function lastQuarterRange(): DateRange {
  const today = new Date()
  const qStart = startOfQuarter(today)
  const prevEnd = addDays(qStart, -1)
  const prevStart = startOfQuarter(prevEnd)
  return {
    dateFrom: formatIsoDate(prevStart),
    dateTo: formatIsoDate(prevEnd),
  }
}

export function lastYearRange(): DateRange {
  const y = new Date().getFullYear() - 1
  return {
    dateFrom: `${y}-01-01`,
    dateTo: `${y}-12-31`,
  }
}

export function rollingDaysRange(days: number): DateRange {
  const today = new Date()
  const from = addDays(today, -(days - 1))
  return { dateFrom: formatIsoDate(from), dateTo: formatIsoDate(today) }
}

export function yesterdayRange(): DateRange {
  const y = addDays(new Date(), -1)
  const iso = formatIsoDate(y)
  return { dateFrom: iso, dateTo: iso }
}

export function todayRange(): DateRange {
  const iso = todayIso()
  return { dateFrom: iso, dateTo: iso }
}
