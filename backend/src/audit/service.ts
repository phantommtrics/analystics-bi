import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma.js'

export type AuditEventInput = {
  userId?: string | null
  userLabel: string
  action: string
  resource?: string | null
  ipAddress?: string | null
  metadata?: Record<string, unknown> | null
}

export type AuditLogFilters = {
  dateFrom?: string
  dateTo?: string
  user?: string
  action?: string
}

export type AuditLogRow = {
  id: string
  timestamp: string
  userId: string | null
  user: string
  action: string
  resource: string | null
  ip: string | null
}

export const AUDIT_PAGE_SIZE = 50
export const AUDIT_EXPORT_MAX_ROWS = 10_000

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userLabel: input.userLabel,
        action: input.action,
        resource: input.resource ?? null,
        ipAddress: input.ipAddress ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (err) {
    console.error('[audit] Failed to record event:', err)
  }
}

function buildWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {}

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) {
      where.createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`)
    }
    if (filters.dateTo) {
      where.createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999Z`)
    }
  }

  if (filters.user?.trim()) {
    const term = filters.user.trim()
    where.OR = [
      { userLabel: { contains: term, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { username: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { displayName: { contains: term, mode: 'insensitive' } },
          ],
        },
      },
    ]
  }

  if (filters.action?.trim()) {
    where.action = { contains: filters.action.trim().toUpperCase(), mode: 'insensitive' }
  }

  return where
}

function toRow(log: {
  id: string
  createdAt: Date
  userId: string | null
  userLabel: string
  action: string
  resource: string | null
  ipAddress: string | null
}): AuditLogRow {
  return {
    id: log.id,
    timestamp: log.createdAt.toISOString(),
    userId: log.userId,
    user: log.userLabel,
    action: log.action,
    resource: log.resource,
    ip: log.ipAddress,
  }
}

export async function listAuditLogs(
  filters: AuditLogFilters,
  page: number,
  pageSize = AUDIT_PAGE_SIZE,
) {
  const where = buildWhere(filters)
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(Math.max(1, pageSize), AUDIT_PAGE_SIZE)

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
  ])

  return {
    items: logs.map(toRow),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  }
}

export async function listAuditLogsForExport(filters: AuditLogFilters) {
  const where = buildWhere(filters)
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: AUDIT_EXPORT_MAX_ROWS,
  })
  return logs.map(toRow)
}

export async function listDistinctActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ['action'],
    select: { action: true },
    orderBy: { action: 'asc' },
  })
  return rows.map((r) => r.action)
}

export function auditLogsToCsv(rows: AuditLogRow[]): string {
  const header = ['Timestamp', 'User', 'Action', 'Resource', 'IP Address']
  const lines = rows.map((row) =>
    [
      row.timestamp,
      row.user,
      row.action,
      row.resource ?? '',
      row.ip ?? '',
    ]
      .map(csvEscape)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return req.ip ?? 'unknown'
}
