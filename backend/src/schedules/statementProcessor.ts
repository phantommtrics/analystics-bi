import { ReportScheduleRecurrence, ReportScheduleStatus } from '@prisma/client'
import { recordAuditEvent } from '../audit/service.js'
import { env } from '../env.js'
import { sendStatementScheduleEmail } from '../mail/statementSchedule.js'
import { prisma } from '../prisma.js'
import { isRecurring } from './recurrence.js'
import { runScheduledStatement } from './runStatement.js'
import { getGroupRecipientEmails } from './service.js'
import { statementScheduleNextRunAfterDelivery } from './statementService.js'

let pollTimer: ReturnType<typeof setInterval> | null = null
let processing = false

export function startStatementScheduleProcessor() {
  if (pollTimer) return
  const pollMs = env.REPORT_SCHEDULE_POLL_INTERVAL_MS
  void processDueStatementSchedules()
  pollTimer = setInterval(() => {
    void processDueStatementSchedules()
  }, pollMs)
  const pollLabel =
    pollMs % 1000 === 0 ? `${pollMs / 1000}s` : `${pollMs}ms`
  console.log(`[statement-schedule] Processor started (poll every ${pollLabel})`)
}

export function stopStatementScheduleProcessor() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export async function processDueStatementSchedules() {
  if (processing) return
  processing = true

  try {
    const due = await prisma.statementSchedule.findMany({
      where: {
        status: ReportScheduleStatus.ACTIVE,
        scheduledAt: { lte: new Date() },
      },
      include: {
        statement: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
            isPublished: true,
          },
        },
        group: { select: { id: true, name: true } },
      },
    })

    for (const schedule of due) {
      await deliverStatementSchedule(schedule)
    }
  } catch (err) {
    console.error('[statement-schedule] Processor error:', err)
  } finally {
    processing = false
  }
}

async function deliverStatementSchedule(schedule: {
  id: string
  recurrence: ReportScheduleRecurrence
  scheduledAt: Date
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezoneOffsetMinutes: number
  statement: {
    id: string
    name: string
    deletedAt: Date | null
    isPublished: boolean
  }
  group: { id: string; name: string }
}) {
  if (schedule.statement.deletedAt || !schedule.statement.isPublished) {
    await prisma.statementSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: 'Statement is no longer published or was deleted',
      },
    })
    return
  }

  const recipients = await getGroupRecipientEmails(schedule.group.id)
  if (recipients.length === 0) {
    await prisma.statementSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: 'Recipient group has no active members with email addresses',
      },
    })
    return
  }

  let attachments: { filename: string; content: Buffer }[]
  let filterLabel: string
  try {
    const bundle = await runScheduledStatement(schedule.statement.id, {
      scheduledAt: schedule.scheduledAt,
      timezoneOffsetMinutes: schedule.timezoneOffsetMinutes,
      recurrence: schedule.recurrence,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
    })
    filterLabel = bundle.filterLabel
    attachments = bundle.attachments.map((file) => ({
      filename: file.filename,
      content: file.content,
    }))
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate statement exports'
    await prisma.statementSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: message,
      },
    })
    return
  }

  const statementUrl = `${env.APP_PUBLIC_URL}/statements/${encodeURIComponent(schedule.statement.id)}`
  const failures: string[] = []
  let sentCount = 0

  for (const to of recipients) {
    const result = await sendStatementScheduleEmail({
      to,
      statementName: schedule.statement.name,
      groupName: schedule.group.name,
      scheduledAt: schedule.scheduledAt,
      statementUrl,
      filterLabel,
      attachments,
    })
    if (result.ok) {
      sentCount += 1
    } else {
      failures.push(`${to}: ${result.message}`)
    }
  }

  if (sentCount === 0) {
    await prisma.statementSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: failures[0] ?? 'Failed to send notification emails',
      },
    })
    return
  }

  const now = new Date()
  const lastError = failures.length > 0 ? failures.join('; ') : null

  void recordAuditEvent({
    userLabel: 'System',
    action: 'RUN_STATEMENT_SCHEDULE',
    resource: schedule.statement.name,
    ipAddress: 'localhost',
    metadata: {
      scheduleId: schedule.id,
      groupName: schedule.group.name,
      recipientCount: sentCount,
    },
  })

  if (isRecurring(schedule.recurrence)) {
    const nextRun = statementScheduleNextRunAfterDelivery(schedule)
    await prisma.statementSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.ACTIVE,
        scheduledAt: nextRun,
        lastSentAt: now,
        lastError,
      },
    })
    return
  }

  await prisma.statementSchedule.update({
    where: { id: schedule.id },
    data: {
      status: ReportScheduleStatus.COMPLETED,
      lastSentAt: now,
      lastError,
    },
  })
}
