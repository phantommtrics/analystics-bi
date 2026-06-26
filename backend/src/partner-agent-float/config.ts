import { env } from '../env.js'

export type PartnerAgentFloatConfig = {
  enabled: boolean
  intervalMs: number
  apiUrl: string
  apiKey: string
  hmacSecret: string
  encryptionKey: string
  requestTimeoutMs: number
  configured: boolean
}

export function getPartnerAgentFloatConfig(): PartnerAgentFloatConfig {
  const apiUrl = (env.PARTNER_AGENT_FLOAT_API_URL || '').trim().replace(/\/$/, '')
  const apiKey = (env.PARTNER_AGENT_FLOAT_API_KEY || '').trim()
  const hmacSecret = (env.PARTNER_AGENT_FLOAT_HMAC_SECRET || '').trim()
  const encryptionKey = (env.PARTNER_AGENT_FLOAT_ENCRYPTION_KEY || '').trim()

  const configured = Boolean(apiUrl && apiKey && hmacSecret && encryptionKey)

  return {
    enabled: env.PARTNER_AGENT_FLOAT_ENABLED,
    intervalMs: env.PARTNER_AGENT_FLOAT_INTERVAL_MS,
    apiUrl,
    apiKey,
    hmacSecret,
    encryptionKey,
    requestTimeoutMs: env.PARTNER_AGENT_FLOAT_REQUEST_TIMEOUT_MS,
    configured,
  }
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
