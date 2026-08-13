import {
  ReportScheduleRecurrence,
  ReportScheduleStatus,
  UserStatus,
  UserType,
} from '@prisma/client'
import { prisma } from '../prisma.js'
import { userCanViewReport } from '../reports/permissions.js'
import {
  computeNextRunAt,
  formatRecurrenceSummary,
  isRecurring,
  type RecurrenceInput,
  validateRecurrenceInput,
} from './recurrence.js'

const scheduleInclude = {
  report: {
    select: {
      id: true,
      name: true,
      isPublished: true,
      deletedAt: true,
    },
  },
  group: {
    select: {
      id: true,
      name: true,
      _count: { select: { members: true } },
    },
  },
  createdBy: {
    select: {
      id: true,
      username: true,
    },
  },
} as const

export function formatSchedule(schedule: {
  id: string
  reportId: string
  groupId: string
  recurrence: ReportScheduleRecurrence
  scheduledAt: Date
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezoneOffsetMinutes: number
  status: ReportScheduleStatus
  lastSentAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  report: { id: string; name: string }
  group: { id: string; name: string; _count: { members: number } }
  createdBy: { id: string; username: string } | null
}) {
  return {
    id: schedule.id,
    reportId: schedule.reportId,
    reportName: schedule.report.name,
    groupId: schedule.groupId,
    groupName: schedule.group.name,
    recipientCount: schedule.group._count.members,
    recurrence: schedule.recurrence,
    recurrenceLabel: formatRecurrenceSummary(schedule),
    scheduledAt: schedule.scheduledAt.toISOString(),
    timeMinutes: schedule.timeMinutes,
    dayOfWeek: schedule.dayOfWeek,
    dayOfMonth: schedule.dayOfMonth,
    timezoneOffsetMinutes: schedule.timezoneOffsetMinutes,
    status: schedule.status,
    lastSentAt: schedule.lastSentAt?.toISOString() ?? null,
    lastError: schedule.lastError,
    createdByUsername: schedule.createdBy?.username ?? null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  }
}

function toRecurrenceInput(schedule: {
  recurrence: ReportScheduleRecurrence
  scheduledAt: Date
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezoneOffsetMinutes: number
}): RecurrenceInput {
  return {
    recurrence: schedule.recurrence,
    scheduledAt: schedule.scheduledAt,
    timeMinutes: schedule.timeMinutes,
    dayOfWeek: schedule.dayOfWeek,
    dayOfMonth: schedule.dayOfMonth,
    timezoneOffsetMinutes: schedule.timezoneOffsetMinutes,
  }
}

export async function listReportSchedules() {
  const schedules = await prisma.reportSchedule.findMany({
    include: scheduleInclude,
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
  })
  return schedules.map(formatSchedule)
}

export async function listSchedulableReports(
  permissions: string[],
  userType?: UserType,
) {
  const reports = await prisma.savedReport.findMany({
    where: {
      deletedAt: null,
      isPublished: true,
    },
    select: {
      id: true,
      name: true,
      category: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  })
  const visible = reports.filter((r) => userCanViewReport(permissions, r.id, userType))
  return visible.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function listScheduleRecipientGroups() {
  const groups = await prisma.userGroup.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { members: true } },
    },
    orderBy: { name: 'asc' },
  })
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    memberCount: g._count.members,
  }))
}

export async function getReportScheduleById(id: string) {
  const schedule = await prisma.reportSchedule.findUnique({
    where: { id },
    include: scheduleInclude,
  })
  if (!schedule) return null
  return formatSchedule(schedule)
}

async function assertReportAndGroup(
  reportId: string,
  groupId: string,
  permissions: string[],
  userType?: UserType,
) {
  const report = await prisma.savedReport.findFirst({
    where: {
      id: reportId,
      deletedAt: null,
      isPublished: true,
    },
  })
  if (!report) {
    throw new Error('REPORT_NOT_FOUND')
  }
  if (!userCanViewReport(permissions, report.id, userType)) {
    throw new Error('REPORT_FORBIDDEN')
  }

  const group = await prisma.userGroup.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } } },
  })
  if (!group) {
    throw new Error('GROUP_NOT_FOUND')
  }
  if (group._count.members === 0) {
    throw new Error('GROUP_EMPTY')
  }
}

export async function createReportSchedule(data: {
  reportId: string
  groupId: string
  recurrence: ReportScheduleRecurrence
  scheduledAt?: Date
  timeMinutes?: number | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  timezoneOffsetMinutes: number
  createdById?: string
  permissions: string[]
  userType?: UserType
}) {
  await assertReportAndGroup(data.reportId, data.groupId, data.permissions, data.userType)

  const input: RecurrenceInput = {
    recurrence: data.recurrence,
    scheduledAt: data.scheduledAt,
    timeMinutes: data.timeMinutes,
    dayOfWeek: data.dayOfWeek,
    dayOfMonth: data.dayOfMonth,
    timezoneOffsetMinutes: data.timezoneOffsetMinutes,
  }
  validateRecurrenceInput(input)

  const scheduledAt = computeNextRunAt(
    input,
    data.recurrence === ReportScheduleRecurrence.ONCE
      ? new Date(0)
      : new Date(),
  )

  const schedule = await prisma.reportSchedule.create({
    data: {
      reportId: data.reportId,
      groupId: data.groupId,
      recurrence: data.recurrence,
      scheduledAt,
      timeMinutes:
        data.recurrence === ReportScheduleRecurrence.ONCE ? null : data.timeMinutes,
      dayOfWeek:
        data.recurrence === ReportScheduleRecurrence.WEEKLY ? data.dayOfWeek : null,
      dayOfMonth:
        data.recurrence === ReportScheduleRecurrence.MONTHLY ? data.dayOfMonth : null,
      timezoneOffsetMinutes: data.timezoneOffsetMinutes,
      createdById: data.createdById,
    },
    include: scheduleInclude,
  })
  return formatSchedule(schedule)
}

