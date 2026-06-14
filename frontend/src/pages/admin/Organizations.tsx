import { useCallback, useEffect, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { LoadingButton } from '../../components/ui/LoadingButton'
import { adminApi, type OrganizationSummary } from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'
import { Navigate } from 'react-router-dom'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-text-primary">{children}</label>
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none transition focus:border-brand-blue ${props.className ?? ''}`}
    />
  )
}

function statusVariant(status: string | null): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'ACTIVE' || status === 'TRIALING') return 'green'
  if (status === 'PAST_DUE') return 'amber'
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'red'
  return 'gray'
}

export function Organizations() {
  const { accessToken, user, refreshUser } = useAuth()
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    industry: '',
    billingOwnerEmail: '',
    billingOwnerName: '',
  })

  if (user?.userType !== 'OWNER') {
    return <Navigate to="/" replace />
  }

  const hasOrg = orgs.length >= 1

  const loadData = useCallback(async () => {
    if (!accessToken) return
    const list = await adminApi.listOrganizations(accessToken)
    setOrgs(list)
    setShowForm(list.length === 0)
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [accessToken, loadData])

  useEffect(() => {
    if (user?.email && !form.billingOwnerEmail) {
      setForm((f) => ({
        ...f,
        billingOwnerEmail: user.email,
        billingOwnerName: f.billingOwnerName || user.displayName || user.username,
      }))
    }
  }, [user, form.billingOwnerEmail])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || hasOrg) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await adminApi.createOrganization(accessToken, {
        name: form.name,
        slug: form.slug || undefined,
        industry: form.industry || undefined,
        billingOwnerEmail: form.billingOwnerEmail,
        billingOwnerName: form.billingOwnerName,
      })
      setSuccess('Organization created')
      setShowForm(false)
      await refreshUser()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function provision(org: OrganizationSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await adminApi.provisionDirectPay(accessToken, org.id)
      setSuccess(`DirectPay provisioned for ${org.name}`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provision failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function startSubscription(org: OrganizationSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await adminApi.startDirectPaySubscription(accessToken, org.id)
      setSuccess(`Corporate plan subscription started for ${org.name}`)
      if (result.subscription.payUrl) {
        setSuccess(
          `${result.subscription.payUrl ? 'Subscription started. Use Pay in DirectPay when ready.' : 'Subscription started.'}`,
        )
      }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Start subscription failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function syncSubscription(org: OrganizationSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    try {
      await adminApi.syncDirectPaySubscription(accessToken, org.id)
      setSuccess(`Subscription synced for ${org.name}`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Organization" />
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {!hasOrg && !loading && (
          <p className="mb-4 text-sm text-text-secondary">
            Create your organization once, then provision DirectPay and start the Corporate
            subscription. Subscription payment is completed in DirectPay (see Pay button after
            starting subscription).
          </p>
        )}

        {!hasOrg && showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create organization</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreate} className="space-y-4 p-4 pt-0">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <FieldInput
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Slug (optional)</FieldLabel>
                  <FieldInput
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Industry</FieldLabel>
                  <FieldInput
                    value={form.industry}
                    onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Billing owner email</FieldLabel>
                  <FieldInput
                    required
                    type="email"
                    value={form.billingOwnerEmail}
                    onChange={(e) => setForm((f) => ({ ...f, billingOwnerEmail: e.target.value }))}
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    Used for DirectPay login and subscription invoices. Use your email to pay as
                    the billing owner.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Billing owner name</FieldLabel>
                  <FieldInput
                    required
                    value={form.billingOwnerName}
                    onChange={(e) => setForm((f) => ({ ...f, billingOwnerName: e.target.value }))}
                  />
                </div>
              </div>
              <LoadingButton type="submit" loading={actionLoading}>
                Create organization
              </LoadingButton>
            </form>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{hasOrg ? 'Your organization' : 'Organization'}</CardTitle>
          </CardHeader>
          {loading ? (
            <p className="p-4 text-sm text-text-secondary">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="p-4 text-sm text-text-secondary">
              No organization yet. Create one above to get started.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {orgs.map((org) => (
                <div key={org.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary">{org.name}</p>
                    <p className="text-xs text-text-secondary">
                      {org.slug}
                      {org.directPayBusinessId ? ` · DirectPay ${org.directPayBusinessId}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Billing: {org.billingOwnerEmail ?? '—'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(org.subscription.status)}>
                        {org.subscription.status ?? 'Not started'}
                      </Badge>
                      {org.subscription.planCode && (
                        <span className="text-xs text-text-secondary">{org.subscription.planCode}</span>
                      )}
                      {org.subscription.periodEnd && (
                        <span className="text-xs text-text-secondary">
                          until {new Date(org.subscription.periodEnd).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!org.directPayBusinessId && (
                      <LoadingButton
                        type="button"
                        loading={actionLoading}
                        onClick={() => provision(org)}
                      >
                        Provision DirectPay
                      </LoadingButton>
                    )}
                    {org.directPayBusinessId && !org.subscription.status && (
                      <LoadingButton
                        type="button"
                        loading={actionLoading}
                        onClick={() => startSubscription(org)}
                      >
                        Start Corporate Plan
                      </LoadingButton>
                    )}
                    {org.subscription.payUrl && (
                      <a
                        href={org.subscription.payUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        Pay in DirectPay
                      </a>
                    )}
                    {org.directPayBusinessId && (
                      <LoadingButton
                        type="button"
                        loading={actionLoading}
                        variant="secondary"
                        onClick={() => syncSubscription(org)}
                      >
                        Sync
                      </LoadingButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
