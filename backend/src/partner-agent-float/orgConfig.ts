import type { OrganizationPartnerAgentFloat } from '@prisma/client'
import { decrypt, encrypt } from '../datasources/crypto.js'
import { prisma } from '../prisma.js'
import { maskApiUrl, normalizePartnerOrgCode, type PartnerAgentFloatRuntimeConfig, type PartnerFloatOrganizationContext } from './config.js'

const MIN_INTERVAL_MS = 60_000
const MAX_INTERVAL_MS = 86_400_000
const MIN_TIMEOUT_MS = 5_000
const MAX_TIMEOUT_MS = 300_000

export type PartnerAgentFloatPublicConfig = {
  organizationId: string
  organizationName: string
  partnerOrgCode: string
  hasIntegration: boolean
  enabled: boolean
  configured: boolean
  intervalMs: number
  requestTimeoutMs: number
  apiUrl: string
  apiUrlMasked: string
  keysConfigured: {
    apiKey: boolean
    hmacSecret: boolean
    encryptionKey: boolean
  }
}

export type UpdatePartnerAgentFloatConfigInput = {
  enabled?: boolean
  apiUrl?: string
  partnerOrgCode?: string
  intervalMs?: number
  requestTimeoutMs?: number
  apiKey?: string
  hmacSecret?: string
  encryptionKey?: string
}

function isRecordConfigured(record: OrganizationPartnerAgentFloat): boolean {
  return Boolean(
    record.apiUrl?.trim() &&
      record.partnerOrgCode?.trim() &&
      record.apiKeyEncrypted &&
      record.hmacSecretEncrypted &&
      record.encryptionKeyEncrypted,
  )
}

export function buildOrganizationContext(
  org: { id: string },
  partnerOrgCode: string | null | undefined,
): PartnerFloatOrganizationContext {
  if (!partnerOrgCode?.trim()) {
    throw new Error('Partner org code is not configured')
  }
  return {
    id: org.id,
    partnerOrgCode: normalizePartnerOrgCode(partnerOrgCode),
  }
}

type OrgPartnerRecord = OrganizationPartnerAgentFloat & {
  organization: { id: string; name: string }
}

function toOrganizationContext(record: OrgPartnerRecord): PartnerFloatOrganizationContext {
  return buildOrganizationContext(record.organization, record.partnerOrgCode)
}

export function toRuntimeConfig(record: OrgPartnerRecord): PartnerAgentFloatRuntimeConfig {
  const apiUrl = (record.apiUrl || '').trim().replace(/\/$/, '')
  const apiKey = record.apiKeyEncrypted ? decrypt(record.apiKeyEncrypted) : ''
  const hmacSecret = record.hmacSecretEncrypted ? decrypt(record.hmacSecretEncrypted) : ''
  const encryptionKey = record.encryptionKeyEncrypted
    ? decrypt(record.encryptionKeyEncrypted)
    : ''

  return {
    enabled: record.enabled,
    intervalMs: record.intervalMs,
    apiUrl,
    apiKey,
    hmacSecret,
    encryptionKey,
    requestTimeoutMs: record.requestTimeoutMs,
    configured: isRecordConfigured(record),
    organization: toOrganizationContext(record),
  }
}

export async function getOrgPartnerAgentFloatRecord(organizationId: string) {
  return prisma.organizationPartnerAgentFloat.findUnique({
    where: { organizationId },
    include: { organization: { select: { id: true, name: true } } },
  })
}

export async function getOrgPartnerAgentFloatRuntimeConfig(
  organizationId: string,
): Promise<PartnerAgentFloatRuntimeConfig | null> {
  const record = await getOrgPartnerAgentFloatRecord(organizationId)
  if (!record) return null
  return toRuntimeConfig(record)
}

export async function getOrgPartnerAgentFloatPublicConfig(
  organizationId: string,
): Promise<PartnerAgentFloatPublicConfig | null> {
  const record = await prisma.organizationPartnerAgentFloat.findUnique({
    where: { organizationId },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!record) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    })
    if (!org) return null
    return {
      organizationId: org.id,
      organizationName: org.name,
      partnerOrgCode: '',
      hasIntegration: false,
      enabled: false,
      configured: false,
      intervalMs: 300_000,
      requestTimeoutMs: 30_000,
      apiUrl: '',
      apiUrlMasked: '',
      keysConfigured: {
        apiKey: false,
        hmacSecret: false,
        encryptionKey: false,
      },
    }
  }

  return {
    organizationId: record.organizationId,
    organizationName: record.organization.name,
    partnerOrgCode: record.partnerOrgCode?.trim() ?? '',
    hasIntegration: true,
    enabled: record.enabled,
    configured: isRecordConfigured(record),
    intervalMs: record.intervalMs,
    requestTimeoutMs: record.requestTimeoutMs,
    apiUrl: record.apiUrl?.trim() ?? '',
    apiUrlMasked: maskApiUrl(record.apiUrl?.trim() ?? ''),
    keysConfigured: {
      apiKey: Boolean(record.apiKeyEncrypted),
      hmacSecret: Boolean(record.hmacSecretEncrypted),
      encryptionKey: Boolean(record.encryptionKeyEncrypted),
    },
  }
}

