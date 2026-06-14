import type { Request } from 'express'

/** Organization filter for tenant-scoped queries. Owner without org sees nothing tenant-scoped. */
export function organizationWhere(req: Request): { organizationId?: string } {
  const authUser = req.authUser
  if (!authUser) return {}
  if (authUser.organizationId) {
    return { organizationId: authUser.organizationId }
  }
  return {}
}

export function requireOrganizationId(req: Request): string | null {
  return req.authUser?.organizationId ?? null
}
