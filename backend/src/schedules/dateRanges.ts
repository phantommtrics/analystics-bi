export type DateRange = { dateFrom: string; dateTo: string }

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Date range for a scheduled report, anchored to the schedule's local calendar day. */
export function dateRangeEndingOnAnchor(anchorIso: string, kind: 'day' | 'week' | 'month'): DateRange {
  const anchor = parseIsoDate(anchorIso)

  if (kind === 'day') {
    return { dateFrom: anchorIso, dateTo: anchorIso }
  }

  if (kind === 'week') {
    return {
      dateFrom: formatIsoDate(startOfWeekMonday(anchor)),
      dateTo: anchorIso,
    }
  }

  return {
    dateFrom: formatIsoDate(startOfMonth(anchor)),
    dateTo: anchorIso,
  }
}
