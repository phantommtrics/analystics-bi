import { ReportCategory, StatementType } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, authorizeAny } from '../middleware/authorize.js'
import {
  parseStatementConfig,
  type StatementConfig,
} from '../statements/config.js'
import {
  createStatement,
  getStatementById,
  listAccessibleStatements,
  listStatementReports,
  listStatements,
  publishStatement,
  softDeleteStatement,
  unpublishStatement,
  updateStatement,
} from '../statements/service.js'
import { exportStatementFile } from '../statements/exportService.js'
import {
  ensureAllStatementPermissions,
  userCanExportStatement,
  userCanViewStatement,
} from '../statements/permissions.js'
import { paramId } from '../utils/params.js'

export const statementsRouter = Router()

statementsRouter.use(authenticate)

const viewStatements = authorizeAny([
  ['statements', 'view'],
  ['statement-builder', 'view'],
])

const editStatements = authorize('statement-builder', 'edit')
const deleteStatements = authorize('statement-builder', 'delete')

const categorySchema = z.nativeEnum(ReportCategory)
const typeSchema = z.nativeEnum(StatementType)

const configSchema = z.record(z.string(), z.unknown())

const createStatementSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  type: typeSchema,
  category: categorySchema.optional(),
  config: configSchema,
})

const updateStatementSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  type: typeSchema.optional(),
  category: categorySchema.optional(),
  config: configSchema.optional(),
})

function validationErrorBody(error: z.ZodError) {
  const first = error.issues[0]
  const detail = first
    ? `${first.path.length > 0 ? `${first.path.join('.')}: ` : ''}${first.message}`
    : 'Validation failed'
  return {
    message: detail,
    issues: error.flatten(),
  }
}

function parseConfigForType(type: StatementType, config: unknown): StatementConfig {
  return parseStatementConfig(type, config)
}

statementsRouter.get('/', viewStatements, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined
  const accessibleOnly = req.query.accessibleOnly === 'true'
  const permissions = req.authUser?.permissions ?? []

  let parsedCategory: ReportCategory | undefined
  if (typeof req.query.category === 'string' && req.query.category.length > 0) {
    const result = categorySchema.safeParse(req.query.category)
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid category filter' })
    }
    parsedCategory = result.data
  }

  let parsedType: StatementType | undefined
  if (typeof req.query.type === 'string' && req.query.type.length > 0) {
    const result = typeSchema.safeParse(req.query.type)
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid type filter' })
    }
    parsedType = result.data
  }

  if (accessibleOnly) {
    await ensureAllStatementPermissions()
    const statements = await listAccessibleStatements(
      permissions,
      search,
      parsedCategory,
      parsedType,
      req.authUser?.userType,
    )
    return res.json(statements)
  }

  const canUseBuilder =
    permissions.includes('*') || permissions.includes('statement-builder:view')
  if (!canUseBuilder) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const statements = await listStatements(search, parsedCategory, parsedType)
  return res.json(statements)
})

const exportFormatSchema = z.enum(['pdf', 'csv'])

statementsRouter.get('/:id/export', viewStatements, async (req, res) => {
  const statement = await getStatementById(paramId(req))
  if (!statement) {
    return res.status(404).json({ message: 'Statement not found' })
  }

  const permissions = req.authUser?.permissions ?? []
  const canUseBuilder =
    permissions.includes('*') || permissions.includes('statement-builder:view')
  const canViewCustom =
    statement.isPublished &&
    userCanViewStatement(permissions, statement.id, req.authUser?.userType)

  if (!canUseBuilder && !canViewCustom) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const formatResult = exportFormatSchema.safeParse(req.query.format)
  if (!formatResult.success) {
    return res.status(400).json({ message: 'Invalid format (use pdf or csv)' })
  }

  const exportAction = formatResult.data === 'pdf' ? 'export_pdf' : 'export_csv'
  if (
    !userCanExportStatement(
      permissions,
      statement.id,
      exportAction,
      req.authUser?.userType,
    )
  ) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const filters: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'format' || typeof value !== 'string') continue
    filters[key] = value.slice(0, 500)
  }

  const filterLabel =
    typeof req.query.filterLabel === 'string' ? req.query.filterLabel : undefined

  try {
    const file = await exportStatementFile(
      statement.id,
      formatResult.data,
      filters,
      filterLabel,
    )
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    return res.send(file.content)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message })
    }
    return res.status(500).json({ message: 'Export failed' })
  }
})

