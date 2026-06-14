import { ReportCategory } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { dashboardLayoutSchema } from '../dashboards/layout.js'
import {
  createDashboard,
  getDashboardById,
  listAccessibleDashboards,
  listAccessibleSidebarDashboards,
  listDashboardReports,
  listDashboards,
  publishDashboard,
  softDeleteDashboard,
  unpublishDashboard,
  updateDashboard,
} from '../dashboards/service.js'
import {
  ensureAllDashboardPermissions,
  userCanViewDashboard,
} from '../dashboards/permissions.js'
import { paramId } from '../utils/params.js'
import { organizationWhere, resolveOrganizationId } from '../organization/scope.js'

export const dashboardsRouter = Router()

dashboardsRouter.use(authenticate)

const editDashboards = authorize('dashboard-builder', 'edit')

const deleteDashboards = authorize('dashboard-builder', 'delete')

const sidebarCategorySchema = z.nativeEnum(ReportCategory)

const createDashboardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  layout: dashboardLayoutSchema.optional(),
  showInSidebarMenu: z.boolean().optional(),
  sidebarCategory: sidebarCategorySchema.optional().nullable(),
})

const updateDashboardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  layout: dashboardLayoutSchema.optional(),
  showInSidebarMenu: z.boolean().optional(),
  sidebarCategory: sidebarCategorySchema.optional().nullable(),
})

dashboardsRouter.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined
  const accessibleOnly = req.query.accessibleOnly === 'true'
  const sidebarMenuOnly = req.query.sidebarMenuOnly === 'true'
  const permissions = req.authUser?.permissions ?? []
  const orgFilter = await organizationWhere(req)
  const organizationId = orgFilter.organizationId

  if (accessibleOnly) {
    await ensureAllDashboardPermissions()
    if (sidebarMenuOnly) {
      const dashboards = await listAccessibleSidebarDashboards(
        permissions,
        req.authUser?.userType,
      )
      return res.json(dashboards)
    }
    const dashboards = await listAccessibleDashboards(
      permissions,
      search,
      req.authUser?.userType,
      organizationId,
    )
    return res.json(
      dashboards.filter((dashboard) => !dashboard.showInSidebarMenu),
    )
  }

  const canUseBuilder =
    permissions.includes('*') || permissions.includes('dashboard-builder:view')
  const canViewMain = permissions.includes('*') || permissions.includes('dashboard:view')
  if (!canUseBuilder && !canViewMain) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const dashboards = await listDashboards(search, organizationId)
  return res.json(dashboards)
})

dashboardsRouter.get('/:id', async (req, res) => {
  const dashboard = await getDashboardById(paramId(req))
  if (!dashboard) {
    return res.status(404).json({ message: 'Dashboard not found' })
  }

  const permissions = req.authUser?.permissions ?? []
  const canUseBuilder = permissions.includes('*') ||
    permissions.includes('dashboard-builder:view')
  const canViewCustom =
    dashboard.isPublished &&
    userCanViewDashboard(permissions, dashboard.id, req.authUser?.userType)

  if (!canUseBuilder && !canViewCustom) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  return res.json(dashboard)
})

dashboardsRouter.get('/:id/reports', async (req, res) => {
  const dashboard = await getDashboardById(paramId(req))
  if (!dashboard) {
    return res.status(404).json({ message: 'Dashboard not found' })
  }

  const permissions = req.authUser?.permissions ?? []
  const canUseBuilder =
    permissions.includes('*') || permissions.includes('dashboard-builder:view')
  const canViewCustom =
    dashboard.isPublished &&
    userCanViewDashboard(permissions, dashboard.id, req.authUser?.userType)

  if (!canUseBuilder && !canViewCustom) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  try {
    const reports = await listDashboardReports(dashboard.id)
    return res.json(reports)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Dashboard not found' })
    }
    throw error
  }
})

dashboardsRouter.post('/:id/publish', editDashboards, async (req, res) => {
  try {
    const dashboard = await publishDashboard(paramId(req), req.authUser?.id)
    return res.json(dashboard)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Dashboard not found' })
    }
    throw error
  }
})

dashboardsRouter.post('/:id/unpublish', editDashboards, async (req, res) => {
  try {
    const dashboard = await unpublishDashboard(paramId(req), req.authUser?.id)
    return res.json(dashboard)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Dashboard not found' })
    }
    throw error
  }
})

dashboardsRouter.post('/', editDashboards, async (req, res) => {
  const parsed = createDashboardSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const organizationId = await resolveOrganizationId(req)
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization context required' })
  }

  try {
    const dashboard = await createDashboard({
      ...parsed.data,
      createdById: req.authUser?.id,
      organizationId,
    })
    return res.status(201).json(dashboard)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_NAME') {
        return res.status(409).json({ message: 'A dashboard with this name already exists' })
      }
      if (error.message === 'INVALID_REPORT') {
        return res.status(400).json({ message: 'One or more reports are invalid or deleted' })
      }
    }
    throw error
  }
})

dashboardsRouter.patch('/:id', editDashboards, async (req, res) => {
  const parsed = updateDashboardSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  try {
    const dashboard = await updateDashboard(paramId(req), {
      ...parsed.data,
      updatedById: req.authUser?.id,
    })
    return res.json(dashboard)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Dashboard not found' })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return res.status(409).json({ message: 'A dashboard with this name already exists' })
      }
      if (error.message === 'INVALID_REPORT') {
        return res.status(400).json({ message: 'One or more reports are invalid or deleted' })
      }
    }
    throw error
  }
})

dashboardsRouter.delete('/:id', deleteDashboards, async (req, res) => {
  try {
    await softDeleteDashboard(paramId(req), req.authUser?.id)
    return res.status(204).send()
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Dashboard not found' })
    }
    throw error
  }
})
