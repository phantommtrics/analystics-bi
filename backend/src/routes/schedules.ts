import { ReportScheduleRecurrence, ReportScheduleStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import {
  createReportSchedule,
  deleteReportSchedule,
  getReportScheduleById,
  listReportSchedules,
  listScheduleRecipientGroups,
  listSchedulableReports,
  updateReportSchedule,
} from '../schedules/service.js'
import {
  createStatementSchedule,
  deleteStatementSchedule,
  getStatementScheduleById,
  listSchedulableStatements,
  listStatementSchedules,
  updateStatementSchedule,
} from '../schedules/statementService.js'
import { paramId } from '../utils/params.js'

export const schedulesRouter = Router()

schedulesRouter.use(authenticate)

const recurrenceEnum = z.nativeEnum(ReportScheduleRecurrence)

const createReportScheduleSchema = z
  .object({
    reportId: z.string().min(1),
    groupId: z.string().min(1),
    recurrence: recurrenceEnum.default(ReportScheduleRecurrence.ONCE),
    scheduledAt: z.string().datetime().optional(),
    timeMinutes: z.number().int().min(0).max(1439).optional(),
    dayOfWeek: z.number().int().min(1).max(7).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    timezoneOffsetMinutes: z.number().int().min(-840).max(840).default(0),
  })
  .superRefine((data, ctx) => {
    if (data.recurrence === ReportScheduleRecurrence.ONCE && !data.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scheduledAt is required for one-time schedules',
        path: ['scheduledAt'],
      })
    }
    if (data.recurrence !== ReportScheduleRecurrence.ONCE && data.timeMinutes == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'timeMinutes is required for recurring schedules',
        path: ['timeMinutes'],
      })
    }
    if (
      data.recurrence === ReportScheduleRecurrence.WEEKLY &&
      data.dayOfWeek == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dayOfWeek is required for weekly schedules',
        path: ['dayOfWeek'],
      })
    }
    if (
      data.recurrence === ReportScheduleRecurrence.MONTHLY &&
      data.dayOfMonth == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dayOfMonth is required for monthly schedules',
        path: ['dayOfMonth'],
      })
    }
  })

const updateScheduleSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  status: z.nativeEnum(ReportScheduleStatus).optional(),
  recurrence: recurrenceEnum.optional(),
  timeMinutes: z.number().int().min(0).max(1439).optional(),
  dayOfWeek: z.number().int().min(1).max(7).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
})

function mapScheduleError(error: unknown, res: import('express').Response) {
  if (!(error instanceof Error)) {
    return false
  }
  switch (error.message) {
    case 'NOT_FOUND':
      res.status(404).json({ message: 'Schedule not found' })
      return true
    case 'REPORT_NOT_FOUND':
      res.status(400).json({ message: 'Published report not found' })
      return true
    case 'STATEMENT_NOT_FOUND':
      res.status(400).json({ message: 'Published statement not found' })
      return true
    case 'GROUP_NOT_FOUND':
      res.status(400).json({ message: 'Recipient group not found' })
      return true
    case 'GROUP_EMPTY':
      res.status(400).json({ message: 'Recipient group has no members' })
      return true
    case 'SCHEDULE_IN_PAST':
    case 'SCHEDULE_REQUIRED':
      res.status(400).json({ message: 'Scheduled time must be in the future' })
      return true
    case 'INVALID_TIME':
      res.status(400).json({ message: 'Invalid time of day' })
      return true
    case 'INVALID_DAY_OF_WEEK':
      res.status(400).json({ message: 'Invalid day of week (use 1=Monday … 7=Sunday)' })
      return true
    case 'INVALID_DAY_OF_MONTH':
      res.status(400).json({ message: 'Invalid day of month (1–31)' })
      return true
    case 'ALREADY_COMPLETED':
      res.status(400).json({ message: 'Completed schedules cannot be changed' })
      return true
    case 'CANNOT_RESCHEDULE':
      res.status(400).json({ message: 'Only active schedules can be rescheduled' })
      return true
    case 'CANNOT_EDIT_FAILED':
      res.status(400).json({ message: 'Failed schedules cannot be edited' })
      return true
    default:
      return false
  }
}

schedulesRouter.get('/', authorize('schedules', 'view'), async (_req, res) => {
  const schedules = await listReportSchedules()
  return res.json(schedules)
})

schedulesRouter.get('/reports', authorize('schedules', 'view'), async (_req, res) => {
  const reports = await listSchedulableReports()
  return res.json(reports)
})

schedulesRouter.get('/statements', authorize('schedules', 'view'), async (_req, res) => {
  const schedules = await listStatementSchedules()
  return res.json(schedules)
})

schedulesRouter.get('/statement-options', authorize('schedules', 'view'), async (_req, res) => {
  const statements = await listSchedulableStatements()
  return res.json(statements)
})

schedulesRouter.get('/groups', authorize('schedules', 'view'), async (_req, res) => {
  const groups = await listScheduleRecipientGroups()
  return res.json(groups)
})

schedulesRouter.get('/:id', authorize('schedules', 'view'), async (req, res) => {
  const schedule = await getReportScheduleById(paramId(req))
  if (!schedule) {
    return res.status(404).json({ message: 'Schedule not found' })
  }
  return res.json(schedule)
})

