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
  scheduledAt: string
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

export const schedulesApi = {
  list: (token: string) =>
    schedulesFetch<ReportScheduleSummary[]>('/', token),

  listReports: (token: string) =>
    schedulesFetch<SchedulableReportOption[]>('/reports', token),

  listGroups: (token: string) =>
    schedulesFetch<ScheduleGroupOption[]>('/groups', token),

  create: (
    token: string,
    data: { reportId: string; groupId: string; scheduledAt: string },
  ) =>
    schedulesFetch<ReportScheduleSummary>('/', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    token: string,
    id: string,
    data: { scheduledAt?: string; status?: 'ACTIVE' | 'PAUSED' },
  ) =>
    schedulesFetch<ReportScheduleSummary>(`/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  remove: (token: string, id: string) =>
    schedulesFetch<void>(`/${id}`, token, { method: 'DELETE' }),
}
