import type { QueryExecuteResult } from './reportBuilder'
import type { ReportCategory, ReportVisualization } from '../lib/reportConstants'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

async function reportsFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/reports${path}`, {
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

export interface SavedReportSummary {
  id: string
  name: string
  description: string | null
  category: ReportCategory
  visualization: ReportVisualization
  dataSourceId: string
  dataSourceName: string
  dataSourceDatabase: string
  createdByUsername: string | null
  updatedAt: string
  createdAt: string
}

export interface SavedReportDetail extends SavedReportSummary {
  sql: string
  dataSourceActive: boolean
}

export const reportsApi = {
  list: (
    token: string,
    params?: { search?: string; category?: ReportCategory },
  ) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.category) qs.set('category', params.category)
    const query = qs.toString()
    return reportsFetch<SavedReportSummary[]>(query ? `?${query}` : '', token)
  },

  get: (token: string, id: string) =>
    reportsFetch<SavedReportDetail>(`/${id}`, token),

  create: (
    token: string,
    data: {
      name: string
      description?: string | null
      category: ReportCategory
      sql: string
      visualization: ReportVisualization
      dataSourceId: string
    },
  ) =>
    reportsFetch<SavedReportDetail>('', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    token: string,
    id: string,
    data: {
      name?: string
      description?: string | null
      category?: ReportCategory
      sql?: string
      visualization?: ReportVisualization
      dataSourceId?: string
    },
  ) =>
    reportsFetch<SavedReportDetail>(`/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    reportsFetch<void>(`/${id}`, token, { method: 'DELETE' }),

  execute: (token: string, id: string, filters?: Record<string, string>) =>
    reportsFetch<QueryExecuteResult>(`/${id}/execute`, token, {
      method: 'POST',
      body: JSON.stringify(filters ? { filters } : {}),
    }),
}
