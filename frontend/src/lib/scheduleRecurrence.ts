export type ReportScheduleRecurrence = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

export const RECURRENCE_OPTIONS: {
  value: ReportScheduleRecurrence
  label: string
  description: string
}[] = [
  {
    value: 'ONCE',
    label: 'One time',
    description: 'Send once at a specific date and time',
  },
  {
    value: 'DAILY',
    label: 'Daily',
    description: 'Send every day at the same time',
  },
  {
    value: 'WEEKLY',
    label: 'Weekly',
    description: 'Send on a chosen weekday each week',
  },
  {
    value: 'MONTHLY',
    label: 'Monthly',
    description: 'Send on a chosen day each month',
  },
]

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
] as const

export function clientTimezoneOffsetMinutes() {
  return new Date().getTimezoneOffset()
}

export function parseTimeInput(value: string): number {
  const [h, m] = value.split(':').map((p) => Number.parseInt(p, 10))
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error('Invalid time')
  }
  return h * 60 + m
}

export function formatTimeMinutes(timeMinutes: number): string {
  const h = Math.floor(timeMinutes / 60)
  const m = timeMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function timeMinutesFromDate(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

export function defaultTimeValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 15), 0, 0)
  return formatTimeMinutes(d.getHours() * 60 + d.getMinutes())
}

export function toDatetimeLocalValue(iso?: string): string {
  if (!iso) {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 15), 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString()
}
