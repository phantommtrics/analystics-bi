import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { AlertModal } from '../../components/ui/AlertModal'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { LoadingButton } from '../../components/ui/LoadingButton'
import { adminApi, type OrganizationSummary } from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'

type AlertState = { title: string; message: string }

function formatActionError(raw: string, fallbackTitle = 'Something went wrong'): AlertState {
  const wrapped = raw.match(
    /DirectPay\s+\w+\s+\/[^\s]+\s+failed:\s*(\d+)\s+(\{[\s\S]*\})$/i,
  )
  if (wrapped) {
    try {
      const body = JSON.parse(wrapped[2]) as { error?: string; message?: string }
      const message = body.error || body.message || raw
      return { title: titleForDirectPay(wrapped[1], message), message }
    } catch {
      // fall through
    }
  }

  if (/no payable subscription invoice/i.test(raw)) {
    return { title: 'Payment unavailable', message: raw }
  }
  if (/not provisioned/i.test(raw)) {
    return { title: 'DirectPay not set up', message: raw }
  }

  return { title: fallbackTitle, message: raw }
}

function titleForDirectPay(status: string, message: string): string {
  if (status === '409' || /no payable/i.test(message)) return 'Payment unavailable'
  if (status === '404') return 'Not found'
  if (status === '400') return 'Unable to continue'
  return 'DirectPay error'
}

function alertFromUnknown(err: unknown, fallbackTitle: string, fallbackMessage: string): AlertState {
  const raw = err instanceof Error ? err.message : fallbackMessage
  return formatActionError(raw, fallbackTitle)
}

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

function formatStatus(status: string | null) {
  if (!status) return 'Not started'
  return status.replace(/_/g, ' ')
}

