import { ReportScheduleStatus } from '@prisma/client'
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
import { paramId } from '../utils/params.js'

export const schedulesRouter = Router()

schedulesRouter.use(authenticate)

const createScheduleSchema = z.object({
  reportId: z.string().min(1),
  groupId: z.string().min(1),
  scheduledAt: z.string().datetime(),
})

const updateScheduleSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  status: z.nativeEnum(ReportScheduleStatus).optional(),
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
    case 'GROUP_NOT_FOUND':
      res.status(400).json({ message: 'Recipient group not found' })
      return true
    case 'GROUP_EMPTY':
      res.status(400).json({ message: 'Recipient group has no members' })
      return true
    case 'SCHEDULE_IN_PAST':
      res.status(400).json({ message: 'Scheduled time must be in the future' })
      return true
    case 'ALREADY_COMPLETED':
      res.status(400).json({ message: 'Completed schedules cannot be changed' })
      return true
    case 'CANNOT_RESCHEDULE':
      res.status(400).json({ message: 'Only active schedules can be rescheduled' })
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

schedulesRouter.post('/', authorize('schedules', 'schedule'), async (req, res) => {
  const parsed = createScheduleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  try {
    const schedule = await createReportSchedule({
      reportId: parsed.data.reportId,
      groupId: parsed.data.groupId,
      scheduledAt: new Date(parsed.data.scheduledAt),
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
