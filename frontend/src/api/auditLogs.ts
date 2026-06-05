const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

export type AuditLogEntry = {
  id: string
  timestamp: string
  userId: string | null
  user: string
  action: string
  resource: string | null
  ip: string | null
}

export type AuditLogFilters = {
  dateFrom?: string
  dateTo?: string
  user?: string
  action?: string
}

export type AuditLogListResponse = {
  items: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const AUDIT_PAGE_SIZE = 50

function buildQuery(filters: AuditLogFilters, page?: number, pageSize?: number): string {
  const params = new URLSearchParams()
  params.set('tzOffset', String(new Date().getTimezoneOffset()))
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.user?.trim()) params.set('user', filters.user.trim())
  if (filters.action?.trim()) params.set('action', filters.action.trim())
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function auditFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/audit-logs${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Request failed')
  }
  return response.json()
}

export const auditLogsApi = {
  list: (accessToken: string, filters: AuditLogFilters, page = 1) =>
    auditFetch<AuditLogListResponse>(
      buildQuery(filters, page, AUDIT_PAGE_SIZE),
      accessToken,
    ),

  listActions: (accessToken: string) =>
    auditFetch<{ actions: string[] }>('/actions', accessToken),

  exportCsv: async (accessToken: string, filters: AuditLogFilters) => {
    const response = await fetch(
      `${API_BASE}/audit-logs/export${buildQuery(filters)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { message?: string }).message ?? 'Export failed')
    }
    const blob = await response.blob()
    const stamp = new Date().toISOString().slice(0, 10)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `audit-log-${stamp}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  },
}
