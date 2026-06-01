import type { DashboardLayout } from '../lib/dashboardLayout'
import type { ReportCategory } from '../lib/reportConstants'
import type { SavedReportSummary } from './reports'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

async function dashboardsFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/dashboards${path}`, {
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

export interface DashboardSummary {
  id: string
  name: string
  description: string | null
  widgetCount: number
  isPublished: boolean
  showInSidebarMenu: boolean
  sidebarCategory: ReportCategory | null
  publishedAt: string | null
  createdByUsername: string | null
  updatedAt: string
  createdAt: string
}

export interface DashboardDetail extends DashboardSummary {
  layout: DashboardLayout
}

export const dashboardsApi = {
  list: (
    token: string,
    search?: string,
    options?: { accessibleOnly?: boolean; sidebarMenuOnly?: boolean },
  ) => {
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (options?.accessibleOnly) qs.set('accessibleOnly', 'true')
    if (options?.sidebarMenuOnly) qs.set('sidebarMenuOnly', 'true')
    const query = qs.toString()
    return dashboardsFetch<DashboardSummary[]>(query ? `?${query}` : '', token)
  },

  get: (token: string, id: string) => dashboardsFetch<DashboardDetail>(`/${id}`, token),

  getReports: (token: string, id: string) =>
    dashboardsFetch<SavedReportSummary[]>(`/${id}/reports`, token),

  create: (
    token: string,
    data: {
      name: string
      description?: string | null
      layout?: DashboardLayout
      showInSidebarMenu?: boolean
      sidebarCategory?: ReportCategory | null
    },
  ) =>
    dashboardsFetch<DashboardDetail>('', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    token: string,
    id: string,
    data: {
      name?: string
      description?: string | null
      layout?: DashboardLayout
      showInSidebarMenu?: boolean
      sidebarCategory?: ReportCategory | null
    },
  ) =>
    dashboardsFetch<DashboardDetail>(`/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    dashboardsFetch<void>(`/${id}`, token, { method: 'DELETE' }),

  publish: (token: string, id: string) =>
    dashboardsFetch<DashboardDetail>(`/${id}/publish`, token, { method: 'POST' }),

  unpublish: (token: string, id: string) =>
    dashboardsFetch<DashboardDetail>(`/${id}/unpublish`, token, { method: 'POST' }),
}