function billingLabel(org: OrganizationSummary) {
  if (!org.directPayBusinessId) return '—'
  if (org.subscription.billing?.assigned) {
    const interval = org.subscription.billing.billingInterval
      ? ` / ${org.subscription.billing.billingInterval}`
      : ''
    return `${org.subscription.billing.amount} ${org.subscription.billing.currency}${interval}`
  }
  return org.subscription.billing?.message ?? 'No billing assigned'
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

function Panel({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-panel-title"
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-border bg-bg-primary shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="org-panel-title" className="truncate text-lg font-semibold text-text-primary">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <i className="ti ti-x text-lg" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-bg-secondary/40 px-5 py-4">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {title}
        </h3>
        {description && <p className="mt-1 text-xs text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-right text-text-primary">{value}</dd>
    </div>
  )
}

export function Organizations() {
  const { accessToken, user, refreshUser } = useAuth()
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [errorAlert, setErrorAlert] = useState<AlertState | null>(null)
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [createForm, setCreateForm] = useState<OrgFormState>(emptyForm())
  const [editForm, setEditForm] = useState<OrgFormState>(emptyForm())

  const loadData = useCallback(async () => {
    if (!accessToken || user?.userType !== 'OWNER') return
    const list = await adminApi.listOrganizations(accessToken)
    setOrgs(list)
    if (list.length === 0) setShowCreatePanel(true)
  }, [accessToken, user?.userType])

  useEffect(() => {
    if (!accessToken || user?.userType !== 'OWNER') return
    setLoading(true)
    loadData()
      .catch((err) => setErrorAlert(alertFromUnknown(err, 'Could not load organizations', 'Failed to load')))
      .finally(() => setLoading(false))
  }, [accessToken, loadData, user?.userType])

  useEffect(() => {
    if (user?.email && !createForm.billingOwnerEmail) {
      setCreateForm((f) => ({
        ...f,
        billingOwnerEmail: user.email,
        billingOwnerName: f.billingOwnerName || user.displayName || user.username,
      }))
    }
  }, [user, createForm.billingOwnerEmail])

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  )

  useEffect(() => {
    if (!selectedOrg) {
      setIsEditing(false)
      return
    }
    setEditForm({
      name: selectedOrg.name,
      slug: selectedOrg.slug,
      industry: selectedOrg.industry ?? '',
      billingOwnerEmail: selectedOrg.billingOwnerEmail ?? '',
      billingOwnerName: selectedOrg.billingOwnerName ?? '',
      isDefault: selectedOrg.isDefault,
    })
    setIsEditing(false)
  }, [selectedOrg])

  if (user?.userType !== 'OWNER') {
    return <Navigate to="/" replace />
  }

  function openOrg(org: OrganizationSummary) {
    setShowCreatePanel(false)
    setSelectedOrgId(org.id)
  }

  function closePanels() {
    setShowCreatePanel(false)
    setSelectedOrgId(null)
    setIsEditing(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setActionLoading(true)
    setSuccess('')
    try {
      const created = await adminApi.createOrganization(accessToken, {
        name: createForm.name,
        slug: createForm.slug || undefined,
        industry: createForm.industry || undefined,
        billingOwnerEmail: createForm.billingOwnerEmail,
        billingOwnerName: createForm.billingOwnerName,
        isDefault: createForm.isDefault || orgs.length === 0,
      })
      setSuccess('Organization created')
      setShowCreatePanel(false)
      setCreateForm(emptyForm())
      await refreshUser()
      await loadData()
      setSelectedOrgId(created.id)
    } catch (err) {
      setErrorAlert(alertFromUnknown(err, 'Could not create organization', 'Create failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !selectedOrgId) return
    setActionLoading(true)
    setSuccess('')
    try {
      await adminApi.updateOrganization(accessToken, selectedOrgId, {
        name: editForm.name,
        slug: editForm.slug || undefined,
        industry: editForm.industry || null,
        billingOwnerEmail: editForm.billingOwnerEmail,
        billingOwnerName: editForm.billingOwnerName,
        isDefault: editForm.isDefault || undefined,
      })
      setSuccess('Organization updated')
      setIsEditing(false)
      await refreshUser()
      await loadData()
    } catch (err) {
      setErrorAlert(alertFromUnknown(err, 'Could not update organization', 'Update failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function provision(org: OrganizationSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setSuccess('')
    try {
      await adminApi.provisionDirectPay(accessToken, org.id)
      setSuccess(`DirectPay provisioned for ${org.name}`)
      await loadData()
    } catch (err) {
      setErrorAlert(alertFromUnknown(err, 'DirectPay provisioning failed', 'Provision failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function startSubscription(org: OrganizationSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setSuccess('')
    try {
      await adminApi.startDirectPaySubscription(accessToken, org.id)
      setSuccess(`Corporate plan subscription started for ${org.name}`)
      await loadData()
    } catch (err) {
      setErrorAlert(
        alertFromUnknown(err, 'Could not start subscription', 'Start subscription failed'),
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function syncSubscription(org: OrganizationSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setSuccess('')
    try {
      await adminApi.syncDirectPaySubscription(accessToken, org.id)
      setSuccess(`Subscription synced for ${org.name}`)
      await loadData()
    } catch (err) {
      setErrorAlert(alertFromUnknown(err, 'Could not sync subscription', 'Sync failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function payInDirectPay(org: OrganizationSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setSuccess('')
    try {
      const result = await adminApi.payInDirectPay(accessToken, org.id)
      window.open(result.payUrl, '_blank', 'noopener,noreferrer')
      const billingNote = result.billing.assigned
        ? `Revenue ${result.billing.amount} ${result.billing.currency}`
        : (result.billing.message ?? 'No billing is assigned')
      setSuccess(`Opened DirectPay payment for ${org.name} · ${billingNote}`)
      await loadData()
    } catch (err) {
      setErrorAlert(
        alertFromUnknown(err, 'Could not open payment', 'Failed to open DirectPay payment'),
      )
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
          onClick: () => {
            setSelectedOrgId(null)
            setShowCreatePanel(true)
          },
          icon: 'ti-building-plus',
        }}
      />

      <div className="flex-1 overflow-auto p-6">
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-semantic-green/20 bg-semantic-green/10 px-3 py-2 text-sm text-semantic-green">
            <i className="ti ti-check" />
            <span>{success}</span>
            <button
              type="button"
              className="ml-auto rounded p-0.5 hover:bg-semantic-green/10"
              onClick={() => setSuccess('')}
              aria-label="Dismiss"
            >
              <i className="ti ti-x" />
            </button>
          </div>
        )}

        <Card noPadding>
          <CardHeader className="mb-0 border-b border-border p-5">
            <CardTitle>All organizations</CardTitle>
          </CardHeader>

          {loading ? (
            <p className="p-5 text-sm text-text-secondary">Loading…</p>
          ) : orgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                <i className="ti ti-building text-2xl" />
              </div>
              <div>
                <p className="font-medium text-text-primary">No organizations yet</p>
                <p className="mt-1 max-w-sm text-sm text-text-secondary">
                  Create your default organization to get started. You can add more later and
                  choose which one is the default fallback.
                </p>
              </div>
              <LoadingButton
                type="button"
                onClick={() => setShowCreatePanel(true)}
                className="mt-1"
              >
                <i className="ti ti-building-plus" />
                Create organization
              </LoadingButton>
            </div>
          ) : (
            <DataTable
              data={orgs}
              keyExtractor={(o) => o.id}
              onRowClick={openOrg}
              columns={[
                {
                  header: 'Organization',
                  accessor: (o) => (
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{o.name}</span>
                        {o.isDefault && <Badge variant="blue">Default</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-text-secondary">{o.slug}</p>
                    </div>
                  ),
                },
                {
                  header: 'Users',
                  accessor: (o) => o.userCount,
                  isNumeric: true,
                  className: 'w-20',
                },
                {
                  header: 'Subscription',
                  accessor: (o) => (
                    <div className="space-y-1">
                      <Badge variant={statusVariant(o.subscription.status)}>
                        {formatStatus(o.subscription.status)}
                      </Badge>
                      {o.subscription.periodEnd && (
                        <p className="text-xs text-text-secondary">
                          Until {new Date(o.subscription.periodEnd).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Billing',
                  accessor: (o) => (
                    <span className="text-sm text-text-secondary">{billingLabel(o)}</span>
                  ),
                },
                {
                  header: 'DirectPay',
                  accessor: (o) =>
                    o.directPayBusinessId ? (
                      <Badge variant="green">Connected</Badge>
                    ) : (
                      <Badge variant="gray">Not set up</Badge>
                    ),
                },
                {
                  header: '',
                  className: 'w-28 text-right',
                  accessor: (o) => (
                    <LoadingButton
                      type="button"
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        openOrg(o)
                      }}
                    >
                      Manage
                      <i className="ti ti-chevron-right" />
                    </LoadingButton>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <Panel
        open={showCreatePanel}
        title="Create organization"
        subtitle="Set up billing owner details. DirectPay can be connected after creation."
        onClose={() => {
          if (orgs.length > 0) setShowCreatePanel(false)
        }}
        footer={
          <>
            {orgs.length > 0 && (
              <LoadingButton type="button" variant="secondary" onClick={() => setShowCreatePanel(false)}>
                Cancel
              </LoadingButton>
            )}
            <LoadingButton type="submit" form="create-org-form" loading={actionLoading}>
              Create organization
            </LoadingButton>
          </>
        }
      >
        <form id="create-org-form" onSubmit={handleCreate} className="space-y-6">
          <Section title="Organization">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel>Name</FieldLabel>
                <FieldInput
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Acme Holdings"
                />
              </div>
              <div>
                <FieldLabel>Slug (optional)</FieldLabel>
                <FieldInput
                  value={createForm.slug}
                  onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="acme-holdings"
                />
              </div>
              <div>
                <FieldLabel>Industry</FieldLabel>
                <FieldInput
                  value={createForm.industry}
                  onChange={(e) => setCreateForm((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="Finance"
                />
              </div>
            </div>
          </Section>

          <Section
            title="Billing owner"
            description="Contact used for DirectPay invoices and subscription notices."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel>Email</FieldLabel>
                <FieldInput
                  required
                  type="email"
                  value={createForm.billingOwnerEmail}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, billingOwnerEmail: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Name</FieldLabel>
                <FieldInput
                  required
                  value={createForm.billingOwnerName}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, billingOwnerName: e.target.value }))
                  }
                />
              </div>
            </div>
          </Section>

          {orgs.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={createForm.isDefault}
                onChange={(e) => setCreateForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Set as default organization
            </label>
          )}
        </form>
      </Panel>

      <Panel
        open={!!selectedOrg}
        title={selectedOrg?.name ?? 'Organization'}
        subtitle={selectedOrg?.slug}
        onClose={closePanels}
        footer={
          selectedOrg && isEditing ? (
            <>
              <LoadingButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsEditing(false)
                  setEditForm({
                    name: selectedOrg.name,
                    slug: selectedOrg.slug,
                    industry: selectedOrg.industry ?? '',
                    billingOwnerEmail: selectedOrg.billingOwnerEmail ?? '',
                    billingOwnerName: selectedOrg.billingOwnerName ?? '',
                    isDefault: selectedOrg.isDefault,
                  })
                }}
              >
                Cancel
              </LoadingButton>
              <LoadingButton type="submit" form="edit-org-form" loading={actionLoading}>
                Save changes
              </LoadingButton>
            </>
          ) : selectedOrg ? (
            <LoadingButton type="button" variant="secondary" onClick={() => setIsEditing(true)}>
              <i className="ti ti-pencil" />
              Edit details
            </LoadingButton>
          ) : null
        }
      >
        {selectedOrg && (
          <div className="space-y-8">
            {isEditing ? (
              <form id="edit-org-form" onSubmit={handleUpdate} className="space-y-6">
                <Section title="Organization">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <FieldLabel>Name</FieldLabel>
                      <FieldInput
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Slug</FieldLabel>
                      <FieldInput
                        required
                        value={editForm.slug}
                        onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Industry</FieldLabel>
                      <FieldInput
                        value={editForm.industry}
                        onChange={(e) => setEditForm((f) => ({ ...f, industry: e.target.value }))}
                      />
                    </div>
                  </div>
                </Section>
                <Section title="Billing owner">
                  <div className="grid gap-4">
                    <div>
                      <FieldLabel>Email</FieldLabel>
                      <FieldInput
                        required
                        type="email"
                        value={editForm.billingOwnerEmail}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, billingOwnerEmail: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <FieldInput
                        required
                        value={editForm.billingOwnerName}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, billingOwnerName: e.target.value }))
                        }
                      />
                    </div>
                    {!selectedOrg.isDefault && (
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
                    )}
                  </div>
                </Section>
              </form>
            ) : (
              <>
                <Section title="Overview">
                  <dl className="divide-y divide-border rounded-md border border-border px-3">
                    <DetailRow
                      label="Status"
                      value={
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {selectedOrg.isDefault && <Badge variant="blue">Default</Badge>}
                          <Badge variant={statusVariant(selectedOrg.subscription.status)}>
                            {formatStatus(selectedOrg.subscription.status)}
                          </Badge>
                        </div>
                      }
                    />
                    <DetailRow label="Users" value={selectedOrg.userCount} />
                    <DetailRow
                      label="Industry"
                      value={selectedOrg.industry || '—'}
                    />
                    <DetailRow
                      label="Billing owner"
                      value={
                        <div>
                          <div>{selectedOrg.billingOwnerName || '—'}</div>
                          <div className="text-xs text-text-secondary">
                            {selectedOrg.billingOwnerEmail || '—'}
                          </div>
                        </div>
                      }
                    />
                    {selectedOrg.subscription.planCode && (
                      <DetailRow label="Plan" value={selectedOrg.subscription.planCode} />
                    )}
                    {selectedOrg.subscription.periodEnd && (
                      <DetailRow
                        label="Period end"
                        value={new Date(selectedOrg.subscription.periodEnd).toLocaleDateString()}
                      />
                    )}
                  </dl>
                </Section>

                <Section
                  title="DirectPay & billing"
                  description="Provision once, then manage subscription and payments from here."
                >
                  <dl className="mb-4 divide-y divide-border rounded-md border border-border px-3">
                    <DetailRow
                      label="Connection"
                      value={
                        selectedOrg.directPayBusinessId ? (
                          <Badge variant="green">Connected</Badge>
                        ) : (
                          <Badge variant="gray">Not set up</Badge>
                        )
                      }
                    />
                    {selectedOrg.directPayBusinessId && (
                      <DetailRow
                        label="Business ID"
                        value={
                          <span className="break-all font-mono text-xs">
                            {selectedOrg.directPayBusinessId}
                          </span>
                        }
                      />
                    )}
                    <DetailRow label="Billing" value={billingLabel(selectedOrg)} />
                    {selectedOrg.subscription.billing?.assigned &&
                      selectedOrg.subscription.billing.templateName && (
                        <DetailRow
                          label="Template"
                          value={selectedOrg.subscription.billing.templateName}
                        />
                      )}
                  </dl>

                  <div className="flex flex-col gap-2">
                    {!selectedOrg.directPayBusinessId && (
                      <LoadingButton
                        type="button"
                        loading={actionLoading}
                        onClick={() => provision(selectedOrg)}
                      >
                        <i className="ti ti-plug" />
                        Provision DirectPay
                      </LoadingButton>
                    )}
                    {selectedOrg.directPayBusinessId && !selectedOrg.subscription.status && (
                      <LoadingButton
                        type="button"
                        loading={actionLoading}
                        onClick={() => startSubscription(selectedOrg)}
                      >
                        <i className="ti ti-rocket" />
                        Start Corporate Plan
                      </LoadingButton>
                    )}
                    {selectedOrg.directPayBusinessId && selectedOrg.subscription.status && (
                      <LoadingButton
                        type="button"
                        loading={actionLoading}
                        onClick={() => payInDirectPay(selectedOrg)}
                      >
                        <i className="ti ti-external-link" />
                        Pay in DirectPay
                      </LoadingButton>
                    )}
                    {selectedOrg.directPayBusinessId && (
                      <LoadingButton
                        type="button"
                        variant="secondary"
                        loading={actionLoading}
                        onClick={() => syncSubscription(selectedOrg)}
                      >
                        <i className="ti ti-refresh" />
                        Sync subscription
                      </LoadingButton>
                    )}
                  </div>
                </Section>
              </>
            )}
          </div>
        )}
      </Panel>

      <AlertModal
        open={errorAlert !== null}
        title={errorAlert?.title ?? 'Something went wrong'}
        message={errorAlert?.message ?? ''}
        onClose={() => setErrorAlert(null)}
      />
    </div>
  )
}
