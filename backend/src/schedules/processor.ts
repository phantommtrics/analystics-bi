import { ReportScheduleRecurrence, ReportScheduleStatus } from '@prisma/client'
import { recordAuditEvent } from '../audit/service.js'
import { env } from '../env.js'
import { sendReportScheduleEmail, type ReportScheduleAttachment } from '../mail/reportSchedule.js'
import { log, logError } from '../utils/logger.js'
import { runScheduledReport } from './runReport.js'
import { prisma } from '../prisma.js'
import { isRecurring } from './recurrence.js'
import { getGroupRecipientEmails, scheduleNextRunAfterDelivery } from './service.js'

let pollTimer: ReturnType<typeof setInterval> | null = null
let processing = false

export function startReportScheduleProcessor() {
  if (pollTimer) return
  const pollMs = env.REPORT_SCHEDULE_POLL_INTERVAL_MS
  void processDueReportSchedules()
  pollTimer = setInterval(() => {
    void processDueReportSchedules()
  }, pollMs)
  const pollLabel =
    pollMs % 1000 === 0 ? `${pollMs / 1000}s` : `${pollMs}ms`
  log('report-schedule', `Processor started (poll every ${pollLabel})`)
}

export function stopReportScheduleProcessor() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export async function processDueReportSchedules() {
  if (processing) return
  processing = true

  try {
    const due = await prisma.reportSchedule.findMany({
      where: {
        status: ReportScheduleStatus.ACTIVE,
        scheduledAt: { lte: new Date() },
      },
      include: {
        report: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
            isPublished: true,
            dataSource: { select: { isActive: true } },
          },
        },
        group: { select: { id: true, name: true } },
      },
    })

    if (due.length > 0) {
      log('report-schedule', `Processing ${due.length} due schedule(s)`)
    }

    for (const schedule of due) {
      await deliverSchedule(schedule)
    }
  } catch (err) {
    logError('report-schedule', 'Processor error:', err)
  } finally {
    processing = false
  }
}

async function deliverSchedule(schedule: {
  id: string
  recurrence: ReportScheduleRecurrence
  scheduledAt: Date
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezoneOffsetMinutes: number
  report: {
    id: string
    name: string
    deletedAt: Date | null
    isPublished: boolean
    dataSource: { isActive: boolean }
  }
  group: { id: string; name: string }
}) {
  if (schedule.report.deletedAt || !schedule.report.isPublished) {
    log('report-schedule', `Skipped schedule=${schedule.id} report="${schedule.report.name}" (unpublished or deleted)`)
    await prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: 'Report is no longer published or was deleted',
      },
    })
    return
  }

  const recipients = await getGroupRecipientEmails(schedule.group.id)
  if (recipients.length === 0) {
    log('report-schedule', `Failed schedule=${schedule.id} report="${schedule.report.name}" (no recipients)`)
    await prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: 'Recipient group has no active members with email addresses',
      },
    })
    return
  }

  if (!schedule.report.dataSource.isActive) {
    log('report-schedule', `Failed schedule=${schedule.id} report="${schedule.report.name}" (inactive data source)`)
    await prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: 'Report data source is inactive',
      },
    })
    return
  }

  log(
    'report-schedule',
    `Delivering schedule=${schedule.id} report="${schedule.report.name}" group="${schedule.group.name}" recipients=${recipients.length}`,
  )

  let attachments: ReportScheduleAttachment[]
  let filterLabel: string
  try {
    const bundle = await runScheduledReport(schedule.report.id, {
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
      err instanceof Error ? err.message : 'Failed to generate report exports'
    logError('report-schedule', `Failed schedule=${schedule.id} report="${schedule.report.name}": ${message}`)
    await prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: message,
      },
    })
    return
  }

  const reportUrl = `${env.APP_PUBLIC_URL}/reports/view/${encodeURIComponent(schedule.report.id)}`
  const failures: string[] = []
  let sentCount = 0

  for (const to of recipients) {
    const result = await sendReportScheduleEmail({
      to,
      reportName: schedule.report.name,
      groupName: schedule.group.name,
      scheduledAt: schedule.scheduledAt,
      reportUrl,
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
    logError('report-schedule', `Failed schedule=${schedule.id} report="${schedule.report.name}" (email delivery failed)`)
    await prisma.reportSchedule.update({
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
    action: 'RUN_SCHEDULE',
    resource: schedule.report.name,
    ipAddress: 'localhost',
    metadata: {
      scheduleId: schedule.id,
      groupName: schedule.group.name,
      recipientCount: sentCount,
    },
  })

  if (isRecurring(schedule.recurrence)) {
    const nextRun = scheduleNextRunAfterDelivery(schedule)
    log(
      'report-schedule',
      `Completed schedule=${schedule.id} report="${schedule.report.name}" sent=${sentCount}/${recipients.length} nextRun=${nextRun.toISOString()}`,
    )
    await prisma.reportSchedule.update({
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

  log(
    'report-schedule',
    `Completed schedule=${schedule.id} report="${schedule.report.name}" sent=${sentCount}/${recipients.length} (one-time)`,
  )

  await prisma.reportSchedule.update({
    where: { id: schedule.id },
    data: {
      status: ReportScheduleStatus.COMPLETED,
      lastSentAt: now,
      lastError,
    },
  })
}
