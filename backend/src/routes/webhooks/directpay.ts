import { Router, raw } from 'express'
import { prisma } from '../../prisma.js'
import { verifyDirectPayWebhookSignature } from '../../directpay/client.js'
import { syncOrganizationSubscription } from '../../directpay/subscription-sync.js'

export const directPayWebhooksRouter = Router()

directPayWebhooksRouter.post(
  '/directpay',
  raw({ type: 'application/json' }),
  async (req, res) => {
    const rawBody =
      req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body ?? {})
    const signature = req.headers['x-easypay-signature'] as string | undefined

    if (!verifyDirectPayWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ message: 'Invalid webhook signature' })
    }

    let payload: {
      event?: string
      partnerProvisioningExternalUserId?: string | null
      businessId?: string
    }
    try {
      payload = JSON.parse(rawBody) as typeof payload
    } catch {
      return res.status(400).json({ message: 'Invalid JSON' })
    }

    if (payload.event !== 'subscription.updated') {
      return res.status(204).send()
    }

    const externalId = payload.partnerProvisioningExternalUserId?.trim()
    if (!externalId) {
      return res.status(204).send()
    }

    const org = await prisma.organization.findFirst({
      where: { id: externalId },
      select: { id: true },
    })
    if (!org) {
      return res.status(204).send()
    }

    try {
      await syncOrganizationSubscription(org.id)
    } catch (err) {
      console.error('[webhook/directpay] sync failed:', err)
      return res.status(500).json({ message: 'Sync failed' })
    }

    return res.status(204).send()
  },
)
