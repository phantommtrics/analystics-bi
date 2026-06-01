import { useEffect, useState } from 'react'
import type {
  CreateSchedulePayload,
  ReportScheduleSummary,
  ScheduleGroupOption,
  SchedulableReportOption,
} from '../../api/schedules'
import {
  RECURRENCE_OPTIONS,
  WEEKDAY_OPTIONS,
  clientTimezoneOffsetMinutes,
  datetimeLocalToIso,
  defaultTimeValue,
  parseTimeInput,
  toDatetimeLocalValue,
  type ReportScheduleRecurrence,
} from '../../lib/scheduleRecurrence'
import { LoadingButton } from '../ui/LoadingButton'

interface ScheduleFormModalProps {
  open: boolean
  title: string
  reports: SchedulableReportOption[]
  groups: ScheduleGroupOption[]
  loading?: boolean
  initial?: ReportScheduleSummary | null
  lockReportAndGroup?: boolean
  onConfirm: (data: CreateSchedulePayload) => void
  onCancel: () => void
}

export function ScheduleFormModal({
  open,
  title,
  reports,
  groups,
  loading = false,
  initial = null,
  lockReportAndGroup = false,
  onConfirm,
  onCancel,
}: ScheduleFormModalProps) {
  const [reportId, setReportId] = useState(initial?.reportId ?? '')
  const [groupId, setGroupId] = useState(initial?.groupId ?? '')
  const [recurrence, setRecurrence] = useState<ReportScheduleRecurrence>(
    initial?.recurrence ?? 'ONCE',
  )
  const [scheduledAtLocal, setScheduledAtLocal] = useState(() =>
    toDatetimeLocalValue(initial?.scheduledAt),
  )
  const [timeLocal, setTimeLocal] = useState(() =>
    initial?.timeMinutes != null
      ? `${String(Math.floor(initial.timeMinutes / 60)).padStart(2, '0')}:${String(initial.timeMinutes % 60).padStart(2, '0')}`
      : defaultTimeValue(),
  )
  const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek ?? 1)
  const [dayOfMonth, setDayOfMonth] = useState(initial?.dayOfMonth ?? 1)

  useEffect(() => {
    if (!open) return
    setReportId(initial?.reportId ?? '')
    setGroupId(initial?.groupId ?? '')
    setRecurrence(initial?.recurrence ?? 'ONCE')
    setScheduledAtLocal(toDatetimeLocalValue(initial?.scheduledAt))
    setTimeLocal(
      initial?.timeMinutes != null
        ? `${String(Math.floor(initial.timeMinutes / 60)).padStart(2, '0')}:${String(initial.timeMinutes % 60).padStart(2, '0')}`
        : initial?.scheduledAt
          ? `${String(new Date(initial.scheduledAt).getHours()).padStart(2, '0')}:${String(new Date(initial.scheduledAt).getMinutes()).padStart(2, '0')}`
          : defaultTimeValue(),
    )
    setDayOfWeek(initial?.dayOfWeek ?? 1)
    setDayOfMonth(initial?.dayOfMonth ?? 1)
  }, [open, initial])

  if (!open) return null

  const selectedGroup = groups.find((g) => g.id === groupId)
  const isOnce = recurrence === 'ONCE'

  const canSubmit =
    reportId.length > 0 &&
    groupId.length > 0 &&
    (selectedGroup?.memberCount ?? 0) > 0 &&
    (isOnce ? scheduledAtLocal.length > 0 : timeLocal.length > 0)

  function buildPayload(): CreateSchedulePayload {
    const timezoneOffsetMinutes = clientTimezoneOffsetMinutes()
    const base = {
      reportId,
      groupId,
      recurrence,
      timezoneOffsetMinutes,
    }

    if (isOnce) {
      return {
        ...base,
        scheduledAt: datetimeLocalToIso(scheduledAtLocal),
      }
    }

    const timeMinutes = parseTimeInput(timeLocal)
    if (recurrence === 'DAILY') {
      return { ...base, timeMinutes }
    }
    if (recurrence === 'WEEKLY') {
      return { ...base, timeMinutes, dayOfWeek }
    }
    return { ...base, timeMinutes, dayOfMonth }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={loading ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-bg-primary p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Recipients receive an email with a link to open the report. Times use your browser&apos;s
          local timezone. PDF and CSV attachments are planned for a later release.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Report</label>
            <select
              value={reportId}
              disabled={lockReportAndGroup}
              onChange={(e) => setReportId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue disabled:opacity-60"
            >
              <option value="">Select a published report…</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Recipient group</label>
            <select
              value={groupId}
              disabled={lockReportAndGroup}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue disabled:opacity-60"
            >
              <option value="">Select a user group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount} member{g.memberCount === 1 ? '' : 's'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Frequency</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {RECURRENCE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer flex-col rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    recurrence === opt.value
                      ? 'border-brand-blue bg-brand-blue/5'
                      : 'border-border hover:border-brand-blue/40'
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-text-primary">
                    <input
                      type="radio"
                      name="recurrence"
                      value={opt.value}
                      checked={recurrence === opt.value}
                      onChange={() => setRecurrence(opt.value)}
                      className="accent-brand-blue"
                    />
                    {opt.label}
                  </span>
                  <span className="mt-1 pl-6 text-xs text-text-secondary">{opt.description}</span>
                </label>
              ))}
            </div>
          </div>

          {isOnce ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Send on</label>
              <input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Time of day</label>
                <input
                  type="time"
                  value={timeLocal}
                  onChange={(e) => setTimeLocal(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
                />
              </div>

              {recurrence === 'WEEKLY' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Day of week</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
                  >
                    {WEEKDAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {recurrence === 'MONTHLY' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Day of month</label>
                  <select
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Day {d}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-text-secondary">
                    For months with fewer days (e.g. February), the last day of that month is used.
                  </p>
                </div>
              )}

              {!lockReportAndGroup && (
                <p className="rounded-md border border-border bg-bg-secondary px-3 py-2 text-xs text-text-secondary">
                  The first email goes out at the next matching date and time after you save.
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <LoadingButton variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </LoadingButton>
          <LoadingButton
            loading={loading}
            disabled={!canSubmit}
            onClick={() => onConfirm(buildPayload())}
          >
            Save schedule
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
