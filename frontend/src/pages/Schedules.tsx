import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { ScheduleFormModal } from '../components/schedules/ScheduleFormModal'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { DataTable } from '../components/ui/DataTable'
import {
  schedulesApi,
  type CreateSchedulePayload,
  type ReportScheduleSummary,
  type ReportScheduleStatus,
  type ScheduleGroupOption,
  type SchedulableReportOption,
  type UpdateSchedulePayload,
} from '../api/schedules'
import { useAuth } from '../auth/AuthContext'

const STATUS_LABELS: Record<ReportScheduleStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Sent',
  FAILED: 'Failed',
}

const STATUS_VARIANTS: Record<
  ReportScheduleStatus,
  'green' | 'amber' | 'gray' | 'red'
> = {
  ACTIVE: 'green',
  PAUSED: 'amber',
  COMPLETED: 'gray',
  FAILED: 'red',
}

function formatScheduleDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function isOneTimeCompleted(schedule: ReportScheduleSummary) {
  return schedule.recurrence === 'ONCE' && schedule.status === 'COMPLETED'
}

export function Schedules() {
  const { accessToken, hasPermission } = useAuth()
  const [schedules, setSchedules] = useState<ReportScheduleSummary[]>([])
  const [reports, setReports] = useState<SchedulableReportOption[]>([])
  const [groups, setGroups] = useState<ScheduleGroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ReportScheduleSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReportScheduleSummary | null>(null)

  const canSchedule = hasPermission('schedules', 'schedule')
  const canEdit = hasPermission('schedules', 'edit')
  const canDelete = hasPermission('schedules', 'delete')

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const [list, reportOptions, groupOptions] = await Promise.all([
        schedulesApi.list(accessToken),
        schedulesApi.listReports(accessToken),
        schedulesApi.listGroups(accessToken),
      ])
      setSchedules(list)
      setReports(reportOptions)
      setGroups(groupOptions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const sortedSchedules = useMemo(
    () =>
      [...schedules].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      ),
    [schedules],
  )

  async function handleCreate(data: CreateSchedulePayload) {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    try {
      await schedulesApi.create(accessToken, data)
      setFormOpen(false)
      setSuccess(
        data.recurrence === 'ONCE'
          ? 'Schedule created. Recipients will be emailed at the due time.'
          : 'Recurring schedule created. Emails will be sent on each occurrence.',
      )
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUpdate(data: CreateSchedulePayload) {
    if (!accessToken || !editing) return
    setActionLoading(true)
    setError('')
    try {
      const payload: UpdateSchedulePayload = {
        recurrence: data.recurrence,
        timeMinutes: data.timeMinutes,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        timezoneOffsetMinutes: data.timezoneOffsetMinutes,
      }
      if (data.recurrence === 'ONCE' && data.scheduledAt) {
        payload.scheduledAt = data.scheduledAt
      }
      await schedulesApi.update(accessToken, editing.id, payload)
      setEditing(null)
      setSuccess('Schedule updated.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule')
    } finally {
      setActionLoading(false)
    }
  }

  async function togglePause(schedule: ReportScheduleSummary) {
    if (!accessToken) return
    const nextStatus = schedule.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED'
    setActionLoading(true)
    setError('')
    try {
      await schedulesApi.update(accessToken, schedule.id, { status: nextStatus })
      setSuccess(nextStatus === 'PAUSED' ? 'Schedule paused.' : 'Schedule resumed.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule')
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmDelete() {
    if (!accessToken || !deleteTarget) return
    setActionLoading(true)
    setError('')
    try {
      await schedulesApi.remove(accessToken, deleteTarget.id)
      setDeleteTarget(null)
      setSuccess('Schedule deleted.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Report Schedules"
        primaryAction={
          canSchedule
            ? {
                label: 'New Schedule',
                onClick: () => {
                  setSuccess('')
                  setFormOpen(true)
                },
                icon: 'ti-plus',
              }
            : undefined
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-md border border-semantic-red/30 bg-semantic-red/10 px-4 py-3 text-sm text-semantic-red">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-semantic-green/30 bg-semantic-green/10 px-4 py-3 text-sm text-semantic-green">
            {success}
          </div>
        )}

        <Card noPadding>
          <CardHeader className="mb-0 border-b border-border p-5">
            <CardTitle>Scheduled reports</CardTitle>
            <p className="mt-1 text-sm text-text-secondary">
              Send report links by email on a one-time or recurring basis (daily, weekly, or
              monthly). 
            </p>
          </CardHeader>
          {loading ? (
            <div className="p-8 text-center text-sm text-text-secondary">Loading schedules…</div>
          ) : sortedSchedules.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              No schedules yet.
              {canSchedule && ' Create one to email a group when a report is due.'}
            </div>
          ) : (
            <DataTable
              data={sortedSchedules}
              keyExtractor={(r) => r.id}
              columns={[
                {
                  header: 'Report',
                  accessor: (r) => (
                    <div>
                      <div className="font-medium">{r.reportName}</div>
                      {r.lastError && r.status === 'FAILED' && (
                        <div className="mt-0.5 text-xs text-semantic-red">{r.lastError}</div>
                      )}
                      {r.lastError && r.status === 'COMPLETED' && (
                        <div className="mt-0.5 text-xs text-text-secondary">
                          Partial delivery: {r.lastError}
                        </div>
                      )}
                      {r.lastError && r.status === 'ACTIVE' && r.recurrence !== 'ONCE' && (
                        <div className="mt-0.5 text-xs text-text-secondary">
                          Last run warning: {r.lastError}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Frequency',
                  accessor: (r) => (
                    <span className="text-sm text-text-primary">{r.recurrenceLabel}</span>
                  ),
                },
                {
                  header: 'Recipient group',
                  accessor: (r) => (
                    <div className="text-sm">
                      <div>{r.groupName}</div>
                      <div className="text-xs text-text-secondary">
                        {r.recipientCount} member{r.recipientCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Next run',
                  accessor: (r) => (
                    <span className="text-xs text-text-secondary">
                      {r.status === 'COMPLETED' && r.recurrence === 'ONCE'
                        ? '—'
                        : formatScheduleDate(r.scheduledAt)}
                    </span>
                  ),
                },
                {
                  header: 'Last sent',
                  accessor: (r) => (
                    <span className="text-xs text-text-secondary">
                      {r.lastSentAt ? formatScheduleDate(r.lastSentAt) : '—'}
                    </span>
                  ),
                },
                {
                  header: 'Status',
                  accessor: (r) => (
                    <Badge variant={STATUS_VARIANTS[r.status]}>
                      {STATUS_LABELS[r.status]}
                    </Badge>
                  ),
                },
                {
                  header: 'Actions',
                  accessor: (r) => (
                    <div className="flex gap-2 text-text-secondary">
                      {canEdit &&
                        (r.status === 'ACTIVE' || r.status === 'PAUSED') &&
                        !isOneTimeCompleted(r) && (
                          <>
                            <button
                              type="button"
                              className="rounded-sm px-1.5 py-1 hover:text-brand-blue"
                              title="Edit schedule"
                              disabled={actionLoading}
                              onClick={() => {
                                setSuccess('')
                                setEditing(r)
                              }}
                            >
                              <i className="ti ti-pencil"></i>
                            </button>
                            <button
                              type="button"
                              className="rounded-sm px-1.5 py-1 hover:text-brand-blue"
                              title={r.status === 'PAUSED' ? 'Resume' : 'Pause'}
                              disabled={actionLoading}
                              onClick={() => void togglePause(r)}
                            >
                              <i
                                className={
                                  r.status === 'PAUSED'
                                    ? 'ti ti-player-play'
                                    : 'ti ti-player-pause'
                                }
                              ></i>
                            </button>
                          </>
                        )}
                      {canDelete && !isOneTimeCompleted(r) && (
                        <button
                          type="button"
                          className="rounded-sm px-1.5 py-1 hover:text-semantic-red"
                          title="Delete"
                          disabled={actionLoading}
                          onClick={() => setDeleteTarget(r)}
                        >
                          <i className="ti ti-trash"></i>
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <ScheduleFormModal
        open={formOpen}
        title="New report schedule"
        reports={reports}
        groups={groups}
        loading={actionLoading}
        onConfirm={handleCreate}
        onCancel={() => setFormOpen(false)}
      />

      <ScheduleFormModal
        open={Boolean(editing)}
        title="Edit schedule"
        reports={reports}
        groups={groups}
        loading={actionLoading}
        lockReportAndGroup
        initial={editing}
        onConfirm={handleUpdate}
        onCancel={() => setEditing(null)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete schedule"
        message={
          deleteTarget
            ? `Remove the schedule for "${deleteTarget.reportName}" (${deleteTarget.recurrenceLabel}) to ${deleteTarget.groupName}?`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        loading={actionLoading}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
