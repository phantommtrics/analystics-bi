export type UserType = 'OWNER' | 'SYSTEM_USER'

export interface SubscriptionInfo {
  status: string | null
  planCode: string | null
  periodEnd: string | null
  payUrl: string | null
  accessAllowed: boolean
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
