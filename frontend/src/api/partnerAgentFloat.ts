const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

async function partnerAgentFloatFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/partner-agent-float${path}`, {
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
  return response.json()
}

export type PartnerAgentFloatDeliveryStatus = 'RUNNING' | 'SUCCESS' | 'FAILED'

export interface PartnerAgentFloatStatus {
  enabled: boolean
  configured: boolean
  intervalMs: number
  apiUrlMasked: string
  keysConfigured: {
    apiKey: boolean
    hmacSecret: boolean
    encryptionKey: boolean
  }
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
  status(accessToken: string) {
    return partnerAgentFloatFetch<PartnerAgentFloatStatus>('/status', accessToken)
  },

  deliveries(accessToken: string, page = 1, pageSize = 20) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    return partnerAgentFloatFetch<DeliveryHistoryResult>(
      `/deliveries?${params}`,
      accessToken,
    )
  },

  preview(accessToken: string, limit = 50) {
    const params = new URLSearchParams({ limit: String(limit) })
    return partnerAgentFloatFetch<PreviewSnapshot>(`/preview?${params}`, accessToken)
  },

  run(accessToken: string) {
    return partnerAgentFloatFetch<RunDeliveryResult>('/run', accessToken, {
      method: 'POST',
    })
  },
}