export async function upsertOrgPartnerAgentFloatConfig(
  organizationId: string,
  input: UpdatePartnerAgentFloatConfigInput,
): Promise<PartnerAgentFloatPublicConfig> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  })
  if (!org) {
    throw new Error('Organization not found')
  }

  if (input.enabled === true) {
    const activeDs = await prisma.dataSource.count({
      where: { organizationId, isActive: true },
    })
    if (activeDs === 0) {
      throw new Error('Organization must have at least one active data source before enabling sync')
    }
  }

  const existing = await prisma.organizationPartnerAgentFloat.findUnique({
    where: { organizationId },
  })

  const intervalMs =
    input.intervalMs !== undefined
      ? Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, input.intervalMs))
      : (existing?.intervalMs ?? 300_000)

  const requestTimeoutMs =
    input.requestTimeoutMs !== undefined
      ? Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, input.requestTimeoutMs))
      : (existing?.requestTimeoutMs ?? 30_000)

  const apiUrl =
    input.apiUrl !== undefined
      ? input.apiUrl.trim().replace(/\/$/, '') || null
      : (existing?.apiUrl ?? null)

  const partnerOrgCode =
    input.partnerOrgCode !== undefined
      ? input.partnerOrgCode.trim()
        ? normalizePartnerOrgCode(input.partnerOrgCode)
        : null
      : (existing?.partnerOrgCode ?? null)

  const data = {
    enabled: input.enabled ?? existing?.enabled ?? false,
    apiUrl,
    partnerOrgCode,
    intervalMs,
    requestTimeoutMs,
    ...(input.apiKey?.trim()
      ? { apiKeyEncrypted: encrypt(input.apiKey.trim()) }
      : existing?.apiKeyEncrypted
        ? { apiKeyEncrypted: existing.apiKeyEncrypted }
        : {}),
    ...(input.hmacSecret?.trim()
      ? { hmacSecretEncrypted: encrypt(input.hmacSecret.trim()) }
      : existing?.hmacSecretEncrypted
        ? { hmacSecretEncrypted: existing.hmacSecretEncrypted }
        : {}),
    ...(input.encryptionKey?.trim()
      ? { encryptionKeyEncrypted: encrypt(input.encryptionKey.trim()) }
      : existing?.encryptionKeyEncrypted
        ? { encryptionKeyEncrypted: existing.encryptionKeyEncrypted }
        : {}),
  }

  const willEnable = input.enabled ?? existing?.enabled ?? false
  const mergedForValidation = {
    apiUrl: apiUrl ?? '',
    partnerOrgCode: partnerOrgCode ?? '',
    apiKeyEncrypted: input.apiKey?.trim()
      ? 'set'
      : existing?.apiKeyEncrypted ?? null,
    hmacSecretEncrypted: input.hmacSecret?.trim()
      ? 'set'
      : existing?.hmacSecretEncrypted ?? null,
    encryptionKeyEncrypted: input.encryptionKey?.trim()
      ? 'set'
      : existing?.encryptionKeyEncrypted ?? null,
  }
  if (
    willEnable &&
    (!mergedForValidation.apiUrl ||
      !mergedForValidation.partnerOrgCode ||
      !mergedForValidation.apiKeyEncrypted ||
      !mergedForValidation.hmacSecretEncrypted ||
      !mergedForValidation.encryptionKeyEncrypted)
  ) {
    throw new Error(
      'Partner API URL, partner org code, API key, HMAC secret, and encryption key are required to enable sync',
    )
  }

  await prisma.organizationPartnerAgentFloat.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  })

  const publicConfig = await getOrgPartnerAgentFloatPublicConfig(organizationId)
  if (!publicConfig) {
    throw new Error('Failed to load partner agent float config')
  }
  return publicConfig
}

export async function listEnabledOrgPartnerConfigs() {
  return prisma.organizationPartnerAgentFloat.findMany({
    where: { enabled: true },
    include: { organization: { select: { id: true, name: true } } },
  })
}
