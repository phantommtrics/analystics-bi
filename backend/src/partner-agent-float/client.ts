import { randomUUID } from 'crypto'
import { getPartnerAgentFloatConfig } from './config.js'
import { encryptPayload, signBody } from './crypto.js'

export type DeliveryEnvelope = {
  schema_version: 1
  delivery_id: string
  snapshot_at: string
  record_count: number
  algorithm: 'aes-256-gcm'
  encrypted_payload: string
}

export type DeliverResult =
  | { ok: true; httpStatus: number; responseBody: string }
  | { ok: false; httpStatus: number | null; error: string; responseBody?: string }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function buildDeliveryEnvelope(
  deliveryId: string,
  snapshotAt: Date,
  innerPayloadJson: string,
  encryptionKey: string,
): DeliveryEnvelope {
  return {
    schema_version: 1,
    delivery_id: deliveryId,
    snapshot_at: snapshotAt.toISOString(),
    record_count: JSON.parse(innerPayloadJson).agents?.length ?? 0,
    algorithm: 'aes-256-gcm',
    encrypted_payload: encryptPayload(innerPayloadJson, encryptionKey),
  }
}

export async function deliverToPartner(
  envelope: DeliveryEnvelope,
  options?: { deliveryId?: string },
): Promise<DeliverResult> {
  const config = getPartnerAgentFloatConfig()
  if (!config.configured) {
    return { ok: false, httpStatus: null, error: 'Partner agent float delivery is not configured' }
  }

  const rawBody = JSON.stringify(envelope)
  const signature = signBody(rawBody, config.hmacSecret)
  const deliveryId = options?.deliveryId ?? envelope.delivery_id

  const maxAttempts = 3
  let lastError = 'Delivery failed'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs)

    try {
      const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'X-BIReports-Delivery-Id': deliveryId,
          'X-BIReports-Signature': signature,
        },
        body: rawBody,
        signal: controller.signal,
      })

      const responseBody = await res.text()

      if (res.ok) {
        return { ok: true, httpStatus: res.status, responseBody }
      }

      lastError = `Partner returned HTTP ${res.status}: ${responseBody.slice(0, 500)}`
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, httpStatus: res.status, error: lastError, responseBody }
      }
    } catch (err) {
      lastError =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `Request timed out after ${config.requestTimeoutMs}ms`
            : err.message
          : 'Delivery request failed'
    } finally {
      clearTimeout(timeout)
    }

    if (attempt < maxAttempts) {
      await sleep(1000 * 2 ** (attempt - 1))
    }
  }

  return { ok: false, httpStatus: null, error: lastError }
}

export function newDeliveryId(): string {
  return randomUUID()
}
