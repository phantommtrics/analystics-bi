import { apiFetch } from './client'

type OrgQuery = { organizationId?: string }

function orgQuery(params: OrgQuery = {}) {
  if (!params.organizationId) return ''
  return `?organizationId=${encodeURIComponent(params.organizationId)}`
}

function orgSearchParams(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

async function partnerAgentFloatFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  return apiFetch<T>(`/partner-agent-float${path}`, accessToken, options)
}

export type PartnerAgentFloatDeliveryStatus = 'RUNNING' | 'SUCCESS' | 'FAILED'

export interface PartnerAgentFloatContext {
  organizationId: string | null
  organizations: Array<{ id: string; name: string }>
  canSelectOrganization: boolean
}

export interface PartnerAgentFloatConfig {
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

export interface PartnerAgentFloatStatus extends PartnerAgentFloatConfig {
  lastDelivery: {
    deliveryId: string
    snapshotAt: string
    recordCount: number
    status: PartnerAgentFloatDeliveryStatus
    httpStatus: number | null
    errorMessage: string | null
    durationMs: number | null
    createdAt: string
  } | null
  nextRunAt: string | null
}

export interface UpdatePartnerAgentFloatConfigPayload {
  enabled?: boolean
  apiUrl?: string
  partnerOrgCode?: string
  intervalMs?: number
  requestTimeoutMs?: number
  apiKey?: string
  hmacSecret?: string
  encryptionKey?: string
}

export interface DeliveryHistoryItem {
  id: string
  deliveryId: string
  snapshotAt: string
  recordCount: number
  status: PartnerAgentFloatDeliveryStatus
  httpStatus: number | null
  errorMessage: string | null
  durationMs: number | null
  createdAt: string
}

export interface DeliveryHistoryResult {
  items: DeliveryHistoryItem[]
  total: number
  page: number
  pageSize: number
}

export interface RunDeliveryResult {
  deliveryId: string
  snapshotAt: string
  recordCount: number
  status: PartnerAgentFloatDeliveryStatus
  httpStatus: number | null
  errorMessage: string | null
  durationMs: number
}

export interface PreviewSnapshot {
  snapshotAt: string
  totalAgents: number
  agents: Array<{
    agent_number: string
    after_balance: string
    balance_as_of: string
  }>
}

export const partnerAgentFloatApi = {
  context(accessToken: string, organizationId?: string) {
    return partnerAgentFloatFetch<PartnerAgentFloatContext>(
      `/context${orgQuery({ organizationId })}`,
      accessToken,
    )
  },

  getConfig(accessToken: string, organizationId?: string) {
    return partnerAgentFloatFetch<PartnerAgentFloatConfig>(
      `/config${orgQuery({ organizationId })}`,
      accessToken,
    )
  },

  updateConfig(
    accessToken: string,
    payload: UpdatePartnerAgentFloatConfigPayload,
    organizationId?: string,
  ) {
    return partnerAgentFloatFetch<PartnerAgentFloatConfig>(
      `/config${orgQuery({ organizationId })}`,
      accessToken,
      { method: 'PATCH', body: JSON.stringify(payload) },
    )
  },

  status(accessToken: string, organizationId?: string) {
    return partnerAgentFloatFetch<PartnerAgentFloatStatus>(
      `/status${orgQuery({ organizationId })}`,
      accessToken,
    )
  },

  deliveries(accessToken: string, page = 1, pageSize = 20, organizationId?: string) {
    return partnerAgentFloatFetch<DeliveryHistoryResult>(
      `/deliveries${orgSearchParams({
        organizationId,
        page: String(page),
        pageSize: String(pageSize),
      })}`,
      accessToken,
    )
  },

  preview(accessToken: string, limit = 50, organizationId?: string) {
    return partnerAgentFloatFetch<PreviewSnapshot>(
      `/preview${orgSearchParams({ organizationId, limit: String(limit) })}`,
      accessToken,
    )
  },

  run(accessToken: string, organizationId?: string) {
    return partnerAgentFloatFetch<RunDeliveryResult>(
      `/run${orgQuery({ organizationId })}`,
      accessToken,
      { method: 'POST' },
    )
  },
}