statementsRouter.get('/:id', viewStatements, async (req, res) => {
  const statement = await getStatementById(paramId(req))
  if (!statement) {
    return res.status(404).json({ message: 'Statement not found' })
  }

  const permissions = req.authUser?.permissions ?? []
  const canUseBuilder =
    permissions.includes('*') || permissions.includes('statement-builder:view')
  const canViewCustom =
    statement.isPublished &&
    userCanViewStatement(permissions, statement.id, req.authUser?.userType)

  if (!canUseBuilder && !canViewCustom) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  return res.json(statement)
})

statementsRouter.get('/:id/reports', viewStatements, async (req, res) => {
  const statement = await getStatementById(paramId(req))
  if (!statement) {
    return res.status(404).json({ message: 'Statement not found' })
  }

  const permissions = req.authUser?.permissions ?? []
  const canUseBuilder =
    permissions.includes('*') || permissions.includes('statement-builder:view')
  const canViewCustom =
    statement.isPublished &&
    userCanViewStatement(permissions, statement.id, req.authUser?.userType)

  if (!canUseBuilder && !canViewCustom) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  try {
    const reports = await listStatementReports(statement.id)
    return res.json(reports)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Statement not found' })
    }
    throw error
  }
})

statementsRouter.post('/:id/publish', editStatements, async (req, res) => {
  try {
    const statement = await publishStatement(paramId(req), req.authUser?.id)
    return res.json(statement)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Statement not found' })
    }
    throw error
  }
})

statementsRouter.post('/:id/unpublish', editStatements, async (req, res) => {
  try {
    const statement = await unpublishStatement(paramId(req), req.authUser?.id)
    return res.json(statement)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Statement not found' })
    }
    throw error
  }
})

statementsRouter.post('/', editStatements, async (req, res) => {
  const parsed = createStatementSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(validationErrorBody(parsed.error))
  }

  try {
    const config = parseConfigForType(parsed.data.type, parsed.data.config)
    const statement = await createStatement({
      name: parsed.data.name,
      description: parsed.data.description,
      type: parsed.data.type,
      category: parsed.data.category,
      config,
      createdById: req.authUser?.id,
    })
    return res.status(201).json(statement)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_NAME') {
        return res.status(409).json({ message: 'A statement with this name already exists' })
      }
      if (error.message === 'INVALID_REPORT') {
        return res.status(400).json({ message: 'One or more reports are invalid or deleted' })
      }
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json(validationErrorBody(error))
    }
    throw error
  }
})

statementsRouter.patch('/:id', editStatements, async (req, res) => {
  const parsed = updateStatementSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(validationErrorBody(parsed.error))
  }

  try {
    const existing = await getStatementById(paramId(req))
    if (!existing) {
      return res.status(404).json({ message: 'Statement not found' })
    }

    const nextType = parsed.data.type ?? existing.type
    const config = parsed.data.config
      ? parseConfigForType(nextType, parsed.data.config)
      : undefined

    const statement = await updateStatement(paramId(req), {
      name: parsed.data.name,
      description: parsed.data.description,
      type: parsed.data.type,
      category: parsed.data.category,
      config,
      updatedById: req.authUser?.id,
    })
    return res.json(statement)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Statement not found' })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return res.status(409).json({ message: 'A statement with this name already exists' })
      }
      if (error.message === 'INVALID_REPORT') {
        return res.status(400).json({ message: 'One or more reports are invalid or deleted' })
      }
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json(validationErrorBody(error))
    }
    throw error
  }
})

statementsRouter.delete('/:id', deleteStatements, async (req, res) => {
  try {
    await softDeleteStatement(paramId(req), req.authUser?.id)
    return res.status(204).send()
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Statement not found' })
    }
    throw error
  }
})
