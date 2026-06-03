export function utcToLocalYmd(utc: Date, timezoneOffsetMinutes: number) {
  const localMs = utc.getTime() - timezoneOffsetMinutes * 60_000
  const d = new Date(localMs)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  }
}

export function formatLocalYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Calendar date (YYYY-MM-DD) of the schedule run in the schedule's local timezone. */
export function scheduleLocalAnchorDate(
  scheduledAt: Date,
  timezoneOffsetMinutes: number,
): string {
  const { year, month, day } = utcToLocalYmd(scheduledAt, timezoneOffsetMinutes)
  return formatLocalYmd(year, month, day)
}
