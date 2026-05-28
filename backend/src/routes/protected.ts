import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'

export const protectedRouter = Router()

protectedRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

protectedRouter.get('/reports', authenticate, authorize('reports', 'view'), (_req, res) => {
  res.json({ data: [], message: 'Reports access granted' })
})
