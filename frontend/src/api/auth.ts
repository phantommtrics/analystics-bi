import { apiFetch } from './client'

export type OrganizationBillingInfo =
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
      amount: string
      prices?: {
        monthly: string
        quarterly: string
        halfYearly: string
        yearly: string
        twoYears: string
        contract: string
      }
    }

export type PayInDirectPayResult = {
  payUrl: string
  pendingInvoice: {
    id: string
    amount: string
    currency: string
    status: string
    dueDate: string
    guestToken: string | null
  }
  subscription: {
    status: string | null
    planCode: string | null
    periodEnd: string | null
    payUrl: string | null
    accessAllowed: boolean
    billing: OrganizationBillingInfo
  }
  invoiceCreated: boolean
  billing: OrganizationBillingInfo
}

export async function openPayInDirectPay(accessToken: string): Promise<PayInDirectPayResult> {
  return apiFetch<PayInDirectPayResult>('/auth/subscription/pay-in-directpay', accessToken, {
    method: 'POST',
  })
}

export async function launchPayInDirectPay(accessToken: string): Promise<PayInDirectPayResult> {
  const result = await openPayInDirectPay(accessToken)
  window.open(result.payUrl, '_blank', 'noopener,noreferrer')
  return result
}
