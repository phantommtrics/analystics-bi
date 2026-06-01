import { useEffect, useState } from 'react'
import type { ScheduleGroupOption, SchedulableReportOption } from '../../api/schedules'
import { LoadingButton } from '../ui/LoadingButton'

interface ScheduleFormModalProps {
  open: boolean
  title: string
  reports: SchedulableReportOption[]
  groups: ScheduleGroupOption[]
  loading?: boolean
  initialReportId?: string
  initialGroupId?: string
  initialScheduledAt?: string
  /** When true, report and group cannot be changed (edit due time only). */
  lockReportAndGroup?: boolean
  onConfirm: (data: {
    reportId: string
    groupId: string
    scheduledAt: string
  }) => void
  onCancel: () => void
}

function toDatetimeLocalValue(iso?: string): string {
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

function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString()
}

export function ScheduleFormModal({
  open,
  title,
  reports,
  groups,
  loading = false,
  initialReportId = '',
  initialGroupId = '',
  initialScheduledAt,
  lockReportAndGroup = false,
  onConfirm,
  onCancel,
}: ScheduleFormModalProps) {
  const [reportId, setReportId] = useState(initialReportId)
  const [groupId, setGroupId] = useState(initialGroupId)
  const [scheduledAtLocal, setScheduledAtLocal] = useState(() =>
    toDatetimeLocalValue(initialScheduledAt),
  )

  useEffect(() => {
    if (!open) return
    setReportId(initialReportId)
    setGroupId(initialGroupId)
    setScheduledAtLocal(toDatetimeLocalValue(initialScheduledAt))
  }, [open, initialReportId, initialGroupId, initialScheduledAt])

  if (!open) return null

  const selectedGroup = groups.find((g) => g.id === groupId)
  const canSubmit =
    reportId.length > 0 &&
    groupId.length > 0 &&
    scheduledAtLocal.length > 0 &&
    (selectedGroup?.memberCount ?? 0) > 0

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
        className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-bg-primary p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          At the scheduled time, every active member of the selected group receives an email with
          a link to open the report. File attachments will be added in a later release.
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
            {reports.length === 0 && (
              <p className="mt-1.5 text-xs text-semantic-amber">
                No published reports available. Publish a report from Report Builder first.
              </p>
            )}
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
            {selectedGroup && selectedGroup.memberCount === 0 && (
              <p className="mt-1.5 text-xs text-semantic-red">
                This group has no members. Add operators to the group before scheduling.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Send on (your local time)</label>
            <input
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <LoadingButton variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </LoadingButton>
          <LoadingButton
            loading={loading}
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({
                reportId,
                groupId,
                scheduledAt: datetimeLocalToIso(scheduledAtLocal),
              })
            }
          >
            Save schedule
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
