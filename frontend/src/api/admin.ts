const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

async function adminFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/admin${path}`, {
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

export interface Permission {
  id: string
  moduleKey: string
  actionKey: string
  name: string
}

export interface PermissionsCatalog {
  modules: string[]
  actions: string[]
  moduleActions: Record<string, string[]>
  permissions: Permission[]
}

export interface RoleSummary {
  id: string
  name: string
  description: string | null
  userCount: number
  permissionCount: number
}

export interface RoleDetail extends RoleSummary {
  permissionIds: string[]
  permissions: Permission[]
}

export interface GroupSummary {
  id: string
  name: string
  description: string | null
  roleId: string
  role: { id: string; name: string }
  memberCount: number
}

export interface GroupDetail extends GroupSummary {}

export interface OperatorSummary {
  id: string
  username: string
  email: string
  displayName: string | null
  status: 'ACTIVE' | 'DISABLED'
  mustChangePassword: boolean
  lastLoginAt: string | null
  roles: { id: string; name: string }[]
  groups: { id: string; name: string }[]
}

export const adminApi = {
  getPermissionsCatalog: (token: string) =>
    adminFetch<PermissionsCatalog>('/roles/permissions', token),

  listRoles: (token: string) => adminFetch<RoleSummary[]>('/roles', token),

  getRole: (token: string, id: string) =>
    adminFetch<RoleDetail>(`/roles/${id}`, token),

  createRole: (token: string, data: { name: string; description?: string }) =>
    adminFetch<{ id: string }>('/roles', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRole: (
    token: string,
    id: string,
    data: { name?: string; description?: string | null },
  ) =>
    adminFetch(`/roles/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  setRolePermissions: (token: string, id: string, permissionIds: string[]) =>
    adminFetch(`/roles/${id}/permissions`, token, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds }),
    }),

  deleteRole: (token: string, id: string) =>
    adminFetch<void>(`/roles/${id}`, token, { method: 'DELETE' }),

  listGroups: (token: string) => adminFetch<GroupSummary[]>('/groups', token),

  getGroup: (token: string, id: string) =>
    adminFetch<GroupDetail>(`/groups/${id}`, token),

  createGroup: (
    token: string,
    data: { name: string; description?: string; roleId: string },
  ) =>
    adminFetch<GroupSummary>('/groups', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateGroup: (
    token: string,
    id: string,
    data: { name?: string; description?: string | null; roleId?: string },
  ) =>
    adminFetch<GroupSummary>(`/groups/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteGroup: (token: string, id: string) =>
    adminFetch<void>(`/groups/${id}`, token, { method: 'DELETE' }),

  listOperators: (token: string) =>
    adminFetch<OperatorSummary[]>('/operators', token),

  createOperator: (
    token: string,
    data: {
      username: string
      email: string
      displayName?: string
      groupIds: string[]
    },
  ) =>
    adminFetch<OperatorSummary>('/operators', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateOperator: (
    token: string,
    id: string,
    data: {
      displayName?: string | null
      groupIds?: string[]
      status?: 'ACTIVE' | 'DISABLED'
    },
  ) =>
    adminFetch<OperatorSummary>(`/operators/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  resendInvite: (token: string, id: string) =>
    adminFetch<{ message: string; emailWarning?: string }>(
      `/operators/${id}/resend-invite`,
      token,
      { method: 'POST' },
    ),

  resetPassword: (token: string, id: string) =>
    adminFetch<{ message: string; emailWarning?: string }>(
      `/operators/${id}/reset-password`,
      token,
      { method: 'POST' },
    ),

  disableOperator: (token: string, id: string) =>
    adminFetch<OperatorSummary>(`/operators/${id}/disable`, token, {
      method: 'POST',
    }),

  enableOperator: (token: string, id: string) =>
    adminFetch<OperatorSummary>(`/operators/${id}/enable`, token, {
      method: 'POST',
    }),
}
