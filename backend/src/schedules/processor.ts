import { ReportScheduleStatus } from '@prisma/client'
import { env } from '../env.js'
import { sendReportScheduleEmail } from '../mail/reportSchedule.js'
import { prisma } from '../prisma.js'
import { getGroupRecipientEmails } from './service.js'

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
  console.log(`[report-schedule] Processor started (poll every ${pollLabel})`)
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
        report: { select: { id: true, name: true, deletedAt: true, isPublished: true } },
        group: { select: { id: true, name: true } },
      },
    })

    for (const schedule of due) {
      await deliverSchedule(schedule)
    }
  } catch (err) {
    console.error('[report-schedule] Processor error:', err)
  } finally {
    processing = false
  }
}

async function deliverSchedule(schedule: {
  id: string
  scheduledAt: Date
  report: { id: string; name: string; deletedAt: Date | null; isPublished: boolean }
  group: { id: string; name: string }
}) {
  if (schedule.report.deletedAt || !schedule.report.isPublished) {
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
    await prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: 'Recipient group has no active members with email addresses',
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
    })
    if (result.ok) {
      sentCount += 1
    } else {
      failures.push(`${to}: ${result.message}`)
    }
  }

  if (sentCount === 0) {
    await prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: {
        status: ReportScheduleStatus.FAILED,
        lastError: failures[0] ?? 'Failed to send notification emails',
      },
    })
    return
  }

  await prisma.reportSchedule.update({
    where: { id: schedule.id },
    data: {
      status: ReportScheduleStatus.COMPLETED,
      lastSentAt: new Date(),
      lastError: failures.length > 0 ? failures.join('; ') : null,
    },
  })
}
