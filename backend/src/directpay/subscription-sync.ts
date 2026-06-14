import { prisma } from '../prisma.js'
import {
  buildGuestInvoicePayUrl,
  getDirectPaySubscription,
  isSubscriptionAccessAllowed,
} from './client.js'

export type OrganizationSubscriptionView = {
  status: string | null
  planCode: string | null
  periodEnd: string | null
  payUrl: string | null
  accessAllowed: boolean
  directPayBusinessId: string | null
}

export async function syncOrganizationSubscription(
  organizationId: string,
): Promise<OrganizationSubscriptionView> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      directPayBusinessId: true,
      subscriptionStatus: true,
      subscriptionPlanCode: true,
      subscriptionPeriodEnd: true,
    },
  })

  if (!org) {
    throw new Error('Organization not found')
  }

  if (!org.directPayBusinessId) {
    return {
      status: null,
      planCode: null,
      periodEnd: null,
      payUrl: null,
      accessAllowed: false,
      directPayBusinessId: null,
    }
  }

  const remote = await getDirectPaySubscription(org.directPayBusinessId)
  const sub = remote.subscription
  const status = sub?.status ?? null
  const planCode = sub?.plan.code ?? null
  const periodEnd = sub?.currentPeriodEnd ?? null
  const periodStart = sub?.currentPeriodStart ?? null
  const payUrl = buildGuestInvoicePayUrl(remote.pendingInvoice?.guestToken)

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      directPaySubscriptionId: sub?.id ?? null,
      subscriptionStatus: status,
      subscriptionPlanCode: planCode,
      subscriptionPeriodStart: periodStart ? new Date(periodStart) : null,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd) : null,
      subscriptionBillingInterval: sub?.billingInterval ?? null,
      subscriptionSyncedAt: new Date(),
      subscriptionPayUrl: payUrl,
    },
  })

  return {
    status,
    planCode,
    periodEnd,
    payUrl,
    accessAllowed: isSubscriptionAccessAllowed(status),
    directPayBusinessId: org.directPayBusinessId,
  }
}

export function cachedOrganizationSubscription(org: {
  directPayBusinessId: string | null
  subscriptionStatus: string | null
  subscriptionPlanCode: string | null
  subscriptionPeriodEnd: Date | null
  subscriptionPayUrl?: string | null
}): OrganizationSubscriptionView {
  return {
    status: org.subscriptionStatus,
    planCode: org.subscriptionPlanCode,
    periodEnd: org.subscriptionPeriodEnd?.toISOString() ?? null,
    payUrl: org.subscriptionPayUrl ?? null,
    accessAllowed: isSubscriptionAccessAllowed(org.subscriptionStatus),
    directPayBusinessId: org.directPayBusinessId,
  }
}
