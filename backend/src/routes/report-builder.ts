import { Router } from 'express'
import { z } from 'zod'
import {
  executeDataSourceQuery,
  getDataSourceTableColumns,
  listDataSourceTables,
} from '../datasources/service.js'
import { REPORT_MAX_ROWS } from '../datasources/postgres.js'
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

const tablesQuerySchema = z.object({
  dataSourceId: z.string().min(1),
  search: z.string().max(200).optional(),
})

const tableColumnsQuerySchema = z.object({
  dataSourceId: z.string().min(1),
  schema: z.string().min(1).max(128),
  table: z.string().min(1).max(128),
})

function handleDataSourceError(error: unknown, res: import('express').Response) {
  if (error instanceof Error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Data source not found' })
    }
    if (error.message === 'INACTIVE') {
      return res.status(400).json({ message: 'Data source is inactive' })
    }
    return res.status(400).json({ message: error.message })
  }
  return res.status(500).json({ message: 'Request failed' })
}

reportBuilderRouter.get('/schema/tables', authorize('report-builder', 'view'), async (req, res) => {
  const parsed = tablesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid query parameters' })
  }

  try {
    const tables = await listDataSourceTables(
      parsed.data.dataSourceId,
      parsed.data.search ?? '',
    )
    return res.json(tables)
  } catch (error) {
    return handleDataSourceError(error, res)
  }
})

reportBuilderRouter.get(
  '/schema/columns',
  authorize('report-builder', 'view'),
  async (req, res) => {
    const parsed = tableColumnsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid query parameters' })
    }

    try {
      const columns = await getDataSourceTableColumns(
        parsed.data.dataSourceId,
        parsed.data.schema,
        parsed.data.table,
      )
      return res.json(columns)
    } catch (error) {
      return handleDataSourceError(error, res)
    }
  },
)

reportBuilderRouter.post('/execute', authorize('report-builder', 'view'), async (req, res) => {
  const parsed = executeQuerySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  try {
    const sql = applySqlFilters(parsed.data.sql, parsed.data.filters ?? {})
    const result = await executeDataSourceQuery(parsed.data.dataSourceId, sql, REPORT_MAX_ROWS)
    return res.json(result)
  } catch (error) {
    return handleDataSourceError(error, res)
  }
})
