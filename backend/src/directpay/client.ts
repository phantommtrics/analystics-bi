import crypto from 'node:crypto'

export type DirectPayPartnerConfig = {
  baseUrl: string
  apiSecret: string
  publicAppUrl: string
  webhookSecret: string | null
  configured: boolean
}

export type DirectPaySubscriptionData = {
  businessId: string
  partnerProvisioningExternalUserId: string | null
  subscription: {
    id: string
    status: string
    billingInterval: string
    startDate: string
    currentPeriodStart: string
    currentPeriodEnd: string | null
    contractPerpetual: boolean
    plan: {
      code: string
      name: string
      currency: string
    }
  } | null
  pendingInvoice: {
    id: string
    amount: string
    currency: string
    status: string
    dueDate: string
    guestToken: string | null
  } | null
}

export type DirectPayProvisionResult = {
  businessId: string
  userId: string
  subscriptionId: string | null
  slug: string
  idempotentReplay: boolean
}

const ACTIVE_STATUSES = new Set(['TRIALING', 'ACTIVE', 'PAST_DUE'])

export function getDirectPayPartnerConfig(): DirectPayPartnerConfig {
  const baseUrl = (process.env.DIRECTPAY_API_BASE_URL || '').replace(/\/$/, '')
  const apiSecret = (process.env.DIRECTPAY_INTERNAL_PARTNER_API_SECRET || '').trim()
  const publicAppUrl = (process.env.DIRECTPAY_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const webhookSecret = (process.env.DIRECTPAY_WEBHOOK_SECRET || '').trim() || null
  return {
    baseUrl,
    apiSecret,
    publicAppUrl,
    webhookSecret,
    configured: Boolean(baseUrl && apiSecret),
  }
}

export function isSubscriptionAccessAllowed(status: string | null | undefined): boolean {
  if (!status) return false
  return ACTIVE_STATUSES.has(status)
}

export function buildGuestInvoicePayUrl(guestToken: string | null | undefined): string | null {
  if (!guestToken?.trim()) return null
  const { publicAppUrl } = getDirectPayPartnerConfig()
  if (!publicAppUrl) return null
  return `${publicAppUrl}/guest/subscription-invoice/${encodeURIComponent(guestToken.trim())}`
}

async function partnerJson<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { baseUrl, apiSecret, configured } = getDirectPayPartnerConfig()
  if (!configured) {
    throw Object.assign(new Error('DirectPay partner API is not configured'), {
      code: 'DIRECTPAY_NOT_CONFIGURED',
    })
  }
  const url = `${baseUrl}/api/internal-partner/v1${path.startsWith('/') ? path : `/${path}`}`
  const method = init.method || 'GET'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiSecret}`,
    Accept: 'application/json',
  }
  let body: string | undefined
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.body)
  }
  const res = await fetch(url, { method, headers, body })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(`DirectPay ${method} ${path} failed: ${res.status} ${text.slice(0, 500)}`)
    ;(err as Error & { status?: number; body?: unknown }).status = res.status
    ;(err as Error & { status?: number; body?: unknown }).body = json
    throw err
  }
  return json as T
}

export async function provisionDirectPayBusiness(input: {
  externalUserId: string
  ownerEmail: string
  ownerName: string
  businessName: string
  slug?: string
  industry?: string
  webhookUrl?: string | null
}) {
  const json = await partnerJson<{ data: DirectPayProvisionResult }>('/provision', {
    method: 'POST',
    body: {
      ...input,
      partnerApp: 'analytics-bi',
    },
  })
  return json.data
}

export async function getDirectPaySubscription(businessId: string) {
  const json = await partnerJson<{ data: DirectPaySubscriptionData }>(
    `/businesses/${encodeURIComponent(businessId)}/subscription`,
  )
  return json.data
}

export async function startDirectPaySubscription(
  businessId: string,
  input?: { planCode?: string; billingInterval?: string },
) {
  const json = await partnerJson<{ data: DirectPaySubscriptionData }>(
    `/businesses/${encodeURIComponent(businessId)}/subscription`,
    {
      method: 'POST',
      body: {
        planCode: input?.planCode ?? 'CORPORATE',
        billingInterval: input?.billingInterval,
      },
    },
  )
  return json.data
}

export function verifyDirectPayWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  const { webhookSecret } = getDirectPayPartnerConfig()
  if (!webhookSecret || !signatureHeader?.trim()) {
    return false
  }
  const expected = `sha256=${crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')}`
  const provided = signatureHeader.trim()
  if (expected.length !== provided.length) {
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}
