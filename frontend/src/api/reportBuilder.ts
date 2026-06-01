const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

export interface QueryExecuteResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  latencyMs: number
  truncated: boolean
}

async function reportBuilderFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/report-builder${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((body as { message?: string }).message ?? 'Request failed')
  }
  return body as T
}

export const reportBuilderApi = {
  executeQuery: (
    token: string,
    data: { dataSourceId: string; sql: string; filters?: Record<string, string> },
  ) =>
    reportBuilderFetch<QueryExecuteResult>('/execute', token, {
      method: 'POST',
      body: JSON.stringify({
        dataSourceId: data.dataSourceId,
        sql: data.sql,
        filters: data.filters ?? {},
      }),
    }),
}
