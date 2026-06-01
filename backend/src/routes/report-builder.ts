import { Router } from 'express'
import { z } from 'zod'
import { executeDataSourceQuery } from '../datasources/service.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { applySqlFilters } from '../reports/sqlFilters.js'

export const reportBuilderRouter = Router()

reportBuilderRouter.use(authenticate)

const executeQuerySchema = z.object({
  dataSourceId: z.string().min(1),
  sql: z.string().min(1).max(50_000),
  filters: z.record(z.string(), z.string().max(500)).optional(),
})

reportBuilderRouter.post('/execute', authorize('report-builder', 'view'), async (req, res) => {
  const parsed = executeQuerySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  try {
    const sql = applySqlFilters(parsed.data.sql, parsed.data.filters ?? {})
    const result = await executeDataSourceQuery(parsed.data.dataSourceId, sql)
    return res.json(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Data source not found' })
      }
      if (error.message === 'INACTIVE') {
        return res.status(400).json({ message: 'Data source is inactive' })
      }
      return res.status(400).json({ message: error.message })
    }
    return res.status(500).json({ message: 'Query execution failed' })
  }
})
