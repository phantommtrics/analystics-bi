import {
  ReportScheduleRecurrence,
  ReportScheduleStatus,
} from '@prisma/client'
import { prisma } from '../prisma.js'
import {
  computeNextRunAt,
  formatRecurrenceSummary,
  isRecurring,
  type RecurrenceInput,
  validateRecurrenceInput,
} from './recurrence.js'

const statementScheduleInclude = {
  statement: {
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

export function formatStatementSchedule(schedule: {
  id: string
  statementId: string
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
  statement: { id: string; name: string }
  group: { id: string; name: string; _count: { members: number } }
  createdBy: { id: string; username: string } | null
}) {
  return {
    id: schedule.id,
    statementId: schedule.statementId,
    statementName: schedule.statement.name,
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

export async function listStatementSchedules() {
  const schedules = await prisma.statementSchedule.findMany({
    include: statementScheduleInclude,
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
  })
  return schedules.map(formatStatementSchedule)
}

export async function listSchedulableStatements() {
  const statements = await prisma.statement.findMany({
    where: {
      deletedAt: null,
      isPublished: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
      category: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  })
  return statements.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    category: s.category,
    updatedAt: s.updatedAt.toISOString(),
  }))
}

export async function getStatementScheduleById(id: string) {
  const schedule = await prisma.statementSchedule.findUnique({
    where: { id },
    include: statementScheduleInclude,
  })
  if (!schedule) return null
  return formatStatementSchedule(schedule)
}

async function assertStatementAndGroup(statementId: string, groupId: string) {
  const statement = await prisma.statement.findFirst({
    where: {
      id: statementId,
      deletedAt: null,
      isPublished: true,
    },
  })
  if (!statement) {
    throw new Error('STATEMENT_NOT_FOUND')
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

export async function createStatementSchedule(data: {
  statementId: string
  groupId: string
  recurrence: ReportScheduleRecurrence
  scheduledAt?: Date
  timeMinutes?: number | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  timezoneOffsetMinutes: number
  createdById?: string
}) {
  await assertStatementAndGroup(data.statementId, data.groupId)

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
    data.recurrence === ReportScheduleRecurrence.ONCE ? new Date(0) : new Date(),
  )

  const schedule = await prisma.statementSchedule.create({
    data: {
      statementId: data.statementId,
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
    include: statementScheduleInclude,
  })
  return formatStatementSchedule(schedule)
}

export async function updateStatementSchedule(
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
  const existing = await prisma.statementSchedule.findUnique({ where: { id } })
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

  const schedule = await prisma.statementSchedule.update({
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
    include: statementScheduleInclude,
  })
  return formatStatementSchedule(schedule)
}

export async function deleteStatementSchedule(id: string) {
  const existing = await prisma.statementSchedule.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('NOT_FOUND')
  }
  await prisma.statementSchedule.delete({ where: { id } })
}

export function statementScheduleNextRunAfterDelivery(schedule: {
  recurrence: ReportScheduleRecurrence
  timeMinutes: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezoneOffsetMinutes: number
}) {
  return computeNextRunAt(toRecurrenceInput({ ...schedule, scheduledAt: new Date() }), new Date())
}
