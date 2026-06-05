import { useEffect, useMemo, useState } from 'react'
import type {
  CreateSchedulePayload,
  CreateStatementSchedulePayload,
  ReportScheduleSummary,
  ScheduleGroupOption,
  SchedulableReportOption,
  SchedulableStatementOption,
  StatementScheduleSummary,
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
import { categoryMeta } from '../../lib/reportConstants'
import { statementTypeMeta } from '../../lib/statementConstants'
import type { StatementType } from '../../lib/statementConfig'
import { LoadingButton } from '../ui/LoadingButton'
import { SearchableSelect } from '../ui/SearchableSelect'

export type ScheduleKind = 'report' | 'statement'

export type ScheduleFormSubmit =
  | { kind: 'report'; data: CreateSchedulePayload }
  | { kind: 'statement'; data: CreateStatementSchedulePayload }

function isReportSchedule(
  initial: ReportScheduleSummary | StatementScheduleSummary | null | undefined,
): initial is ReportScheduleSummary {
  return initial != null && 'reportId' in initial
}

interface ScheduleFormModalProps {
  open: boolean
  title: string
  reports: SchedulableReportOption[]
  statements: SchedulableStatementOption[]
  groups: ScheduleGroupOption[]
  loading?: boolean
  initial?: ReportScheduleSummary | StatementScheduleSummary | null
  onConfirm: (payload: ScheduleFormSubmit) => void
  onCancel: () => void
}

export function ScheduleFormModal({
  open,
  title,
  reports,
  statements,
  groups,
  loading = false,
  initial = null,
  onConfirm,
  onCancel,
}: ScheduleFormModalProps) {
  const editingKind: ScheduleKind | null = initial
    ? isReportSchedule(initial)
      ? 'report'
      : 'statement'
    : null
  const lockTargetAndGroup = editingKind != null

  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('report')
  const [reportId, setReportId] = useState('')
  const [statementId, setStatementId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [recurrence, setRecurrence] = useState<ReportScheduleRecurrence>('ONCE')
  const [scheduledAtLocal, setScheduledAtLocal] = useState('')
  const [timeLocal, setTimeLocal] = useState(defaultTimeValue())
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)

  useEffect(() => {
    if (!open) return

    const kind = editingKind ?? 'report'
    setScheduleKind(kind)
    setReportId(isReportSchedule(initial) ? initial.reportId : '')
    setStatementId(
      initial && !isReportSchedule(initial) ? initial.statementId : '',
    )
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
  }, [open, initial, editingKind])

  const reportOptions = useMemo(
    () =>
      reports.map((report) => ({
        id: report.id,
        label: report.name,
        description: categoryMeta[report.category as keyof typeof categoryMeta]?.label ?? report.category,
      })),
    [reports],
  )

  const statementOptions = useMemo(
    () =>
      statements.map((statement) => {
        const meta = statementTypeMeta(statement.type as StatementType)
        return {
          id: statement.id,
          label: statement.name,
          description: meta.label,
        }
      }),
    [statements],
  )

  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        id: group.id,
        label: group.name,
        description: [
          `${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`,
          group.description,
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [groups],
  )

  if (!open) return null

  const activeKind = editingKind ?? scheduleKind
  const selectedGroup = groups.find((g) => g.id === groupId)
  const isOnce = recurrence === 'ONCE'
  const targetSelected =
    activeKind === 'report' ? reportId.length > 0 : statementId.length > 0

  const canSubmit =
    targetSelected &&
    groupId.length > 0 &&
    (selectedGroup?.memberCount ?? 0) > 0 &&
    (isOnce ? scheduledAtLocal.length > 0 : timeLocal.length > 0)

  function buildRecurrenceFields() {
    const timezoneOffsetMinutes = clientTimezoneOffsetMinutes()
    if (isOnce) {
      return {
        recurrence,
        timezoneOffsetMinutes,
        scheduledAt: datetimeLocalToIso(scheduledAtLocal),
      }
    }

    const timeMinutes = parseTimeInput(timeLocal)
    if (recurrence === 'DAILY') {
      return { recurrence, timezoneOffsetMinutes, timeMinutes }
    }
    if (recurrence === 'WEEKLY') {
      return { recurrence, timezoneOffsetMinutes, timeMinutes, dayOfWeek }
    }
    return { recurrence, timezoneOffsetMinutes, timeMinutes, dayOfMonth }
  }

  function handleSubmit() {
    const recurrenceFields = buildRecurrenceFields()
    if (activeKind === 'report') {
      onConfirm({
        kind: 'report',
        data: { reportId, groupId, ...recurrenceFields },
      })
      return
    }
    onConfirm({
      kind: 'statement',
      data: { statementId, groupId, ...recurrenceFields },
    })
  }

  const description =
    activeKind === 'report'
      ? 'Recipients receive an email with a link to open the report, plus PDF and CSV exports for the completed period before each run (previous day, week, or month).'
      : 'Recipients receive an email with a link to open the statement, plus PDF and CSV exports for the completed period before each run (previous day, week, or month).'

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
        <p className="mt-1 text-sm text-text-secondary">{description}</p>

        <div className="mt-5 space-y-4">
          {!lockTargetAndGroup && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Schedule type</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    scheduleKind === 'report'
                      ? 'border-brand-blue bg-brand-blue/5'
                      : 'border-border hover:border-brand-blue/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule-kind"
                    value="report"
                    checked={scheduleKind === 'report'}
                    onChange={() => setScheduleKind('report')}
                    className="accent-brand-blue"
                  />
                  <span>
                    <span className="font-medium text-text-primary">Report</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">
                      Email a published report
                    </span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    scheduleKind === 'statement'
                      ? 'border-brand-blue bg-brand-blue/5'
                      : 'border-border hover:border-brand-blue/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule-kind"
                    value="statement"
                    checked={scheduleKind === 'statement'}
                    onChange={() => setScheduleKind('statement')}
                    className="accent-brand-blue"
                  />
                  <span>
                    <span className="font-medium text-text-primary">Statement</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">
                      Email a published statement
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {activeKind === 'report' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Report</label>
              <SearchableSelect
                options={reportOptions}
                value={reportId || null}
                onChange={(next) => setReportId(next ?? '')}
                placeholder="Select a published report…"
                searchPlaceholder="Search reports..."
                emptyMessage="No reports found"
                maxVisibleItems={5}
                disabled={lockTargetAndGroup}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Statement</label>
              <SearchableSelect
                options={statementOptions}
                value={statementId || null}
                onChange={(next) => setStatementId(next ?? '')}
                placeholder="Select a published statement…"
                searchPlaceholder="Search statements..."
                emptyMessage="No statements found"
                maxVisibleItems={5}
                disabled={lockTargetAndGroup}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Recipient group</label>
            <SearchableSelect
              options={groupOptions}
              value={groupId || null}
              onChange={(next) => setGroupId(next ?? '')}
              placeholder="Select a user group…"
              searchPlaceholder="Search groups..."
              emptyMessage="No groups found"
              maxVisibleItems={5}
              disabled={lockTargetAndGroup}
            />
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

              {!lockTargetAndGroup && (
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
          <LoadingButton loading={loading} disabled={!canSubmit} onClick={handleSubmit}>
            Save schedule
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
