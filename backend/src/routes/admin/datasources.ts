import { Router } from 'express'
import { SslMode } from '@prisma/client'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize, authorizeAny } from '../../middleware/authorize.js'
import {
  createDataSource,
  deleteDataSource,
  listDataSources,
  testDataSourceConnection,
  updateDataSource,
} from '../../datasources/service.js'
import { paramId } from '../../utils/params.js'
import { organizationWhere, resolveOrganizationId } from '../../organization/scope.js'

export const datasourcesRouter = Router()

datasourcesRouter.use(authenticate)

const sslModeSchema = z.nativeEnum(SslMode)

const createDataSourceSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1).max(100),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(500),
  sslMode: sslModeSchema.default(SslMode.REQUIRE),
  isActive: z.boolean().optional(),
})

const updateDataSourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  database: z.string().min(1).max(100).optional(),
  username: z.string().min(1).max(100).optional(),
  password: z.string().min(1).max(500).optional(),
  sslMode: sslModeSchema.optional(),
  isActive: z.boolean().optional(),
})

datasourcesRouter.get(
  '/',
  authorizeAny([
    ['system-config-datasources', 'view'],
    ['report-builder', 'view'],
  ]),
  async (req, res) => {
    const activeOnly = req.query.active === 'true'
    const orgFilter = await organizationWhere(req)
    const dataSources = await listDataSources(
      activeOnly,
      orgFilter.organizationId,
    )
    return res.json(dataSources)
  },
)

datasourcesRouter.post('/', authorize('system-config-datasources', 'edit'), async (req, res) => {
  const parsed = createDataSourceSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const organizationId = await resolveOrganizationId(req)
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization context required' })
  }

  try {
    const dataSource = await createDataSource({
      ...parsed.data,
      createdById: req.authUser?.id,
      organizationId,
    })
    return res.status(201).json(dataSource)
  } catch {
    return res.status(409).json({ message: 'Data source name already exists' })
  }
})

datasourcesRouter.patch(
  '/:id',
  authorize('system-config-datasources', 'edit'),
  async (req, res) => {
    const parsed = updateDataSourceSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload' })
    }

    try {
      const dataSource = await updateDataSource(paramId(req), parsed.data)
      return res.json(dataSource)
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Data source not found' })
      }
      return res.status(409).json({ message: 'Data source name already exists' })
    }
  },
)

datasourcesRouter.delete(
  '/:id',
  authorize('system-config-datasources', 'delete'),
  async (req, res) => {
    try {
      await deleteDataSource(paramId(req))
      return res.status(204).send()
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Data source not found' })
      }
      throw error
    }
  },
)

datasourcesRouter.post(
  '/:id/test',
  authorize('system-config-datasources', 'view'),
  async (req, res) => {
    try {
      const result = await testDataSourceConnection(paramId(req))
      return res.json(result)
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Data source not found' })
      }
      throw error
    }
  },
)
