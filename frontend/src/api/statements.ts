import type { ReportCategory } from '../lib/reportConstants'
import type { StatementConfig, StatementType } from '../lib/statementConfig'
import type { SavedReportSummary } from './reports'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

async function statementsFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/statements${path}`, {
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

export interface StatementSummary {
  id: string
  name: string
  description: string | null
  type: StatementType
  category: ReportCategory
  isPublished: boolean
  publishedAt: string | null
  createdByUsername: string | null
  updatedAt: string
  createdAt: string
}

export interface StatementDetail extends StatementSummary {
  config: StatementConfig
}

export const statementsApi = {
  list: (
    token: string,
    params?: {
      search?: string
      category?: ReportCategory
      type?: StatementType
      accessibleOnly?: boolean
    },
  ) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.category) qs.set('category', params.category)
    if (params?.type) qs.set('type', params.type)
    if (params?.accessibleOnly) qs.set('accessibleOnly', 'true')
    const query = qs.toString()
    return statementsFetch<StatementSummary[]>(query ? `?${query}` : '', token)
  },

  get: (token: string, id: string) => statementsFetch<StatementDetail>(`/${id}`, token),

  getReports: (token: string, id: string) =>
    statementsFetch<SavedReportSummary[]>(`/${id}/reports`, token),

  create: (
    token: string,
    data: {
      name: string
      description?: string | null
      type: StatementType
      category?: ReportCategory
      config: StatementConfig
    },
  ) =>
    statementsFetch<StatementDetail>('', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    token: string,
    id: string,
    data: {
      name?: string
      description?: string | null
      type?: StatementType
      category?: ReportCategory
      config?: StatementConfig
    },
  ) =>
    statementsFetch<StatementDetail>(`/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    statementsFetch<void>(`/${id}`, token, { method: 'DELETE' }),

  publish: (token: string, id: string) =>
    statementsFetch<StatementDetail>(`/${id}/publish`, token, { method: 'POST' }),

  unpublish: (token: string, id: string) =>
    statementsFetch<StatementDetail>(`/${id}/unpublish`, token, { method: 'POST' }),

  export: async (
    token: string,
    id: string,
    format: 'pdf' | 'csv',
    params?: { filters?: Record<string, string>; filterLabel?: string },
  ) => {
    const qs = new URLSearchParams({ format })
    if (params?.filterLabel) qs.set('filterLabel', params.filterLabel)
    if (params?.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        qs.set(key, value)
      }
    }
    const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'
    const response = await fetch(`${API_BASE}/statements/${id}/export?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { message?: string }).message ?? 'Export failed')
    }
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const match = disposition.match(/filename="([^"]+)"/)
    return { blob, filename: match?.[1] ?? `statement.${format}` }
  },
}
