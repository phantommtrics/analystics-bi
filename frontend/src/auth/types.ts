export type UserType = 'OWNER' | 'SYSTEM_USER'

export interface SubscriptionInfo {
  status: string | null
  planCode: string | null
  periodEnd: string | null
  payUrl: string | null
  accessAllowed: boolean
  billing?: OrganizationBillingInfo
}

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

export interface AuthUser {
  id: string
  username: string
  email: string
  displayName?: string | null
  userType: UserType
  mustChangePassword?: boolean
  permissions: string[]
  organization?: { id: string; name: string } | null
  subscription?: SubscriptionInfo
}