const createStatementScheduleSchema = z
  .object({
    statementId: z.string().min(1),
    groupId: z.string().min(1),
    recurrence: recurrenceEnum.default(ReportScheduleRecurrence.ONCE),
    scheduledAt: z.string().datetime().optional(),
    timeMinutes: z.number().int().min(0).max(1439).optional(),
    dayOfWeek: z.number().int().min(1).max(7).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    timezoneOffsetMinutes: z.number().int().min(-840).max(840).default(0),
  })
  .superRefine((data, ctx) => {
    if (data.recurrence === ReportScheduleRecurrence.ONCE && !data.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scheduledAt is required for one-time schedules',
        path: ['scheduledAt'],
      })
    }
    if (data.recurrence !== ReportScheduleRecurrence.ONCE && data.timeMinutes == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'timeMinutes is required for recurring schedules',
        path: ['timeMinutes'],
      })
    }
    if (
      data.recurrence === ReportScheduleRecurrence.WEEKLY &&
      data.dayOfWeek == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dayOfWeek is required for weekly schedules',
        path: ['dayOfWeek'],
      })
    }
    if (
      data.recurrence === ReportScheduleRecurrence.MONTHLY &&
      data.dayOfMonth == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dayOfMonth is required for monthly schedules',
        path: ['dayOfMonth'],
      })
    }
  })

schedulesRouter.post('/', authorize('schedules', 'schedule'), async (req, res) => {
  const parsed = createReportScheduleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() })
  }

  try {
    const schedule = await createReportSchedule({
      reportId: parsed.data.reportId,
      groupId: parsed.data.groupId,
      recurrence: parsed.data.recurrence,
      scheduledAt: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : undefined,
      timeMinutes: parsed.data.timeMinutes,
      dayOfWeek: parsed.data.dayOfWeek,
      dayOfMonth: parsed.data.dayOfMonth,
      timezoneOffsetMinutes: parsed.data.timezoneOffsetMinutes,
      createdById: req.authUser?.id,
    })
    return res.status(201).json(schedule)
  } catch (error) {
    if (mapScheduleError(error, res)) return
    throw error
  }
})

schedulesRouter.patch('/:id', authorize('schedules', 'edit'), async (req, res) => {
  const parsed = updateScheduleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  if (parsed.data.status && parsed.data.status !== 'ACTIVE' && parsed.data.status !== 'PAUSED') {
    return res.status(400).json({ message: 'Status can only be set to ACTIVE or PAUSED' })
  }

  try {
    const schedule = await updateReportSchedule(paramId(req), {
      scheduledAt: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : undefined,
      status: parsed.data.status,
      recurrence: parsed.data.recurrence,
      timeMinutes: parsed.data.timeMinutes,
      dayOfWeek: parsed.data.dayOfWeek,
      dayOfMonth: parsed.data.dayOfMonth,
      timezoneOffsetMinutes: parsed.data.timezoneOffsetMinutes,
    })
    return res.json(schedule)
  } catch (error) {
    if (mapScheduleError(error, res)) return
    throw error
  }
})

schedulesRouter.delete('/:id', authorize('schedules', 'delete'), async (req, res) => {
  try {
    await deleteReportSchedule(paramId(req))
    return res.status(204).send()
  } catch (error) {
    if (mapScheduleError(error, res)) return
    throw error
  }
})

schedulesRouter.get('/statements/:id', authorize('schedules', 'view'), async (req, res) => {
  const schedule = await getStatementScheduleById(paramId(req))
  if (!schedule) {
    return res.status(404).json({ message: 'Schedule not found' })
  }
  return res.json(schedule)
})

schedulesRouter.post('/statements', authorize('schedules', 'schedule'), async (req, res) => {
  const parsed = createStatementScheduleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() })
  }

  try {
    const schedule = await createStatementSchedule({
      statementId: parsed.data.statementId,
      groupId: parsed.data.groupId,
      recurrence: parsed.data.recurrence,
      scheduledAt: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : undefined,
      timeMinutes: parsed.data.timeMinutes,
      dayOfWeek: parsed.data.dayOfWeek,
      dayOfMonth: parsed.data.dayOfMonth,
      timezoneOffsetMinutes: parsed.data.timezoneOffsetMinutes,
      createdById: req.authUser?.id,
    })
    return res.status(201).json(schedule)
  } catch (error) {
    if (mapScheduleError(error, res)) return
    throw error
  }
})

schedulesRouter.patch('/statements/:id', authorize('schedules', 'edit'), async (req, res) => {
  const parsed = updateScheduleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  if (parsed.data.status && parsed.data.status !== 'ACTIVE' && parsed.data.status !== 'PAUSED') {
    return res.status(400).json({ message: 'Status can only be set to ACTIVE or PAUSED' })
  }

  try {
    const schedule = await updateStatementSchedule(paramId(req), {
      scheduledAt: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : undefined,
      status: parsed.data.status,
      recurrence: parsed.data.recurrence,
      timeMinutes: parsed.data.timeMinutes,
      dayOfWeek: parsed.data.dayOfWeek,
      dayOfMonth: parsed.data.dayOfMonth,
      timezoneOffsetMinutes: parsed.data.timezoneOffsetMinutes,
    })
    return res.json(schedule)
  } catch (error) {
    if (mapScheduleError(error, res)) return
    throw error
  }
})

schedulesRouter.delete('/statements/:id', authorize('schedules', 'delete'), async (req, res) => {
  try {
    await deleteStatementSchedule(paramId(req))
    return res.status(204).send()
  } catch (error) {
    if (mapScheduleError(error, res)) return
    throw error
  }
})
