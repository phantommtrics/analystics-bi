import { Router } from 'express'
import { z } from 'zod'
import {
  AUDIT_PAGE_SIZE,
  auditLogsToCsv,
  listAuditLogs,
  listAuditLogsForExport,
  listDistinctActions,
} from '../audit/service.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(AUDIT_PAGE_SIZE).default(AUDIT_PAGE_SIZE),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  user: z.string().optional(),
  action: z.string().optional(),
})

export const auditLogsRouter = Router()

auditLogsRouter.use(authenticate)
auditLogsRouter.use(authorize('audit', 'view'))

auditLogsRouter.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid query parameters' })
  }

  const { page, pageSize, dateFrom, dateTo, user, action } = parsed.data
  const result = await listAuditLogs({ dateFrom, dateTo, user, action }, page, pageSize)
  return res.json(result)
})

auditLogsRouter.get('/actions', async (_req, res) => {
  const actions = await listDistinctActions()
  return res.json({ actions })
})

auditLogsRouter.get('/export', authorize('audit', 'export_csv'), async (req, res) => {
  const parsed = listQuerySchema.omit({ page: true, pageSize: true }).safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid query parameters' })
  }

  const { dateFrom, dateTo, user, action } = parsed.data
  const rows = await listAuditLogsForExport({ dateFrom, dateTo, user, action })
  const csv = auditLogsToCsv(rows)
  const stamp = new Date().toISOString().slice(0, 10)

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`)
  return res.send(csv)
})
