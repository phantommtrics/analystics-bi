/** Subscription billing period shorter than 30 calendar days. */
export const SHORT_CYCLE_MAX_DAYS = 30

const MS_PER_DAY = 86_400_000

const REMINDER_STATUSES = new Set(['TRIALING', 'ACTIVE', 'PAST_DUE'])

export function isReminderEligibleStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return REMINDER_STATUSES.has(status)
}

export function subscriptionCycleLengthDays(
  periodStart: Date | null | undefined,
  periodEnd: Date | null | undefined,
): number | null {
  if (!periodStart || !periodEnd) return null
  const ms = periodEnd.getTime() - periodStart.getTime()
  if (ms <= 0) return null
  return ms / MS_PER_DAY
}

/** True when the current billing period is strictly less than one month. */
export function isShortSubscriptionCycle(
  periodStart: Date | null | undefined,
  periodEnd: Date | null | undefined,
): boolean {
  const days = subscriptionCycleLengthDays(periodStart, periodEnd)
  if (days === null) return false
  return days < SHORT_CYCLE_MAX_DAYS
}

export function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function localHourMinute(date: Date, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return { hour, minute }
}

/** Production: once per local calendar day at or after 00:00. */
export function isDailyMidnightSendWindow(
  now: Date,
  lastSentAt: Date | null | undefined,
  timeZone: string,
): boolean {
  const { hour, minute } = localHourMinute(now, timeZone)
  if (hour !== 0) return false
  if (minute > 5) return false
  const today = formatDateInTimezone(now, timeZone)
  if (!lastSentAt) return true
  const lastDay = formatDateInTimezone(lastSentAt, timeZone)
  return lastDay !== today
}

/** Test mode: first send after boot + delay, then every delay interval. */
export function isTestModeSendDue(
  now: Date,
  lastSentAt: Date | null | undefined,
  processorStartedAt: Date,
  delayMs: number,
): boolean {
  const firstDue = processorStartedAt.getTime() + delayMs
  if (now.getTime() < firstDue) return false
  if (!lastSentAt) return true
  return now.getTime() - lastSentAt.getTime() >= delayMs
}

export function daysUntilPeriodEnd(periodEnd: Date | null | undefined, now = new Date()): number | null {
  if (!periodEnd) return null
  const ms = periodEnd.getTime() - now.getTime()
  return Math.ceil(ms / MS_PER_DAY)
}
