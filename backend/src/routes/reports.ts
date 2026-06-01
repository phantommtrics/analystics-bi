import { ReportCategory, ReportVisualization } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, authorizeAny } from '../middleware/authorize.js'
import { executeDataSourceQuery } from '../datasources/service.js'
import { dashboardContainsReport } from '../dashboards/service.js'
import { userCanViewDashboard } from '../dashboards/permissions.js'
import {
  createSavedReport,
  getSavedReportById,
  listAccessibleReports,
  listAccessibleSidebarReports,
  listSavedReports,
  publishSavedReport,
  restoreSavedReport,
  softDeleteSavedReport,
  unpublishSavedReport,
  updateSavedReport,
} from '../reports/service.js'
import {
  ensureAllReportPermissions,
  userCanViewReport,
} from '../reports/permissions.js'
import { applySqlFilters } from '../reports/sqlFilters.js'
import { paramId } from '../utils/params.js'

export const reportsRouter = Router()

reportsRouter.use(authenticate)

const viewReports = authorizeAny([
  ['reports', 'view'],
  ['report-builder', 'view'],
])

const editReports = authorizeAny([
  ['report-builder', 'edit'],
  ['reports', 'edit'],
])

const deleteReports = authorizeAny([
  ['report-builder', 'delete'],
  ['reports', 'delete'],
])

const categorySchema = z.nativeEnum(ReportCategory)
const visualizationSchema = z.nativeEnum(ReportVisualization)

const createReportSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: categorySchema.default(ReportCategory.GENERAL),
  showInSidebarMenu: z.boolean().optional(),
  sql: z.string().min(1).max(100_000),
  visualization: visualizationSchema.default(ReportVisualization.BAR_CHART),
  dataSourceId: z.string().min(1),
})

const updateReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: categorySchema.optional(),
  showInSidebarMenu: z.boolean().optional(),
  sql: z.string().min(1).max(100_000).optional(),
  visualization: visualizationSchema.optional(),
  dataSourceId: z.string().min(1).optional(),
})

const executeReportSchema = z.object({
  filters: z.record(z.string(), z.string().max(500)).optional(),
  dashboardId: z.string().min(1).optional(),
})

function canUseReportBuilder(permissions: string[]) {
  return (
    permissions.includes('*') ||
    permissions.includes('report-builder:view') ||
    permissions.includes('dashboard-builder:view')
  )
}

reportsRouter.get('/', viewReports, async (req, res) => {
  const category = req.query.category
  const search = typeof req.query.search === 'string' ? req.query.search : undefined
  const includeDeleted = req.query.includeDeleted === 'true'
  const accessibleOnly = req.query.accessibleOnly === 'true'
  const sidebarMenuOnly = req.query.sidebarMenuOnly === 'true'
  const permissions = req.authUser?.permissions ?? []

  let parsedCategory: ReportCategory | undefined
  if (typeof category === 'string' && category.length > 0) {
    const result = categorySchema.safeParse(category)
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid category filter' })
    }
    parsedCategory = result.data
  }

  if (accessibleOnly) {
    await ensureAllReportPermissions()
    if (sidebarMenuOnly) {
      const reports = await listAccessibleSidebarReports(
        permissions,
        req.authUser?.userType,
      )
      const filtered = parsedCategory
        ? reports.filter((r) => r.category === parsedCategory)
        : reports
      return res.json(filtered)
    }
    const reports = await listAccessibleReports(
      permissions,
      { category: parsedCategory, search },
      req.authUser?.userType,
    )
    return res.json(reports)
  }

  if (!canUseReportBuilder(permissions)) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const reports = await listSavedReports({
    category: parsedCategory,
    search,
    includeDeleted,
  })
  return res.json(reports)
})

reportsRouter.post('/:id/publish', editReports, async (req, res) => {
  try {
    const report = await publishSavedReport(paramId(req), req.authUser?.id)
    return res.json(report)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Report not found' })
    }
    throw error
  }
})

reportsRouter.post('/:id/unpublish', editReports, async (req, res) => {
  try {
    const report = await unpublishSavedReport(paramId(req), req.authUser?.id)
    return res.json(report)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Report not found' })
    }
    throw error
  }
})

reportsRouter.post('/:id/execute', async (req, res) => {
  const parsed = executeReportSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const report = await getSavedReportById(paramId(req))
  if (!report) {
    return res.status(404).json({ message: 'Report not found' })
  }

  const permissions = req.authUser?.permissions ?? []
  const canUseBuilder = canUseReportBuilder(permissions)
  const canViewCatalog =
    report.isPublished && userCanViewReport(permissions, report.id, req.authUser?.userType)

  let canExecuteViaDashboard = false
  if (parsed.data.dashboardId) {
    const inDashboard = await dashboardContainsReport(parsed.data.dashboardId, report.id)
    canExecuteViaDashboard =
      inDashboard &&
      userCanViewDashboard(
        permissions,
        parsed.data.dashboardId,
        req.authUser?.userType,
      )
  }

  if (!canUseBuilder && !canViewCatalog && !canExecuteViaDashboard) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  if (!report.dataSourceActive) {
    return res.status(400).json({ message: 'Data source is inactive' })
  }

  try {
    const sql = applySqlFilters(report.sql, parsed.data.filters ?? {})
    const result = await executeDataSourceQuery(report.dataSourceId, sql)
    return res.json(result)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message })
    }
    return res.status(500).json({ message: 'Query execution failed' })
  }
})

reportsRouter.get('/:id', viewReports, async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true'
  const report = await getSavedReportById(paramId(req), { includeDeleted })
  if (!report) {
    return res.status(404).json({ message: 'Report not found' })
  }

  const permissions = req.authUser?.permissions ?? []
  const canUseBuilder = canUseReportBuilder(permissions)
  const canViewCatalog =
    report.isPublished && userCanViewReport(permissions, report.id, req.authUser?.userType)

  if (!canUseBuilder && !canViewCatalog) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  return res.json(report)
})

reportsRouter.post('/', editReports, async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  try {
    const report = await createSavedReport({
      ...parsed.data,
      createdById: req.authUser?.id,
    })
    return res.status(201).json(report)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_NAME') {
        return res.status(409).json({ message: 'A report with this name already exists' })
      }
      if (error.message === 'DATA_SOURCE_NOT_FOUND') {
        return res.status(400).json({ message: 'Data source not found' })
      }
    }
    throw error
  }
})

reportsRouter.patch('/:id', editReports, async (req, res) => {
  const parsed = updateReportSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  try {
    const report = await updateSavedReport(paramId(req), {
      ...parsed.data,
      updatedById: req.authUser?.id,
    })
    return res.json(report)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Report not found' })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return res.status(409).json({ message: 'A report with this name already exists' })
      }
      if (error.message === 'DATA_SOURCE_NOT_FOUND') {
        return res.status(400).json({ message: 'Data source not found' })
      }
    }
    throw error
  }
})

reportsRouter.delete('/:id', deleteReports, async (req, res) => {
  try {
    await softDeleteSavedReport(paramId(req), req.authUser?.id)
    return res.status(204).send()
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Report not found' })
    }
    throw error
  }
})

reportsRouter.post('/:id/restore', editReports, async (req, res) => {
  try {
    const report = await restoreSavedReport(paramId(req))
    return res.json(report)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Deleted report not found' })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return res.status(409).json({
          message: 'Cannot restore: another active report uses this name',
        })
      }
    }
    throw error
  }
})
