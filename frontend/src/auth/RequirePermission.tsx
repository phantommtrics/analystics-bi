import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

interface RequirePermissionProps {
  moduleKey: string
  actionKey?: string
  children: ReactNode
}

export function RequirePermission({
  moduleKey,
  actionKey = 'view',
  children,
}: RequirePermissionProps) {
  const { hasPermission } = useAuth()
  if (!hasPermission(moduleKey, actionKey)) {
    return <Navigate to="/" replace />
  }
  return children
}
