import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { SubscriptionBlocked } from '../pages/SubscriptionBlocked'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-text-secondary">
        Loading session...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const onChangePassword = location.pathname === '/change-password'
  if (user.mustChangePassword && !onChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (!user.mustChangePassword && onChangePassword) {
    return <Navigate to="/" replace />
  }

  const ownerBypass = user.userType === 'OWNER'
  const subscriptionOk = user.subscription?.accessAllowed !== false
  if (!ownerBypass && !subscriptionOk && !onChangePassword) {
    return <SubscriptionBlocked />
  }

  return <Outlet />
}
