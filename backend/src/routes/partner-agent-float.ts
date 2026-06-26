import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import {
  getPartnerAgentFloatStatus,
  listPartnerAgentFloatDeliveries,
  previewAgentFloatSnapshot,
  runPartnerAgentFloatDelivery,
} from '../partner-agent-float/service.js'

export const partnerAgentFloatRouter = Router()

partnerAgentFloatRouter.use(authenticate)

partnerAgentFloatRouter.get('/status', authorize('partner-agent-float', 'view'), async (_req, res) => {
  const status = await getPartnerAgentFloatStatus()
  res.json(status)
})

partnerAgentFloatRouter.get(
  '/deliveries',
  authorize('partner-agent-float', 'view'),
  async (req, res) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query)

    const result = await listPartnerAgentFloatDeliveries(query.page, query.pageSize)
    res.json(result)
  },
)

partnerAgentFloatRouter.get(
  '/preview',
  authorize('partner-agent-float', 'view'),
  async (req, res) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(500).default(50),
      })
      .parse(req.query)

    const preview = await previewAgentFloatSnapshot(query.limit)
    res.json(preview)
  },
)

partnerAgentFloatRouter.post('/run', authorize('partner-agent-float', 'edit'), async (req, res) => {
  const user = req.authUser!
  try {
    const result = await runPartnerAgentFloatDelivery({
      triggeredBy: user.id,
      userLabel: user.username,
    })
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Run failed'
    res.status(400).json({ message })
  }
})
