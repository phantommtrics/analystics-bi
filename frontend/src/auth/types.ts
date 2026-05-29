export type UserType = 'OWNER' | 'SYSTEM_USER'

export interface AuthUser {
  id: string
  username: string
  email: string
  displayName?: string | null
  userType: UserType
  mustChangePassword?: boolean
  permissions: string[]
}
