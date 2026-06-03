import type { UserType } from '@prisma/client'

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
      }
    }
  }
}

export {}
