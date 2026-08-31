import { apiFetch } from './client'

export interface QueryExecuteResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  matchedRowCount?: number
  latencyMs: number
  truncated: boolean
  maxRows?: number
}

export interface SchemaTable {
  schema: string
  name: string
  qualifiedName: string
}

export interface SchemaColumn {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
}

async function reportBuilderFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  return apiFetch<T>(`/report-builder${path}`, accessToken, options)
}

export const reportBuilderApi = {
  listTables: (token: string, dataSourceId: string, search = '') => {
    const qs = new URLSearchParams({ dataSourceId })
    if (search.trim()) qs.set('search', search.trim())
    return reportBuilderFetch<SchemaTable[]>(`/schema/tables?${qs.toString()}`, token)
  },

  getTableColumns: (
    token: string,
    dataSourceId: string,
    schema: string,
    table: string,
  ) => {
    const qs = new URLSearchParams({ dataSourceId, schema, table })
    return reportBuilderFetch<SchemaColumn[]>(`/schema/columns?${qs.toString()}`, token)
  },

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
