import type { Request } from 'express'
import { UserType } from '@prisma/client'
import { prisma } from '../prisma.js'

let cachedDefaultOrgId: string | null | undefined

export function invalidateOrganizationCache() {
  cachedDefaultOrgId = undefined
}

async function getDefaultOrganizationId(): Promise<string | null> {
  if (cachedDefaultOrgId !== undefined) return cachedDefaultOrgId
  const org = await prisma.organization.findFirst({
    where: { isDefault: true },
    select: { id: true },
  })
  if (org) {
    cachedDefaultOrgId = org.id
    return org.id
  }
  const fallback = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  cachedDefaultOrgId = fallback?.id ?? null
  return cachedDefaultOrgId
}

function explicitOrganizationIdFromRequest(req: Request): string | undefined {
  const header = req.headers['x-organization-id']
  if (typeof header === 'string' && header.trim()) return header.trim()
  const query = req.query.organizationId
  if (typeof query === 'string' && query.trim()) return query.trim()
  return undefined
}

async function validateOrganizationId(id: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true },
  })
  return org?.id ?? null
}

/**
 * Resolve the tenant org for creates and scoped actions.
 * Owner: explicit org (header/query/body) → user org → default org.
 * System user: their assigned org only.
 */
export async function resolveOrganizationId(
  req: Request,
  explicitOrganizationId?: string | null,
): Promise<string | null> {
  const authUser = req.authUser
  if (!authUser) return null

  const explicit =
    explicitOrganizationId?.trim() ||
    explicitOrganizationIdFromRequest(req) ||
    undefined

  if (authUser.userType === UserType.OWNER) {
    if (explicit) return validateOrganizationId(explicit)
    if (authUser.organizationId) return authUser.organizationId
    return getDefaultOrganizationId()
  }

  if (explicit && explicit !== authUser.organizationId) {
    return null
  }
  return authUser.organizationId
}

/** Filter for tenant-scoped list queries. Owner without filter sees all orgs. */
export async function organizationListWhere(
  req: Request,
): Promise<{ organizationId?: string }> {
  const authUser = req.authUser
  if (!authUser) return {}

  const explicit = explicitOrganizationIdFromRequest(req)
  if (explicit) {
    const valid = await validateOrganizationId(explicit)
    return valid ? { organizationId: valid } : {}
  }

  if (authUser.userType === UserType.OWNER) {
    return {}
  }

  if (authUser.organizationId) {
    return { organizationId: authUser.organizationId }
  }
  return {}
}

/** Filter for tenant-scoped creates/lists that should always target one org. */
export async function organizationWhere(req: Request): Promise<{ organizationId?: string }> {
  const organizationId = await resolveOrganizationId(req)
  if (organizationId) return { organizationId }
  return {}
}
