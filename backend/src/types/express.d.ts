import type { UserType } from '@prisma/client'
import type { OrganizationSubscriptionView } from '../directpay/subscription-sync.js'

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string
        userType: UserType
        username: string
        email: string
        displayName: string | null
        permissions: string[]
        mustChangePassword: boolean
        organizationId: string | null
      }
      subscription?: OrganizationSubscriptionView
    }
  }
}

export {}
