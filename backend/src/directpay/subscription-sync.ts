import { prisma } from '../prisma.js'
import { log } from '../utils/logger.js'
import {
  buildGuestInvoicePayUrl,
  getDirectPaySubscription,
  isSubscriptionAccessAllowed,
  type DirectPayBillingAssignment,
} from './client.js'

export type OrganizationBillingView =
  | {
      assigned: false
      message: 'No billing is assigned'
    }
  | {
      assigned: true
      templateId: string
      templateName: string
      billingInterval: string
      currency: string
      /** Price for the assigned billing interval (subscription revenue). */
      amount: string
      prices?: Extract<DirectPayBillingAssignment, { assigned: true }>['prices']
    }

export type OrganizationSubscriptionView = {
  status: string | null
  planCode: string | null
  periodEnd: string | null
  payUrl: string | null
  accessAllowed: boolean
  directPayBusinessId: string | null
  billing: OrganizationBillingView
}

const UNASSIGNED_BILLING: OrganizationBillingView = {
  assigned: false,
  message: 'No billing is assigned',
}

export function normalizeDirectPayBilling(
  billing: DirectPayBillingAssignment | null | undefined,
): OrganizationBillingView {
  if (!billing || !billing.assigned) {
    return UNASSIGNED_BILLING
  }
  return {
    assigned: true,
    templateId: billing.templateId,
    templateName: billing.templateName,
    billingInterval: billing.billingInterval,
    currency: billing.currency,
    amount: billing.amount,
    prices: billing.prices,
  }
}

export function billingFromOrganizationCache(org: {
  subscriptionBillingAssigned?: boolean | null
  subscriptionBillingTemplateId?: string | null
  subscriptionBillingTemplateName?: string | null
  subscriptionBillingAmount?: string | null
  subscriptionBillingCurrency?: string | null
  subscriptionBillingInterval?: string | null
}): OrganizationBillingView {
  if (
    !org.subscriptionBillingAssigned ||
    !org.subscriptionBillingTemplateId ||
    !org.subscriptionBillingTemplateName ||
    !org.subscriptionBillingAmount ||
    !org.subscriptionBillingCurrency ||
    !org.subscriptionBillingInterval
  ) {
    return UNASSIGNED_BILLING
  }
  return {
    assigned: true,
    templateId: org.subscriptionBillingTemplateId,
    templateName: org.subscriptionBillingTemplateName,
    billingInterval: org.subscriptionBillingInterval,
    currency: org.subscriptionBillingCurrency,
    amount: org.subscriptionBillingAmount,
  }
}

/** Persisted billing columns from a DirectPay `billing` payload (prices kept only on live API responses). */
export function billingColumnsForUpdate(billing: OrganizationBillingView) {
  if (!billing.assigned) {
    return {
      subscriptionBillingAssigned: false,
      subscriptionBillingTemplateId: null as string | null,
      subscriptionBillingTemplateName: null as string | null,
      subscriptionBillingAmount: null as string | null,
      subscriptionBillingCurrency: null as string | null,
    }
  }
  return {
    subscriptionBillingAssigned: true,
    subscriptionBillingTemplateId: billing.templateId,
    subscriptionBillingTemplateName: billing.templateName,
    subscriptionBillingAmount: billing.amount,
    subscriptionBillingCurrency: billing.currency,
  }
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
      billing: UNASSIGNED_BILLING,
    }
  }

  const remote = await getDirectPaySubscription(org.directPayBusinessId)
  const sub = remote.subscription
  const status = sub?.status ?? null
  const planCode = sub?.plan.code ?? null
  const periodEnd = sub?.currentPeriodEnd ?? null
  const periodStart = sub?.currentPeriodStart ?? null
  const payUrl = buildGuestInvoicePayUrl(remote.pendingInvoice?.guestToken)
  const billing = normalizeDirectPayBilling(remote.billing)

  log(
    'subscription-sync',
    `Synced org=${organizationId} status=${status ?? 'none'} plan=${planCode ?? 'none'} billing=${
      billing.assigned ? `${billing.amount} ${billing.currency}` : 'unassigned'
    }`,
  )

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      directPaySubscriptionId: sub?.id ?? null,
      subscriptionStatus: status,
      subscriptionPlanCode: planCode,
      subscriptionPeriodStart: periodStart ? new Date(periodStart) : null,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd) : null,
      subscriptionBillingInterval: billing.assigned
        ? billing.billingInterval
        : (sub?.billingInterval ?? null),
      subscriptionSyncedAt: new Date(),
      subscriptionPayUrl: payUrl,
      ...billingColumnsForUpdate(billing),
    },
  })

  return {
    status,
    planCode,
    periodEnd,
    payUrl,
    accessAllowed: isSubscriptionAccessAllowed(status),
    directPayBusinessId: org.directPayBusinessId,
    billing,
  }
}

export function cachedOrganizationSubscription(org: {
  directPayBusinessId: string | null
  subscriptionStatus: string | null
  subscriptionPlanCode: string | null
  subscriptionPeriodEnd: Date | null
  subscriptionPayUrl?: string | null
  subscriptionBillingAssigned?: boolean | null
  subscriptionBillingTemplateId?: string | null
  subscriptionBillingTemplateName?: string | null
  subscriptionBillingAmount?: string | null
  subscriptionBillingCurrency?: string | null
  subscriptionBillingInterval?: string | null
}): OrganizationSubscriptionView {
  return {
    status: org.subscriptionStatus,
    planCode: org.subscriptionPlanCode,
    periodEnd: org.subscriptionPeriodEnd?.toISOString() ?? null,
    payUrl: org.subscriptionPayUrl ?? null,
    accessAllowed: isSubscriptionAccessAllowed(org.subscriptionStatus),
    directPayBusinessId: org.directPayBusinessId,
    billing: billingFromOrganizationCache(org),
  }
}
