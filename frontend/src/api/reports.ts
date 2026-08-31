import type { QueryExecuteResult } from './reportBuilder'
import type { ReportCategory, ReportVisualization } from '../lib/reportConstants'
import { apiFetch } from './client'

async function reportsFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  return apiFetch<T>(`/reports${path}`, accessToken, options)
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
  isPublished: boolean
  showInSidebarMenu: boolean
  publishedAt: string | null
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
    params?: {
      search?: string
      category?: ReportCategory
      accessibleOnly?: boolean
      sidebarMenuOnly?: boolean
    },
  ) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.category) qs.set('category', params.category)
    if (params?.accessibleOnly) qs.set('accessibleOnly', 'true')
    if (params?.sidebarMenuOnly) qs.set('sidebarMenuOnly', 'true')
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
      showInSidebarMenu?: boolean
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
      showInSidebarMenu?: boolean
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

  publish: (token: string, id: string) =>
    reportsFetch<SavedReportDetail>(`/${id}/publish`, token, { method: 'POST' }),

  unpublish: (token: string, id: string) =>
    reportsFetch<SavedReportDetail>(`/${id}/unpublish`, token, { method: 'POST' }),

  execute: (
    token: string,
    id: string,
    filters?: Record<string, string>,
    options?: { dashboardId?: string; statementId?: string },
  ) =>
    reportsFetch<QueryExecuteResult>(`/${id}/execute`, token, {
      method: 'POST',
      body: JSON.stringify({
        filters: filters ?? {},
        ...(options?.dashboardId ? { dashboardId: options.dashboardId } : {}),
        ...(options?.statementId ? { statementId: options.statementId } : {}),
      }),
    }),
}
