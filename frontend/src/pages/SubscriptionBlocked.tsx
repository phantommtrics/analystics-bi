import { useAuth } from '../auth/AuthContext'

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
  const { user, logout } = useAuth()
  const sub = user?.subscription

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
        {sub?.payUrl ? (
          <a
            href={sub.payUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 inline-flex w-full items-center justify-center rounded-md bg-brand-blue px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Renew in DirectPay
          </a>
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
