import { useCallback, useEffect, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { LoadingButton } from '../../components/ui/LoadingButton'
import { adminApi, type OrganizationSummary } from '../../api/admin'
import { launchPayInDirectPay } from '../../api/auth'
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

type OrgFormState = {
  name: string
  slug: string
  industry: string
  billingOwnerEmail: string
  billingOwnerName: string
  isDefault: boolean
}

const emptyForm = (): OrgFormState => ({
  name: '',
  slug: '',
  industry: '',
  billingOwnerEmail: '',
  billingOwnerName: '',
  isDefault: false,
})

export function Organizations() {
  const { accessToken, user, refreshUser } = useAuth()
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<OrgFormState>(emptyForm())
  const [editForm, setEditForm] = useState<OrgFormState>(emptyForm())

  if (user?.userType !== 'OWNER') {
    return <Navigate to="/" replace />
  }

  const loadData = useCallback(async () => {
    if (!accessToken) return
    const list = await adminApi.listOrganizations(accessToken)
    setOrgs(list)
    if (list.length === 0) setShowCreateForm(true)
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [accessToken, loadData])

  useEffect(() => {
    if (user?.email && !createForm.billingOwnerEmail) {
      setCreateForm((f) => ({
        ...f,
        billingOwnerEmail: user.email,
        billingOwnerName: f.billingOwnerName || user.displayName || user.username,
      }))
    }
  }, [user, createForm.billingOwnerEmail])

  function startEdit(org: OrganizationSummary) {
    setEditingOrgId(org.id)
    setEditForm({
      name: org.name,
      slug: org.slug,
      industry: org.industry ?? '',
      billingOwnerEmail: org.billingOwnerEmail ?? '',
      billingOwnerName: org.billingOwnerName ?? '',
      isDefault: org.isDefault,
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await adminApi.createOrganization(accessToken, {
        name: createForm.name,
        slug: createForm.slug || undefined,
        industry: createForm.industry || undefined,
        billingOwnerEmail: createForm.billingOwnerEmail,
        billingOwnerName: createForm.billingOwnerName,
        isDefault: createForm.isDefault || orgs.length === 0,
      })
      setSuccess('Organization created')
      setShowCreateForm(false)
      setCreateForm(emptyForm())
      await refreshUser()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !editingOrgId) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await adminApi.updateOrganization(accessToken, editingOrgId, {
        name: editForm.name,
        slug: editForm.slug || undefined,
        industry: editForm.industry || null,
        billingOwnerEmail: editForm.billingOwnerEmail,
        billingOwnerName: editForm.billingOwnerName,
        isDefault: editForm.isDefault || undefined,
      })
      setSuccess('Organization updated')
      setEditingOrgId(null)
      await refreshUser()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
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
      await adminApi.startDirectPaySubscription(accessToken, org.id)
      setSuccess(`Corporate plan subscription started for ${org.name}`)
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

  async function payInDirectPay(org: OrganizationSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await launchPayInDirectPay(accessToken)
      setSuccess(`Opened DirectPay payment for ${org.name}`)
      await refreshUser()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open DirectPay payment')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Organizations"
        primaryAction={{
          label: 'New organization',
          onClick: () => setShowCreateForm(true),
          icon: 'ti-building-plus',
        }}
      />
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

        {orgs.length === 0 && !loading && (
          <p className="mb-4 text-sm text-text-secondary">
            Create your default organization to get started. You can add more organizations later
            and choose which one is the default fallback for owner operations.
          </p>
        )}

        {showCreateForm && (
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
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Slug (optional)</FieldLabel>
                  <FieldInput
                    value={createForm.slug}
                    onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Industry</FieldLabel>
                  <FieldInput
                    value={createForm.industry}
                    onChange={(e) => setCreateForm((f) => ({ ...f, industry: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Billing owner email</FieldLabel>
                  <FieldInput
                    required
                    type="email"
                    value={createForm.billingOwnerEmail}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, billingOwnerEmail: e.target.value }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Billing owner name</FieldLabel>
                  <FieldInput
                    required
                    value={createForm.billingOwnerName}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, billingOwnerName: e.target.value }))
                    }
                  />
                </div>
                {orgs.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={createForm.isDefault}
                        onChange={(e) =>
                          setCreateForm((f) => ({ ...f, isDefault: e.target.checked }))
                        }
                      />
                      Set as default organization
                    </label>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <LoadingButton type="submit" loading={actionLoading}>
                  Create organization
                </LoadingButton>
                {orgs.length > 0 && (
                  <LoadingButton
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </LoadingButton>
                )}
              </div>
            </form>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All organizations</CardTitle>
          </CardHeader>
          {loading ? (
            <p className="p-4 text-sm text-text-secondary">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="p-4 text-sm text-text-secondary">
              No organizations yet. Create one above to get started.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {orgs.map((org) => (
                <div key={org.id} className="p-4">
                  {editingOrgId === org.id ? (
                    <form onSubmit={handleUpdate} className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <FieldLabel>Name</FieldLabel>
                          <FieldInput
                            required
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, name: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <FieldLabel>Slug</FieldLabel>
                          <FieldInput
                            required
                            value={editForm.slug}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, slug: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <FieldLabel>Industry</FieldLabel>
                          <FieldInput
                            value={editForm.industry}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, industry: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <FieldLabel>Billing owner email</FieldLabel>
                          <FieldInput
                            required
                            type="email"
                            value={editForm.billingOwnerEmail}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, billingOwnerEmail: e.target.value }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <FieldLabel>Billing owner name</FieldLabel>
                          <FieldInput
                            required
                            value={editForm.billingOwnerName}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, billingOwnerName: e.target.value }))
                            }
                          />
                        </div>
                        {!org.isDefault && (
                          <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-sm text-text-primary">
                              <input
                                type="checkbox"
                                checked={editForm.isDefault}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, isDefault: e.target.checked }))
                                }
                              />
                              Set as default organization
                            </label>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <LoadingButton type="submit" loading={actionLoading}>
                          Save changes
                        </LoadingButton>
                        <LoadingButton
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingOrgId(null)}
                        >
                          Cancel
                        </LoadingButton>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-text-primary">{org.name}</p>
                          {org.isDefault && <Badge variant="blue">Default</Badge>}
                        </div>
                        <p className="text-xs text-text-secondary">
                          {org.slug}
                          {org.directPayBusinessId ? ` · DirectPay ${org.directPayBusinessId}` : ''}
                          {org.userCount > 0 ? ` · ${org.userCount} users` : ''}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          Billing: {org.billingOwnerEmail ?? '—'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(org.subscription.status)}>
                            {org.subscription.status ?? 'Not started'}
                          </Badge>
                          {org.subscription.planCode && (
                            <span className="text-xs text-text-secondary">
                              {org.subscription.planCode}
                            </span>
                          )}
                          {org.subscription.periodEnd && (
                            <span className="text-xs text-text-secondary">
                              until {new Date(org.subscription.periodEnd).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <LoadingButton
                          type="button"
                          variant="secondary"
                          loading={actionLoading}
                          onClick={() => startEdit(org)}
                        >
                          Edit
                        </LoadingButton>
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
                        {org.directPayBusinessId && org.subscription.status && (
                          <LoadingButton
                            type="button"
                            loading={actionLoading}
                            onClick={() => payInDirectPay(org)}
                          >
                            Pay in DirectPay
                          </LoadingButton>
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
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
