import { apiFetch } from './client'

async function datasourcesFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  return apiFetch<T>(`/admin/datasources${path}`, accessToken, options)
}

export interface DataSourceSummary {
  id: string
  name: string
  type: 'POSTGRES'
  host: string
  port: number
  database: string
  username: string
  sslMode: 'DISABLE' | 'REQUIRE'
  isActive: boolean
  organizationId: string
  organizationName: string
  createdAt: string
  updatedAt: string
}

export interface TestConnectionResult {
  ok: boolean
  latencyMs?: number
  message?: string
}

export const datasourcesApi = {
  list: (token: string, activeOnly = false, organizationId?: string) => {
    const params = new URLSearchParams()
    if (activeOnly) params.set('active', 'true')
    if (organizationId) params.set('organizationId', organizationId)
    const query = params.toString()
    return datasourcesFetch<DataSourceSummary[]>(query ? `?${query}` : '', token)
  },

  create: (
    token: string,
    data: {
      name: string
      host: string
      port: number
      database: string
      username: string
      password: string
      sslMode: 'DISABLE' | 'REQUIRE'
      isActive?: boolean
      organizationId?: string
    },
  ) =>
    datasourcesFetch<DataSourceSummary>('', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    token: string,
    id: string,
    data: {
      name?: string
      host?: string
      port?: number
      database?: string
      username?: string
      password?: string
      sslMode?: 'DISABLE' | 'REQUIRE'
      isActive?: boolean
    },
  ) =>
    datasourcesFetch<DataSourceSummary>(`/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    datasourcesFetch<void>(`/${id}`, token, { method: 'DELETE' }),

  test: (token: string, id: string) =>
    datasourcesFetch<TestConnectionResult>(`/${id}/test`, token, {
      method: 'POST',
    }),
}
