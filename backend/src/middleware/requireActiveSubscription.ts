import type { NextFunction, Request, Response } from 'express'
import { UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import { cachedOrganizationSubscription } from '../directpay/subscription-sync.js'

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authUser = req.authUser
  if (!authUser) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (authUser.userType === UserType.OWNER) {
    return next()
  }

  if (!authUser.organizationId) {
    return res.status(402).json({
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'No organization assigned.',
      accessAllowed: false,
    })
  }

  const org = await prisma.organization.findUnique({
    where: { id: authUser.organizationId },
    select: {
      directPayBusinessId: true,
      subscriptionStatus: true,
      subscriptionPlanCode: true,
      subscriptionPeriodEnd: true,
      subscriptionPayUrl: true,
      subscriptionBillingAssigned: true,
      subscriptionBillingTemplateId: true,
      subscriptionBillingTemplateName: true,
      subscriptionBillingAmount: true,
      subscriptionBillingCurrency: true,
      subscriptionBillingInterval: true,
    },
  })

  if (!org) {
    return res.status(402).json({
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'Organization not found.',
      accessAllowed: false,
    })
  }

  const subscription = cachedOrganizationSubscription(org)
  if (!subscription.accessAllowed) {
    return res.status(402).json({
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'Subscription inactive or expired. Renew in DirectPay to restore access.',
      accessAllowed: false,
      status: subscription.status,
      periodEnd: subscription.periodEnd,
      planCode: subscription.planCode,
    })
  }

  req.subscription = subscription
  next()
}
