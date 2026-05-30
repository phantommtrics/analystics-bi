import type { DashboardLayout } from '../lib/dashboardLayout'

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
  publishedAt: string | null
  createdByUsername: string | null
  updatedAt: string
  createdAt: string
}

export interface DashboardDetail extends DashboardSummary {
  layout: DashboardLayout
}

export const dashboardsApi = {
  list: (token: string, search?: string, options?: { accessibleOnly?: boolean }) => {
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (options?.accessibleOnly) qs.set('accessibleOnly', 'true')
    const query = qs.toString()
    return dashboardsFetch<DashboardSummary[]>(query ? `?${query}` : '', token)
  },

  get: (token: string, id: string) => dashboardsFetch<DashboardDetail>(`/${id}`, token),

  create: (
    token: string,
    data: { name: string; description?: string | null; layout?: DashboardLayout },
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
