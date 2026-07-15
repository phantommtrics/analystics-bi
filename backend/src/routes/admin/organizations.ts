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
import { openOrganizationSubscriptionPay } from '../../directpay/open-pay.js'
import { invalidateOrganizationCache } from '../../organization/scope.js'
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
  isDefault: z.boolean().optional(),
})

const updateOrgSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(80).optional(),
  industry: z.string().max(80).optional().nullable(),
  billingOwnerEmail: z.string().email().optional(),
  billingOwnerName: z.string().min(1).max(120).optional(),
  isDefault: z.boolean().optional(),
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
  isDefault: boolean
  billingOwnerEmail: string | null
  billingOwnerName: string | null
  directPayBusinessId: string | null
  directPaySlug: string | null
  subscriptionStatus: string | null
  subscriptionPlanCode: string | null
  subscriptionPeriodEnd: Date | null
  subscriptionSyncedAt: Date | null
  subscriptionPayUrl: string | null
  subscriptionBillingAssigned: boolean
  subscriptionBillingTemplateId: string | null
  subscriptionBillingTemplateName: string | null
  subscriptionBillingAmount: string | null
  subscriptionBillingCurrency: string | null
  subscriptionBillingInterval: string | null
  _count: { users: number }
}) {
  const subscription = cachedOrganizationSubscription(org)
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    industry: org.industry,
    status: org.status,
    isDefault: org.isDefault,
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
      billing: subscription.billing,
      syncedAt: org.subscriptionSyncedAt?.toISOString() ?? null,
    },
  }
}

const orgInclude = { _count: { select: { users: true } } } as const

async function setDefaultOrganization(
  orgId: string,
  tx: Pick<typeof prisma, 'organization'> = prisma,
) {
  await tx.organization.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
  await tx.organization.update({ where: { id: orgId }, data: { isDefault: true } })
}

organizationsRouter.get('/', async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: orgInclude,
  })
  res.json(orgs.map(formatOrg))
})

organizationsRouter.post('/', async (req, res) => {
  const parsed = createOrgSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const slug = normalizeSlug(parsed.data.slug || parsed.data.name)
  const slugTaken = await prisma.organization.findUnique({ where: { slug } })
  if (slugTaken) {
    return res.status(409).json({ message: 'Organization slug already exists' })
  }

  const orgCount = await prisma.organization.count()
  const shouldBeDefault = parsed.data.isDefault ?? orgCount === 0

  const org = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.organization.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    }

    const created = await tx.organization.create({
      data: {
        name: parsed.data.name.trim(),
        slug,
        industry: parsed.data.industry?.trim() || null,
        billingOwnerEmail: parsed.data.billingOwnerEmail.trim().toLowerCase(),
        billingOwnerName: parsed.data.billingOwnerName.trim(),
        isDefault: shouldBeDefault,
      },
      include: orgInclude,
    })

    if (shouldBeDefault) {
      await tx.user.update({
        where: { id: req.authUser!.id },
        data: { organizationId: created.id },
      })
    }

    return created
  })

  invalidateOrganizationCache()
  res.status(201).json(formatOrg(org))
})

organizationsRouter.patch('/:id', async (req, res) => {
  const id = paramId(req)
  const parsed = updateOrgSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const existing = await prisma.organization.findUnique({ where: { id } })
  if (!existing) {
    return res.status(404).json({ message: 'Organization not found' })
  }

  let slug = existing.slug
  if (parsed.data.slug) {
    slug = normalizeSlug(parsed.data.slug)
    if (slug !== existing.slug) {
      const slugTaken = await prisma.organization.findUnique({ where: { slug } })
      if (slugTaken) {
        return res.status(409).json({ message: 'Organization slug already exists' })
      }
    }
  }

  const org = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await setDefaultOrganization(id, tx)
    }

    return tx.organization.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
        ...(parsed.data.slug !== undefined && { slug }),
        ...(parsed.data.industry !== undefined && {
          industry: parsed.data.industry?.trim() || null,
        }),
        ...(parsed.data.billingOwnerEmail !== undefined && {
          billingOwnerEmail: parsed.data.billingOwnerEmail.trim().toLowerCase(),
        }),
        ...(parsed.data.billingOwnerName !== undefined && {
          billingOwnerName: parsed.data.billingOwnerName.trim(),
        }),
      },
      include: orgInclude,
    })
  })

  invalidateOrganizationCache()
  res.json(formatOrg(org))
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
    // Corporate billing templates in DirectPay require industry "Corporate".
    industry: org.industry?.trim() || 'Corporate',
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
    billing: remote.billing,
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

organizationsRouter.post('/:id/directpay/pay-in-directpay', async (req, res) => {
  const id = paramId(req)
  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) {
    return res.status(404).json({ message: 'Organization not found' })
  }

  try {
    const result = await openOrganizationSubscriptionPay(org.id)
    res.json({
      payUrl: result.payUrl,
      pendingInvoice: result.pendingInvoice,
      subscription: result.subscription,
      invoiceCreated: result.invoiceCreated,
      billing: result.subscription.billing,
    })
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Failed to open DirectPay payment'
    if (status >= 500) {
      console.error('[admin/directpay/pay-in-directpay]', err)
    }
    return res.status(status).json({ message })
  }
})
