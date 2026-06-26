import { PartnerAgentFloatDeliveryStatus } from '@prisma/client'
import { recordAuditEvent } from '../audit/service.js'
import { executeDataSourceQuery } from '../datasources/service.js'
import { applySqlFilters } from '../reports/sqlFilters.js'
import { prisma } from '../prisma.js'
import { log, logError } from '../utils/logger.js'
import {
  buildDeliveryEnvelope,
  deliverToPartner,
  newDeliveryId,
} from './client.js'
import { maskApiUrl } from './config.js'
import {
  getOrgPartnerAgentFloatPublicConfig,
  getOrgPartnerAgentFloatRecord,
  getOrgPartnerAgentFloatRuntimeConfig,
  toRuntimeConfig,
  type PartnerAgentFloatPublicConfig,
  upsertOrgPartnerAgentFloatConfig,
  type UpdatePartnerAgentFloatConfigInput,
} from './orgConfig.js'
import {
  AGENT_EMONEY_FLOAT_SNAPSHOT_SQL,
  buildSnapshotPayload,
  type AgentFloatRow,
} from './query.js'

const ERROR_MAX_LEN = 2000

async function getActiveDataSourceIdForOrg(organizationId: string): Promise<string> {
  const ds = await prisma.dataSource.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  if (!ds) {
    throw new Error('No active data source configured for this organization')
  }
  return ds.id
}

export async function fetchAgentFloatRows(
  organizationId: string,
  snapshotAt: Date,
): Promise<AgentFloatRow[]> {
  const dataSourceId = await getActiveDataSourceIdForOrg(organizationId)
  const sql = applySqlFilters(AGENT_EMONEY_FLOAT_SNAPSHOT_SQL, {
    snapshotAt: snapshotAt.toISOString(),
  })
  const result = await executeDataSourceQuery(dataSourceId, sql)
  return result.rows as AgentFloatRow[]
}

export type RunDeliveryOptions = {
  organizationId: string
  triggeredBy?: string | null
  userLabel?: string
}

export type RunDeliveryResult = {
  deliveryId: string
  snapshotAt: string
  recordCount: number
  status: PartnerAgentFloatDeliveryStatus
  httpStatus: number | null
  errorMessage: string | null
  durationMs: number
}

export async function runPartnerAgentFloatDelivery(
  options: RunDeliveryOptions,
): Promise<RunDeliveryResult> {
  const config = await getOrgPartnerAgentFloatRuntimeConfig(options.organizationId)
  if (!config) {
    throw new Error('Partner agent float is not configured for this organization')
  }
  if (!config.enabled) {
    throw new Error('Partner agent float sync is disabled for this organization')
  }
  if (!config.configured) {
    throw new Error('Partner agent float delivery is not fully configured')
  }

  const deliveryId = newDeliveryId()
  const snapshotAt = new Date()
  const started = Date.now()

  const delivery = await prisma.partnerAgentFloatDelivery.create({
    data: {
      organizationId: options.organizationId,
      deliveryId,
      snapshotAt,
      recordCount: 0,
      status: PartnerAgentFloatDeliveryStatus.RUNNING,
    },
  })

  try {
    const rows = await fetchAgentFloatRows(options.organizationId, snapshotAt)
    const innerPayload = buildSnapshotPayload(
      deliveryId,
      snapshotAt,
      rows,
      config.organization,
    )
    const innerJson = JSON.stringify(innerPayload)
    const envelope = buildDeliveryEnvelope(
      deliveryId,
      snapshotAt,
      innerJson,
      config.encryptionKey,
      config.organization,
    )

    const result = await deliverToPartner(envelope, config, { deliveryId })
    const durationMs = Date.now() - started

    if (result.ok) {
      await prisma.partnerAgentFloatDelivery.update({
        where: { id: delivery.id },
        data: {
          recordCount: rows.length,
          status: PartnerAgentFloatDeliveryStatus.SUCCESS,
          httpStatus: result.httpStatus,
          durationMs,
          errorMessage: null,
        },
      })

      await recordAuditEvent({
        userId: options.triggeredBy ?? null,
        userLabel: options.userLabel ?? 'system',
        action: 'RUN_PARTNER_AGENT_FLOAT',
        resource: deliveryId,
        metadata: {
          organizationId: options.organizationId,
          recordCount: rows.length,
          httpStatus: result.httpStatus,
          durationMs,
        },
      })

      return {
        deliveryId,
        snapshotAt: snapshotAt.toISOString(),
        recordCount: rows.length,
        status: PartnerAgentFloatDeliveryStatus.SUCCESS,
        httpStatus: result.httpStatus,
        errorMessage: null,
        durationMs,
      }
    }

    const errorMessage = result.error.slice(0, ERROR_MAX_LEN)
    await prisma.partnerAgentFloatDelivery.update({
      where: { id: delivery.id },
      data: {
        recordCount: rows.length,
        status: PartnerAgentFloatDeliveryStatus.FAILED,
        httpStatus: result.httpStatus,
        durationMs,
        errorMessage,
      },
    })

    await recordAuditEvent({
      userId: options.triggeredBy ?? null,
      userLabel: options.userLabel ?? 'system',
      action: 'RUN_PARTNER_AGENT_FLOAT_FAILED',
      resource: deliveryId,
      metadata: {
        organizationId: options.organizationId,
        recordCount: rows.length,
        httpStatus: result.httpStatus,
        error: errorMessage,
        durationMs,
      },
    })

    return {
      deliveryId,
      snapshotAt: snapshotAt.toISOString(),
      recordCount: rows.length,
      status: PartnerAgentFloatDeliveryStatus.FAILED,
      httpStatus: result.httpStatus,
      errorMessage,
      durationMs,
    }
  } catch (err) {
    const durationMs = Date.now() - started
    const errorMessage = (
      err instanceof Error ? err.message : 'Partner agent float delivery failed'
    ).slice(0, ERROR_MAX_LEN)

    logError('partner-agent-float', 'Delivery failed:', err)

    await prisma.partnerAgentFloatDelivery.update({
      where: { id: delivery.id },
      data: {
        status: PartnerAgentFloatDeliveryStatus.FAILED,
        durationMs,
        errorMessage,
      },
    })

    await recordAuditEvent({
      userId: options.triggeredBy ?? null,
      userLabel: options.userLabel ?? 'system',
      action: 'RUN_PARTNER_AGENT_FLOAT_FAILED',
      resource: deliveryId,
      metadata: {
        organizationId: options.organizationId,
        error: errorMessage,
        durationMs,
      },
    })

    return {
      deliveryId,
      snapshotAt: snapshotAt.toISOString(),
      recordCount: 0,
      status: PartnerAgentFloatDeliveryStatus.FAILED,
      httpStatus: null,
      errorMessage,
      durationMs,
    }
  }
}

