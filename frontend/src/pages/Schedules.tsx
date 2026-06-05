import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import {
  ScheduleFormModal,
  type ScheduleFormSubmit,
  type ScheduleKind,
} from '../components/schedules/ScheduleFormModal'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { DataTable } from '../components/ui/DataTable'
import {
  schedulesApi,
  type ReportScheduleSummary,
  type ReportScheduleStatus,
  type ScheduleGroupOption,
  type SchedulableReportOption,
  type SchedulableStatementOption,
  type StatementScheduleSummary,
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

const KIND_LABELS: Record<ScheduleKind, string> = {
  report: 'Report',
  statement: 'Statement',
}

type UnifiedScheduleRow =
  | ({ kind: 'report' } & ReportScheduleSummary)
  | ({ kind: 'statement' } & StatementScheduleSummary)

function formatScheduleDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function isOneTimeCompleted(schedule: { recurrence: string; status: string }) {
  return schedule.recurrence === 'ONCE' && schedule.status === 'COMPLETED'
}

function scheduleTargetName(row: UnifiedScheduleRow) {
  return row.kind === 'report' ? row.reportName : row.statementName
}

function scheduleRowKey(row: UnifiedScheduleRow) {
  return `${row.kind}:${row.id}`
}

export function Schedules() {
  const { accessToken, hasPermission } = useAuth()
  const [schedules, setSchedules] = useState<ReportScheduleSummary[]>([])
  const [statementSchedules, setStatementSchedules] = useState<StatementScheduleSummary[]>([])
  const [reports, setReports] = useState<SchedulableReportOption[]>([])
  const [statements, setStatements] = useState<SchedulableStatementOption[]>([])
  const [groups, setGroups] = useState<ScheduleGroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UnifiedScheduleRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UnifiedScheduleRow | null>(null)

  const canSchedule = hasPermission('schedules', 'schedule')
  const canEdit = hasPermission('schedules', 'edit')
  const canDelete = hasPermission('schedules', 'delete')

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const [list, statementList, reportOptions, statementOptions, groupOptions] =
        await Promise.all([
          schedulesApi.list(accessToken),
          schedulesApi.listStatementSchedules(accessToken),
          schedulesApi.listReports(accessToken),
          schedulesApi.listStatementOptions(accessToken),
          schedulesApi.listGroups(accessToken),
        ])
      setSchedules(list)
      setStatementSchedules(statementList)
      setReports(reportOptions)
      setStatements(statementOptions)
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

  const allSchedules = useMemo<UnifiedScheduleRow[]>(
    () => [
      ...schedules.map((s) => ({ kind: 'report' as const, ...s })),
      ...statementSchedules.map((s) => ({ kind: 'statement' as const, ...s })),
    ].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    ),
    [schedules, statementSchedules],
  )

  async function handleCreate(payload: ScheduleFormSubmit) {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    try {
      if (payload.kind === 'report') {
        await schedulesApi.create(accessToken, payload.data)
      } else {
        await schedulesApi.createStatement(accessToken, payload.data)
      }
      setFormOpen(false)
      setSuccess(
        payload.data.recurrence === 'ONCE'
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

  async function handleUpdate(payload: ScheduleFormSubmit) {
    if (!accessToken || !editing) return
    setActionLoading(true)
    setError('')
    try {
      const updatePayload: UpdateSchedulePayload = {
        recurrence: payload.data.recurrence,
        timeMinutes: payload.data.timeMinutes,
        dayOfWeek: payload.data.dayOfWeek,
        dayOfMonth: payload.data.dayOfMonth,
        timezoneOffsetMinutes: payload.data.timezoneOffsetMinutes,
      }
      if (payload.data.recurrence === 'ONCE' && payload.data.scheduledAt) {
        updatePayload.scheduledAt = payload.data.scheduledAt
      }

      if (editing.kind === 'report') {
        await schedulesApi.update(accessToken, editing.id, updatePayload)
      } else {
        await schedulesApi.updateStatement(accessToken, editing.id, updatePayload)
      }

      setEditing(null)
      setSuccess('Schedule updated.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule')
    } finally {
      setActionLoading(false)
    }
  }

  async function togglePause(schedule: UnifiedScheduleRow) {
    if (!accessToken) return
    const nextStatus = schedule.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED'
    setActionLoading(true)
    setError('')
    try {
      if (schedule.kind === 'report') {
        await schedulesApi.update(accessToken, schedule.id, { status: nextStatus })
      } else {
        await schedulesApi.updateStatement(accessToken, schedule.id, { status: nextStatus })
      }
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
      if (deleteTarget.kind === 'report') {
        await schedulesApi.remove(accessToken, deleteTarget.id)
      } else {
        await schedulesApi.removeStatement(accessToken, deleteTarget.id)
      }
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
        title="Schedules"
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
            <CardTitle>Scheduled deliveries</CardTitle>
            <p className="mt-1 text-sm text-text-secondary">
              Send reports or statements by email on a one-time or recurring basis (daily, weekly,
              or monthly).
            </p>
          </CardHeader>
          {loading ? (
            <div className="p-8 text-center text-sm text-text-secondary">Loading schedules…</div>
          ) : allSchedules.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              No schedules yet.
              {canSchedule && ' Create one to email a group when a report or statement is due.'}
            </div>
          ) : (
            <DataTable
              data={allSchedules}
              keyExtractor={scheduleRowKey}
              columns={[
                {
                  header: 'Type',
                  accessor: (r) => (
                    <Badge variant={r.kind === 'report' ? 'blue' : 'purple'}>
                      {KIND_LABELS[r.kind]}
                    </Badge>
                  ),
                },
                {
                  header: 'Name',
                  accessor: (r) => (
                    <div>
                      <div className="font-medium">{scheduleTargetName(r)}</div>
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
        title="New schedule"
        reports={reports}
        statements={statements}
        groups={groups}
        loading={actionLoading}
        onConfirm={handleCreate}
        onCancel={() => setFormOpen(false)}
      />

      <ScheduleFormModal
        open={Boolean(editing)}
        title="Edit schedule"
        reports={reports}
        statements={statements}
        groups={groups}
        loading={actionLoading}
        initial={editing}
        onConfirm={handleUpdate}
        onCancel={() => setEditing(null)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete schedule"
        message={
          deleteTarget
            ? `Remove the ${KIND_LABELS[deleteTarget.kind].toLowerCase()} schedule for "${scheduleTargetName(deleteTarget)}" (${deleteTarget.recurrenceLabel}) to ${deleteTarget.groupName}?`
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
