import { prisma } from '../prisma.js'
import { getDirectPayPartnerConfig, issueDirectPaySubscriptionInvoice } from './client.js'
import { syncOrganizationSubscription, type OrganizationSubscriptionView } from './subscription-sync.js'

export type OpenOrganizationSubscriptionPayResult = {
  payUrl: string
  pendingInvoice: {
    id: string
    amount: string
    currency: string
    status: string
    dueDate: string
    guestToken: string | null
  }
  subscription: OrganizationSubscriptionView
  invoiceCreated: boolean
}

export async function openOrganizationSubscriptionPay(
  organizationId: string,
): Promise<OpenOrganizationSubscriptionPayResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, directPayBusinessId: true },
  })

  if (!org) {
    throw Object.assign(new Error('Organization not found'), { status: 404 })
  }
  if (!org.directPayBusinessId) {
    throw Object.assign(new Error('Organization is not provisioned in DirectPay'), { status: 400 })
  }

  const { configured } = getDirectPayPartnerConfig()
  if (!configured) {
    throw Object.assign(new Error('DirectPay partner API is not configured'), { status: 503 })
  }

  const remote = await issueDirectPaySubscriptionInvoice(org.directPayBusinessId)
  const subscription = await syncOrganizationSubscription(org.id)

  if (!remote.payUrl?.trim()) {
    throw Object.assign(new Error('No payable subscription invoice is available'), { status: 409 })
  }

  return {
    payUrl: remote.payUrl,
    pendingInvoice: remote.pendingInvoice!,
    subscription,
    invoiceCreated: remote.invoiceCreated,
  }
}