export type PartnerAgentFloatStatus = PartnerAgentFloatPublicConfig & {
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

export async function getPartnerAgentFloatStatus(
  organizationId: string,
): Promise<PartnerAgentFloatStatus | null> {
  const publicConfig = await getOrgPartnerAgentFloatPublicConfig(organizationId)
  if (!publicConfig) return null

  const last = await prisma.partnerAgentFloatDelivery.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })

  let nextRunAt: string | null = null
  if (publicConfig.enabled && last) {
    nextRunAt = new Date(last.createdAt.getTime() + publicConfig.intervalMs).toISOString()
  } else if (publicConfig.enabled) {
    nextRunAt = new Date().toISOString()
  }

  return {
    ...publicConfig,
    lastDelivery: last
      ? {
          deliveryId: last.deliveryId,
          snapshotAt: last.snapshotAt.toISOString(),
          recordCount: last.recordCount,
          status: last.status,
          httpStatus: last.httpStatus,
          errorMessage: last.errorMessage,
          durationMs: last.durationMs,
          createdAt: last.createdAt.toISOString(),
        }
      : null,
    nextRunAt,
  }
}

export type DeliveryHistoryItem = {
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

export async function listPartnerAgentFloatDeliveries(
  organizationId: string,
  page = 1,
  pageSize = 20,
): Promise<{ items: DeliveryHistoryItem[]; total: number; page: number; pageSize: number }> {
  const skip = (page - 1) * pageSize
  const where = { organizationId }
  const [items, total] = await Promise.all([
    prisma.partnerAgentFloatDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.partnerAgentFloatDelivery.count({ where }),
  ])

  return {
    items: items.map((row) => ({
      id: row.id,
      deliveryId: row.deliveryId,
      snapshotAt: row.snapshotAt.toISOString(),
      recordCount: row.recordCount,
      status: row.status,
      httpStatus: row.httpStatus,
      errorMessage: row.errorMessage,
      durationMs: row.durationMs,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  }
}

export async function previewAgentFloatSnapshot(
  organizationId: string,
  limit = 50,
): Promise<{
  snapshotAt: string
  totalAgents: number
  agents: Array<{
    agent_number: string
    after_balance: string
    balance_as_of: string
  }>
}> {
  const snapshotAt = new Date()
  const rows = await fetchAgentFloatRows(organizationId, snapshotAt)
  const record = await getOrgPartnerAgentFloatRecord(organizationId)
  const org = record?.organization ?? (await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  }))
  if (!org) {
    throw new Error('Organization not found')
  }
  const organization = record?.partnerOrgCode?.trim()
    ? {
        id: org.id,
        partnerOrgCode: record.partnerOrgCode.trim(),
      }
    : {
        id: org.id,
        partnerOrgCode: 'preview',
      }
  const payload = buildSnapshotPayload('preview', snapshotAt, rows, organization)
  return {
    snapshotAt: snapshotAt.toISOString(),
    totalAgents: payload.agents.length,
    agents: payload.agents.slice(0, limit),
  }
}

export async function getPartnerAgentFloatConfig(organizationId: string) {
  return getOrgPartnerAgentFloatPublicConfig(organizationId)
}

export async function updatePartnerAgentFloatConfig(
  organizationId: string,
  input: UpdatePartnerAgentFloatConfigInput,
) {
  return upsertOrgPartnerAgentFloatConfig(organizationId, input)
}

export async function isOrganizationDueForDelivery(organizationId: string, intervalMs: number) {
  const last = await prisma.partnerAgentFloatDelivery.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!last) return true
  return Date.now() - last.createdAt.getTime() >= intervalMs
}

export { maskApiUrl, toRuntimeConfig }
