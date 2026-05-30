import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { dashboardLayoutSchema } from '../dashboards/layout.js'
import {
  createDashboard,
  getDashboardById,
  listAccessibleDashboards,
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

export const dashboardsRouter = Router()

dashboardsRouter.use(authenticate)

const editDashboards = authorize('dashboard-builder', 'edit')

const deleteDashboards = authorize('dashboard-builder', 'delete')

const createDashboardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  layout: dashboardLayoutSchema.optional(),
})

const updateDashboardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  layout: dashboardLayoutSchema.optional(),
})

dashboardsRouter.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined
  const accessibleOnly = req.query.accessibleOnly === 'true'
  const permissions = req.authUser?.permissions ?? []

  if (accessibleOnly) {
    await ensureAllDashboardPermissions()
    const dashboards = await listAccessibleDashboards(
      permissions,
      search,
      req.authUser?.userType,
    )
    return res.json(dashboards)
  }

  const canUseBuilder =
    permissions.includes('*') || permissions.includes('dashboard-builder:view')
  const canViewMain = permissions.includes('*') || permissions.includes('dashboard:view')
  if (!canUseBuilder && !canViewMain) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const dashboards = await listDashboards(search)
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

  try {
    const dashboard = await createDashboard({
      ...parsed.data,
      createdById: req.authUser?.id,
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
