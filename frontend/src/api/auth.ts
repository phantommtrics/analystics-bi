const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'

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
  }
  invoiceCreated: boolean
}

export async function openPayInDirectPay(accessToken: string): Promise<PayInDirectPayResult> {
  const response = await fetch(`${API_BASE}/auth/subscription/pay-in-directpay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((body as { message?: string }).message ?? 'Failed to open DirectPay payment')
  }

  return body as PayInDirectPayResult
}

export async function launchPayInDirectPay(accessToken: string): Promise<PayInDirectPayResult> {
  const result = await openPayInDirectPay(accessToken)
  window.open(result.payUrl, '_blank', 'noopener,noreferrer')
  return result
}
