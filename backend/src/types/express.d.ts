import type { UserType } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string
        userType: UserType
        permissions: string[]
        mustChangePassword: boolean
      }
    }
  }
}

export {}
