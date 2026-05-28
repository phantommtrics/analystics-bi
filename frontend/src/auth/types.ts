export type UserType = 'OWNER' | 'SYSTEM_USER'

export interface AuthUser {
  id: string
  username: string
  email: string
  userType: UserType
  permissions: string[]
}
