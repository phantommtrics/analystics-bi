export const PARTNER_FLOAT_SCHEMA_VERSION = 2 as const

export type PartnerFloatOrganizationContext = {
  id: string
  partnerOrgCode: string
}

export type PartnerFloatOrganizationWire = {
  id: string
  partner_org_code: string
}

export function organizationToWire(
  organization: PartnerFloatOrganizationContext,
): PartnerFloatOrganizationWire {
  return {
    id: organization.id,
    partner_org_code: organization.partnerOrgCode,
  }
}

export type PartnerAgentFloatRuntimeConfig = {
  enabled: boolean
  intervalMs: number
  apiUrl: string
  apiKey: string
  hmacSecret: string
  encryptionKey: string
  requestTimeoutMs: number
  configured: boolean
  organization: PartnerFloatOrganizationContext
}

const PARTNER_ORG_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/

export function normalizePartnerOrgCode(code: string): string {
  const trimmed = code.trim()
  if (!PARTNER_ORG_CODE_RE.test(trimmed)) {
    throw new Error(
      'Partner org code must be 3–64 characters (letters, numbers, hyphens, underscores)',
    )
  }
  return trimmed
}

export function maskApiUrl(url: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.length > 20 ? `${parsed.pathname.slice(0, 20)}…` : parsed.pathname}`
  } catch {
    return url.length > 24 ? `${url.slice(0, 24)}…` : url
  }
}
