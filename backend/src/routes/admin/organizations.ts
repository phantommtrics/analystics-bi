import { Router } from 'express'
import { OrganizationStatus } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../prisma.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requireOwner } from '../../middleware/requireOwner.js'
import {
  getDirectPayPartnerConfig,
  provisionDirectPayBusiness,
  startDirectPaySubscription,
} from '../../directpay/client.js'
import {
  cachedOrganizationSubscription,
  syncOrganizationSubscription,
} from '../../directpay/subscription-sync.js'
import { paramId } from '../../utils/params.js'
import { env } from '../../env.js'

export const organizationsRouter = Router()

organizationsRouter.use(authenticate, requireOwner)

const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
  industry: z.string().max(80).optional(),
  billingOwnerEmail: z.string().email(),
  billingOwnerName: z.string().min(1).max(120),
})

const startSubscriptionSchema = z.object({
  planCode: z.string().optional(),
  billingInterval: z.string().optional(),
})

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatOrg(org: {
  id: string
  name: string
  slug: string
  industry: string | null
  status: OrganizationStatus
  billingOwnerEmail: string | null
  billingOwnerName: string | null
  directPayBusinessId: string | null
  directPaySlug: string | null
  subscriptionStatus: string | null
  subscriptionPlanCode: string | null
  subscriptionPeriodEnd: Date | null
  subscriptionSyncedAt: Date | null
  subscriptionPayUrl: string | null
  _count: { users: number }
}) {
  const subscription = cachedOrganizationSubscription(org)
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    industry: org.industry,
    status: org.status,
    billingOwnerEmail: org.billingOwnerEmail,
    billingOwnerName: org.billingOwnerName,
    directPayBusinessId: org.directPayBusinessId,
    directPaySlug: org.directPaySlug,
    userCount: org._count.users,
    subscription: {
      status: subscription.status,
      planCode: subscription.planCode,
      periodEnd: subscription.periodEnd,
      payUrl: org.subscriptionPayUrl,
      accessAllowed: subscription.accessAllowed,
      syncedAt: org.subscriptionSyncedAt?.toISOString() ?? null,
    },
  }
}

organizationsRouter.get('/', async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  })
  res.json(orgs.map(formatOrg))
})

organizationsRouter.post('/', async (req, res) => {
  const parsed = createOrgSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const existingCount = await prisma.organization.count()
  if (existingCount >= 1) {
    return res.status(409).json({
      message: 'Only one organization is allowed. Update or use the existing organization.',
    })
  }

  const slug = normalizeSlug(parsed.data.slug || parsed.data.name)
  const slugTaken = await prisma.organization.findUnique({ where: { slug } })
  if (slugTaken) {
    return res.status(409).json({ message: 'Organization slug already exists' })
  }

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: parsed.data.name.trim(),
        slug,
        industry: parsed.data.industry?.trim() || null,
        billingOwnerEmail: parsed.data.billingOwnerEmail.trim().toLowerCase(),
        billingOwnerName: parsed.data.billingOwnerName.trim(),
      },
      include: { _count: { select: { users: true } } },
    })

    await tx.user.update({
      where: { id: req.authUser!.id },
      data: { organizationId: created.id },
    })

    return created
  })

  res.status(201).json(formatOrg(org))
})

organizationsRouter.post('/:id/directpay/provision', async (req, res) => {
  const id = paramId(req)
  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    return res.status(404).json({ message: 'Organization not found' })
  }
  if (org.directPayBusinessId) {
    return res.json({
      ok: true,
      idempotentReplay: true,
      businessId: org.directPayBusinessId,
      slug: org.directPaySlug,
    })
  }

  const { configured } = getDirectPayPartnerConfig()
  if (!configured) {
    return res.status(503).json({ message: 'DirectPay partner API is not configured' })
  }

  if (!org.billingOwnerEmail || !org.billingOwnerName) {
    return res.status(400).json({ message: 'Billing owner email and name are required' })
  }

  const webhookUrl = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/api/webhooks/directpay`
  const data = await provisionDirectPayBusiness({
    externalUserId: org.id,
    ownerEmail: org.billingOwnerEmail,
    ownerName: org.billingOwnerName,
    businessName: org.name,
    slug: org.slug,
    industry: org.industry ?? undefined,
    webhookUrl,
  })

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      directPayBusinessId: data.businessId,
      directPaySlug: data.slug,
      directPaySubscriptionId: data.subscriptionId,
    },
  })

  res.status(data.idempotentReplay ? 200 : 201).json({
    ok: true,
    idempotentReplay: data.idempotentReplay,
    businessId: data.businessId,
    slug: data.slug,
    subscriptionId: data.subscriptionId,
  })
})

organizationsRouter.post('/:id/directpay/subscription', async (req, res) => {
  const id = paramId(req)
  const parsed = startSubscriptionSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    return res.status(404).json({ message: 'Organization not found' })
  }
  if (!org.directPayBusinessId) {
    return res.status(400).json({ message: 'Organization is not provisioned in DirectPay' })
  }

  const { configured } = getDirectPayPartnerConfig()
  if (!configured) {
    return res.status(503).json({ message: 'DirectPay partner API is not configured' })
  }

  const remote = await startDirectPaySubscription(org.directPayBusinessId, {
    planCode: parsed.data.planCode,
    billingInterval: parsed.data.billingInterval,
  })

  const synced = await syncOrganizationSubscription(org.id)
  res.status(201).json({
    subscription: synced,
    pendingInvoice: remote.pendingInvoice,
  })
})

organizationsRouter.post('/:id/directpay/sync', async (req, res) => {
  const id = paramId(req)
  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    return res.status(404).json({ message: 'Organization not found' })
  }
  if (!org.directPayBusinessId) {
    return res.status(400).json({ message: 'Organization is not provisioned in DirectPay' })
  }

  const subscription = await syncOrganizationSubscription(org.id)
  res.json({ subscription })
})
