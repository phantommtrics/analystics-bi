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
  organizationId: string | null
  organizationName: string | null
  userCount: number
  groupCount?: number
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
  organizationId: string
  organizationName: string
  memberCount: number
}

export interface GroupMember {
  id: string
  username: string
  email: string
  displayName: string | null
  status: string
}

export interface GroupDetail extends GroupSummary {
  members?: GroupMember[]
}

export interface OperatorSummary {
  id: string
  username: string
  email: string
  displayName: string | null
  status: 'ACTIVE' | 'DISABLED'
  mustChangePassword: boolean
  lastLoginAt: string | null
  organizationId: string | null
  organizationName: string | null
  roles: { id: string; name: string }[]
  groups: { id: string; name: string }[]
}

export const adminApi = {
  getPermissionsCatalog: (token: string) =>
    adminFetch<PermissionsCatalog>('/roles/permissions', token),

  listRoles: (token: string, organizationId?: string) =>
    adminFetch<RoleSummary[]>(
      organizationId ? `/roles?organizationId=${encodeURIComponent(organizationId)}` : '/roles',
      token,
    ),

  getRole: (token: string, id: string) =>
    adminFetch<RoleDetail>(`/roles/${id}`, token),

  createRole: (
    token: string,
    data: { name: string; description?: string; organizationId?: string },
  ) =>
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

  listGroups: (token: string, organizationId?: string) =>
    adminFetch<GroupSummary[]>(
      organizationId ? `/groups?organizationId=${encodeURIComponent(organizationId)}` : '/groups',
      token,
    ),

  getGroup: (token: string, id: string) =>
    adminFetch<GroupDetail>(`/groups/${id}`, token),

  createGroup: (
    token: string,
    data: { name: string; description?: string; roleId: string; organizationId?: string },
  ) =>
    adminFetch<GroupSummary>('/groups', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateGroup: (
    token: string,
    id: string,
    data: {
      name?: string
      description?: string | null
      roleId?: string
      memberIds?: string[]
    },
  ) =>
    adminFetch<GroupDetail>(`/groups/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteGroup: (token: string, id: string) =>
    adminFetch<void>(`/groups/${id}`, token, { method: 'DELETE' }),

  listOperators: (token: string, organizationId?: string) =>
    adminFetch<OperatorSummary[]>(
      organizationId
        ? `/operators?organizationId=${encodeURIComponent(organizationId)}`
        : '/operators',
      token,
    ),

  createOperator: (
    token: string,
    data: {
      username: string
      email: string
      displayName?: string
      groupIds: string[]
      organizationId?: string
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

  listOrganizations: (token: string) =>
    adminFetch<OrganizationSummary[]>('/organizations', token),

  createOrganization: (
    token: string,
    body: {
      name: string
      slug?: string
      industry?: string
      billingOwnerEmail: string
      billingOwnerName: string
      isDefault?: boolean
    },
  ) =>
    adminFetch<OrganizationSummary>('/organizations', token, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateOrganization: (
    token: string,
    orgId: string,
    body: {
      name?: string
      slug?: string
      industry?: string | null
      billingOwnerEmail?: string
      billingOwnerName?: string
      isDefault?: boolean
    },
  ) =>
    adminFetch<OrganizationSummary>(`/organizations/${orgId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  provisionDirectPay: (token: string, orgId: string) =>
    adminFetch<{ ok: boolean; businessId: string; slug: string }>(
      `/organizations/${orgId}/directpay/provision`,
      token,
      { method: 'POST' },
    ),

  startDirectPaySubscription: (token: string, orgId: string) =>
    adminFetch<{ subscription: OrganizationSubscription }>(
      `/organizations/${orgId}/directpay/subscription`,
      token,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  syncDirectPaySubscription: (token: string, orgId: string) =>
    adminFetch<{ subscription: OrganizationSubscription }>(
      `/organizations/${orgId}/directpay/sync`,
      token,
      { method: 'POST' },
    ),

  payInDirectPay: (token: string, orgId: string) =>
    adminFetch<{
      payUrl: string
      pendingInvoice: {
        id: string
        amount: string
        currency: string
        status: string
        dueDate: string
        guestToken: string | null
      }
      subscription: OrganizationSubscription
      invoiceCreated: boolean
      billing: OrganizationBillingInfo
    }>(`/organizations/${orgId}/directpay/pay-in-directpay`, token, { method: 'POST' }),
}

export interface OrganizationBillingInfo {
  assigned: boolean
  message?: 'No billing is assigned'
  templateId?: string
  templateName?: string
  billingInterval?: string
  currency?: string
  amount?: string
  prices?: {
    monthly: string
    quarterly: string
    halfYearly: string
    yearly: string
    twoYears: string
    contract: string
  }
}

export interface OrganizationSubscription {
  status: string | null
  planCode: string | null
  periodEnd: string | null
  payUrl: string | null
  accessAllowed: boolean
  billing: OrganizationBillingInfo
}

export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  industry: string | null
  status: string
  isDefault: boolean
  billingOwnerEmail: string | null
  billingOwnerName: string | null
  directPayBusinessId: string | null
  directPaySlug: string | null
  userCount: number
  subscription: OrganizationSubscription & { syncedAt: string | null }
}
