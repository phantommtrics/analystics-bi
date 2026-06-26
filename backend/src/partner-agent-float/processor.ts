import { getPartnerAgentFloatConfig } from './config.js'
import { runPartnerAgentFloatDelivery, logPartnerAgentFloatConfigWarning } from './service.js'
import { log, logError } from '../utils/logger.js'

let pollTimer: ReturnType<typeof setInterval> | null = null
let processing = false

export function startPartnerAgentFloatProcessor() {
  const config = getPartnerAgentFloatConfig()
  if (!config.enabled) {
    return
  }

  logPartnerAgentFloatConfigWarning()

  if (pollTimer) {
    return
  }

  const pollMs = config.intervalMs
  void processPartnerAgentFloat()
  pollTimer = setInterval(() => {
    void processPartnerAgentFloat()
  }, pollMs)

  const pollLabel =
    pollMs % 60_000 === 0 ? `${pollMs / 60_000} min` : `${Math.round(pollMs / 1000)}s`
  log('partner-agent-float', `Processor started (every ${pollLabel})`)
}

export function stopPartnerAgentFloatProcessor() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export async function processPartnerAgentFloat() {
  const config = getPartnerAgentFloatConfig()
  if (!config.enabled || !config.configured) {
    return
  }
  if (processing) {
    return
  }

  processing = true
  try {
    const result = await runPartnerAgentFloatDelivery({
      userLabel: 'scheduler',
    })
    if (result.status === 'SUCCESS') {
      log(
        'partner-agent-float',
        `Delivered ${result.recordCount} agent(s) in ${result.durationMs}ms (${result.deliveryId})`,
      )
    } else {
      logError(
        'partner-agent-float',
        `Delivery failed (${result.deliveryId}): ${result.errorMessage ?? 'unknown error'}`,
      )
    }
  } catch (err) {
    logError('partner-agent-float', 'Processor error:', err)
  } finally {
    processing = false
  }
}
