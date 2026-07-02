import { useState } from 'react'
import { launchPayInDirectPay } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { LoadingButton } from '../components/ui/LoadingButton'

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function SubscriptionBlocked() {
  const { user, accessToken, logout, refreshUser } = useAuth()
  const sub = user?.subscription
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function renewInDirectPay() {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      await launchPayInDirectPay(accessToken)
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open DirectPay payment')
    } finally {
      setLoading(false)
    }
  }

  const canPay = Boolean(user?.organization)

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-bg-secondary p-8 text-center shadow-sm">
        <i className="ti ti-lock mb-4 text-5xl text-amber-500" aria-hidden />
        <h1 className="mb-2 text-xl font-semibold text-text-primary">Subscription required</h1>
        <p className="mb-4 text-sm text-text-secondary">
          analytics-bi access is paused until your DirectPay subscription is active or renewed.
        </p>
        {sub?.status && (
          <p className="mb-1 text-sm text-text-secondary">
            Status: <span className="font-medium text-text-primary">{sub.status}</span>
          </p>
        )}
        {sub?.periodEnd && (
          <p className="mb-4 text-sm text-text-secondary">
            Period ended: {formatDate(sub.periodEnd)}
          </p>
        )}
        {error && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {canPay ? (
          <LoadingButton
            type="button"
            loading={loading}
            className="mb-4 w-full"
            onClick={renewInDirectPay}
          >
            Renew in DirectPay
          </LoadingButton>
        ) : (
          <p className="mb-4 text-sm text-text-secondary">
            Contact your administrator to renew the subscription in DirectPay.
          </p>
        )}
        <button
          type="button"
          onClick={logout}
          className="text-sm text-text-secondary underline hover:text-text-primary"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