export async function updateReportSchedule(
  id: string,
  data: {
    scheduledAt?: Date
    status?: ReportScheduleStatus
    recurrence?: ReportScheduleRecurrence
    timeMinutes?: number | null
    dayOfWeek?: number | null
    dayOfMonth?: number | null
    timezoneOffsetMinutes?: number
  },
) {
  const existing = await prisma.reportSchedule.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  if (
    existing.status === ReportScheduleStatus.COMPLETED &&
    existing.recurrence === ReportScheduleRecurrence.ONCE
  ) {
    throw new Error('ALREADY_COMPLETED')
  }

  if (existing.status === ReportScheduleStatus.FAILED) {
    throw new Error('CANNOT_EDIT_FAILED')
  }

  const recurrence = data.recurrence ?? existing.recurrence
  const timeMinutes =
    data.timeMinutes !== undefined ? data.timeMinutes : existing.timeMinutes
  const dayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek
  const dayOfMonth =
    data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth
  const timezoneOffsetMinutes =
    data.timezoneOffsetMinutes ?? existing.timezoneOffsetMinutes

  let scheduledAt = existing.scheduledAt

  const patternChanged =
    data.recurrence !== undefined ||
    data.timeMinutes !== undefined ||
    data.dayOfWeek !== undefined ||
    data.dayOfMonth !== undefined ||
    data.timezoneOffsetMinutes !== undefined ||
    data.scheduledAt !== undefined

  if (patternChanged && existing.status !== ReportScheduleStatus.PAUSED) {
    if (existing.status !== ReportScheduleStatus.ACTIVE) {
      throw new Error('CANNOT_RESCHEDULE')
    }
  }

  if (recurrence === ReportScheduleRecurrence.ONCE) {
    if (data.scheduledAt) {
      if (data.scheduledAt.getTime() <= Date.now()) {
        throw new Error('SCHEDULE_IN_PAST')
      }
      scheduledAt = data.scheduledAt
    }
  } else if (patternChanged) {
    const input: RecurrenceInput = {
      recurrence,
      timeMinutes,
      dayOfWeek,
      dayOfMonth,
      timezoneOffsetMinutes,
    }
    validateRecurrenceInput(input)
    scheduledAt = computeNextRunAt(input, new Date())
  }

  if (data.status === ReportScheduleStatus.ACTIVE) {
    if (isRecurring(recurrence) && scheduledAt.getTime() <= Date.now()) {
      scheduledAt = computeNextRunAt(
        {
          recurrence,
          timeMinutes,
          dayOfWeek,
          dayOfMonth,
          timezoneOffsetMinutes,
        },
        new Date(),
      )
    } else if (
      recurrence === ReportScheduleRecurrence.ONCE &&
      scheduledAt.getTime() <= Date.now()
    ) {
      throw new Error('SCHEDULE_IN_PAST')
    }
  }

  const schedule = await prisma.reportSchedule.update({
    where: { id },
    data: {
      recurrence,
      scheduledAt,
      timeMinutes:
        recurrence === ReportScheduleRecurrence.ONCE ? null : timeMinutes,
      dayOfWeek:
        recurrence === ReportScheduleRecurrence.WEEKLY ? dayOfWeek : null,
      dayOfMonth:
        recurrence === ReportScheduleRecurrence.MONTHLY ? dayOfMonth : null,
      timezoneOffsetMinutes,
      status: data.status,
    },
    include: scheduleInclude,
  })
  return formatSchedule(schedule)
}

export async function deleteReportSchedule(id: string) {
  const existing = await prisma.reportSchedule.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }
  await prisma.reportSchedule.delete({ where: { id } })
}

export async function getGroupRecipientEmails(groupId: string): Promise<string[]> {
  const members = await prisma.userGroupMember.findMany({
    where: {
      groupId,
      user: { status: UserStatus.ACTIVE },
    },
    select: {
      user: { select: { email: true } },
    },
  })
  const emails = members.map((m) => m.user.email.toLowerCase().trim()).filter(Boolean)
  return [...new Set(emails)]
}

export function scheduleNextRunAfterDelivery(schedule: {
  recurrence: ReportScheduleRecurrence
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezoneOffsetMinutes: number
}) {
  return computeNextRunAt(toRecurrenceInput({ ...schedule, scheduledAt: new Date() }), new Date())
}
