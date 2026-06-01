import { ReportScheduleStatus, UserStatus } from '@prisma/client'
import { prisma } from '../prisma.js'

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
  scheduledAt: Date
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
    scheduledAt: schedule.scheduledAt.toISOString(),
    status: schedule.status,
    lastSentAt: schedule.lastSentAt?.toISOString() ?? null,
    lastError: schedule.lastError,
    createdByUsername: schedule.createdBy?.username ?? null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  }
}

export async function listReportSchedules() {
  const schedules = await prisma.reportSchedule.findMany({
    include: scheduleInclude,
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
  })
  return schedules.map(formatSchedule)
}

export async function listSchedulableReports() {
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
  return reports.map((r) => ({
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

export async function createReportSchedule(data: {
  reportId: string
  groupId: string
  scheduledAt: Date
  createdById?: string
}) {
  if (data.scheduledAt.getTime() <= Date.now()) {
    throw new Error('SCHEDULE_IN_PAST')
  }

  const report = await prisma.savedReport.findFirst({
    where: {
      id: data.reportId,
      deletedAt: null,
      isPublished: true,
    },
  })
  if (!report) {
    throw new Error('REPORT_NOT_FOUND')
  }

  const group = await prisma.userGroup.findUnique({
    where: { id: data.groupId },
    include: { _count: { select: { members: true } } },
  })
  if (!group) {
    throw new Error('GROUP_NOT_FOUND')
  }
  if (group._count.members === 0) {
    throw new Error('GROUP_EMPTY')
  }

  const schedule = await prisma.reportSchedule.create({
    data: {
      reportId: data.reportId,
      groupId: data.groupId,
      scheduledAt: data.scheduledAt,
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
  },
) {
  const existing = await prisma.reportSchedule.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  if (existing.status === ReportScheduleStatus.COMPLETED) {
    throw new Error('ALREADY_COMPLETED')
  }

  if (data.scheduledAt) {
    if (data.scheduledAt.getTime() <= Date.now()) {
      throw new Error('SCHEDULE_IN_PAST')
    }
    if (existing.status !== ReportScheduleStatus.ACTIVE) {
      throw new Error('CANNOT_RESCHEDULE')
    }
  }

  if (data.status === ReportScheduleStatus.ACTIVE) {
    if (existing.scheduledAt.getTime() <= Date.now()) {
      throw new Error('SCHEDULE_IN_PAST')
    }
  }

  const schedule = await prisma.reportSchedule.update({
    where: { id },
    data,
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
