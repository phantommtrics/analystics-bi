import { env } from '../env.js'
import { listEnabledOrgPartnerConfigs, toRuntimeConfig } from './orgConfig.js'
import {
  isOrganizationDueForDelivery,
  runPartnerAgentFloatDelivery,
} from './service.js'
import { log, logError } from '../utils/logger.js'

let pollTimer: ReturnType<typeof setInterval> | null = null
let processing = false

export function startPartnerAgentFloatProcessor() {
  if (pollTimer) return

  const pollMs = env.PARTNER_AGENT_FLOAT_PROCESSOR_POLL_MS
  void processPartnerAgentFloat()
  pollTimer = setInterval(() => {
    void processPartnerAgentFloat()
  }, pollMs)

  const pollLabel =
    pollMs % 60_000 === 0 ? `${pollMs / 60_000} min` : `${Math.round(pollMs / 1000)}s`
  log('partner-agent-float', `Processor started (check due orgs every ${pollLabel})`)
}

export function stopPartnerAgentFloatProcessor() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export async function processPartnerAgentFloat() {
  if (processing) return
  processing = true

  try {
    const orgConfigs = await listEnabledOrgPartnerConfigs()

    for (const record of orgConfigs) {
      const config = toRuntimeConfig(record)
      if (!config.configured) {
        log(
          'partner-agent-float',
          `Org ${record.organization.name} enabled but missing credentials — skipping`,
        )
        continue
      }

      const due = await isOrganizationDueForDelivery(record.organizationId, record.intervalMs)
      if (!due) continue

      const result = await runPartnerAgentFloatDelivery({
        organizationId: record.organizationId,
        userLabel: 'scheduler',
      })

      if (result.status === 'SUCCESS') {
        log(
          'partner-agent-float',
          `[${record.organization.name}] Delivered ${result.recordCount} agent(s) in ${result.durationMs}ms (${result.deliveryId})`,
        )
      } else {
        logError(
          'partner-agent-float',
          `[${record.organization.name}] Delivery failed (${result.deliveryId}): ${result.errorMessage ?? 'unknown error'}`,
        )
      }
    }
  } catch (err) {
    logError('partner-agent-float', 'Processor error:', err)
  } finally {
    processing = false
  }
}
