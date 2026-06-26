import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { resolveOrganizationId } from '../organization/scope.js'
import { prisma } from '../prisma.js'
import {
  getPartnerAgentFloatConfig,
  getPartnerAgentFloatStatus,
  listPartnerAgentFloatDeliveries,
  previewAgentFloatSnapshot,
  runPartnerAgentFloatDelivery,
  updatePartnerAgentFloatConfig,
} from '../partner-agent-float/service.js'

export const partnerAgentFloatRouter = Router()

partnerAgentFloatRouter.use(authenticate)

async function requireOrganizationId(req: Parameters<typeof resolveOrganizationId>[0]) {
  const organizationId = await resolveOrganizationId(req)
  if (!organizationId) {
    return null
  }
  return organizationId
}

partnerAgentFloatRouter.get('/context', authorize('partner-agent-float', 'view'), async (req, res) => {
  const authUser = req.authUser!
  const organizationId = await resolveOrganizationId(req)

  if (authUser.userType === 'OWNER') {
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return res.json({
      organizationId,
      organizations,
      canSelectOrganization: organizations.length > 1,
    })
  }

  const organizations = authUser.organizationId
    ? await prisma.organization.findMany({
        where: { id: authUser.organizationId },
        select: { id: true, name: true },
      })
    : []

  res.json({
    organizationId: authUser.organizationId ?? organizationId,
    organizations,
    canSelectOrganization: false,
  })
})

partnerAgentFloatRouter.get('/config', authorize('partner-agent-float', 'view'), async (req, res) => {
  const organizationId = await requireOrganizationId(req)
  if (!organizationId) {
    return res.status(403).json({ message: 'Organization context required' })
  }
  const config = await getPartnerAgentFloatConfig(organizationId)
  res.json(config)
})

const updateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  apiUrl: z.string().optional(),
  partnerOrgCode: z.string().optional(),
  intervalMs: z.coerce.number().int().min(60_000).max(86_400_000).optional(),
  requestTimeoutMs: z.coerce.number().int().min(5_000).max(300_000).optional(),
  apiKey: z.string().optional(),
  hmacSecret: z.string().optional(),
  encryptionKey: z.string().optional(),
})

partnerAgentFloatRouter.patch(
  '/config',
  authorize('partner-agent-float', 'edit'),
  async (req, res) => {
    const organizationId = await requireOrganizationId(req)
    if (!organizationId) {
      return res.status(403).json({ message: 'Organization context required' })
    }
    try {
      const body = updateConfigSchema.parse(req.body)
      const config = await updatePartnerAgentFloatConfig(organizationId, body)
      res.json(config)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed'
      res.status(400).json({ message })
    }
  },
)

partnerAgentFloatRouter.get('/status', authorize('partner-agent-float', 'view'), async (req, res) => {
  const organizationId = await requireOrganizationId(req)
  if (!organizationId) {
    return res.status(403).json({ message: 'Organization context required' })
  }
  const status = await getPartnerAgentFloatStatus(organizationId)
  res.json(status)
})

partnerAgentFloatRouter.get(
  '/deliveries',
  authorize('partner-agent-float', 'view'),
  async (req, res) => {
    const organizationId = await requireOrganizationId(req)
    if (!organizationId) {
      return res.status(403).json({ message: 'Organization context required' })
    }
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query)

    const result = await listPartnerAgentFloatDeliveries(
      organizationId,
      query.page,
      query.pageSize,
    )
    res.json(result)
  },
)

partnerAgentFloatRouter.get(
  '/preview',
  authorize('partner-agent-float', 'view'),
  async (req, res) => {
    const organizationId = await requireOrganizationId(req)
    if (!organizationId) {
      return res.status(403).json({ message: 'Organization context required' })
    }
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(500).default(50),
      })
      .parse(req.query)

    const preview = await previewAgentFloatSnapshot(organizationId, query.limit)
    res.json(preview)
  },
)

partnerAgentFloatRouter.post('/run', authorize('partner-agent-float', 'edit'), async (req, res) => {
  const organizationId = await requireOrganizationId(req)
  if (!organizationId) {
    return res.status(403).json({ message: 'Organization context required' })
  }
  const user = req.authUser!
  try {
    const result = await runPartnerAgentFloatDelivery({
      organizationId,
      triggeredBy: user.id,
      userLabel: user.username,
    })
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Run failed'
    res.status(400).json({ message })
  }
})
