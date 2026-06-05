import type { ReportScheduleRecurrence } from '../lib/scheduleRecurrence'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

async function schedulesFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/schedules${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Request failed')
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}

export type ReportScheduleStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED'

export interface ReportScheduleSummary {
  id: string
  reportId: string
  reportName: string
  groupId: string
  groupName: string
  recipientCount: number
  recurrence: ReportScheduleRecurrence
  recurrenceLabel: string
  scheduledAt: string
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezoneOffsetMinutes: number
  status: ReportScheduleStatus
  lastSentAt: string | null
  lastError: string | null
  createdByUsername: string | null
  createdAt: string
  updatedAt: string
}

export interface SchedulableReportOption {
  id: string
  name: string
  category: string
  updatedAt: string
}

export interface ScheduleGroupOption {
  id: string
  name: string
  description: string | null
  memberCount: number
}

export interface CreateSchedulePayload {
  reportId: string
  groupId: string
  recurrence: ReportScheduleRecurrence
  scheduledAt?: string
  timeMinutes?: number
  dayOfWeek?: number
  dayOfMonth?: number
  timezoneOffsetMinutes: number
}

export interface UpdateSchedulePayload {
  scheduledAt?: string
  status?: 'ACTIVE' | 'PAUSED'
  recurrence?: ReportScheduleRecurrence
  timeMinutes?: number
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  timezoneOffsetMinutes?: number
}

export interface StatementScheduleSummary {
  id: string
  statementId: string
  statementName: string
  groupId: string
  groupName: string
  recipientCount: number
  recurrence: ReportScheduleRecurrence
  recurrenceLabel: string
  scheduledAt: string
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezoneOffsetMinutes: number
  status: ReportScheduleStatus
  lastSentAt: string | null
  lastError: string | null
  createdByUsername: string | null
  createdAt: string
  updatedAt: string
}

export interface SchedulableStatementOption {
  id: string
  name: string
  type: string
  category: string
  updatedAt: string
}

export interface CreateStatementSchedulePayload {
  statementId: string
  groupId: string
  recurrence: ReportScheduleRecurrence
  scheduledAt?: string
  timeMinutes?: number
  dayOfWeek?: number
  dayOfMonth?: number
  timezoneOffsetMinutes: number
}

export const schedulesApi = {
  list: (token: string) =>
    schedulesFetch<ReportScheduleSummary[]>('/', token),

  listReports: (token: string) =>
    schedulesFetch<SchedulableReportOption[]>('/reports', token),

  listStatementSchedules: (token: string) =>
    schedulesFetch<StatementScheduleSummary[]>('/statements', token),

  listStatementOptions: (token: string) =>
    schedulesFetch<SchedulableStatementOption[]>('/statement-options', token),

  listGroups: (token: string) =>
    schedulesFetch<ScheduleGroupOption[]>('/groups', token),

  create: (token: string, data: CreateSchedulePayload) =>
    schedulesFetch<ReportScheduleSummary>('/', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createStatement: (token: string, data: CreateStatementSchedulePayload) =>
    schedulesFetch<StatementScheduleSummary>('/statements', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: UpdateSchedulePayload) =>
    schedulesFetch<ReportScheduleSummary>(`/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatement: (token: string, id: string, data: UpdateSchedulePayload) =>
    schedulesFetch<StatementScheduleSummary>(`/statements/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  remove: (token: string, id: string) =>
    schedulesFetch<void>(`/${id}`, token, { method: 'DELETE' }),

  removeStatement: (token: string, id: string) =>
    schedulesFetch<void>(`/statements/${id}`, token, { method: 'DELETE' }),
}
