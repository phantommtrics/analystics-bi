import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { DataTable } from '../../components/ui/DataTable'
import { LoadingButton } from '../../components/ui/LoadingButton'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'
import { adminApi, type GroupSummary, type OperatorSummary } from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'

type ActionKey = 'invite' | 'resend' | 'reset' | 'disable' | 'enable'

type PendingAction =
  | { type: 'invite' }
  | { type: ActionKey; operator: OperatorSummary }
  | null

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

export function Operators() {
  const { accessToken } = useAuth()
  const [operators, setOperators] = useState<OperatorSummary[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [form, setForm] = useState({
    username: '',
    email: '',
    displayName: '',
    groupIds: [] as string[],
  })

  const loadData = useCallback(async () => {
    if (!accessToken) return
    const [opList, groupList] = await Promise.all([
      adminApi.listOperators(accessToken),
      adminApi.listGroups(accessToken),
    ])
    setOperators(opList)
    setGroups(groupList)
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [accessToken, loadData])

  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        id: g.id,
        label: g.name,
        description: g.role.name,
      })),
    [groups],
  )

  async function executeInvite() {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const created = await adminApi.createOperator(accessToken, {
        username: form.username.trim(),
        email: form.email.trim(),
        displayName: form.displayName.trim() || undefined,
        groupIds: form.groupIds,
      })
      const warn = (created as { emailWarning?: string }).emailWarning
      setSuccess(
        warn
          ? `Operator created. ${warn}`
          : `Invitation sent to ${created.email}`,
      )
      setShowForm(false)
      setForm({ username: '', email: '', displayName: '', groupIds: [] })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create operator')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  async function executeOperatorAction(action: ActionKey, operator: OperatorSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    try {
      if (action === 'resend') {
        const result = await adminApi.resendInvite(accessToken, operator.id)
        setSuccess(
          result.emailWarning
            ? result.emailWarning
            : `Invitation resent to ${operator.email}`,
        )
      } else if (action === 'reset') {
        const result = await adminApi.resetPassword(accessToken, operator.id)
        setSuccess(
          result.emailWarning
            ? result.emailWarning
            : `Password reset email sent to ${operator.email}`,
        )
      } else if (action === 'disable') {
        await adminApi.disableOperator(accessToken, operator.id)
        setSuccess(`${operator.username} has been disabled`)
      } else if (action === 'enable') {
        await adminApi.enableOperator(accessToken, operator.id)
        setSuccess(`${operator.username} has been enabled`)
      }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  function formatLastLogin(value: string | null) {
    if (!value) return 'Never'
    return new Date(value).toLocaleString()
  }

  function confirmMessage(p: PendingAction): {
    title: string
    message: string
    label: string
    variant: 'primary' | 'danger'
  } {
    if (!p) {
      return { title: '', message: '', label: 'Confirm', variant: 'primary' }
    }
    if (p.type === 'invite') {
      return {
        title: 'Send invitation?',
        message: `Invite ${form.email.trim()} as a system operator? A temporary password will be emailed and must be changed on first login.`,
        label: 'Send invitation',
        variant: 'primary',
      }
    }
    const op = p.operator
    switch (p.type) {
      case 'resend':
        return {
          title: 'Resend invitation?',
          message: `Send a new temporary password to ${op.email}? Any existing sessions will be revoked.`,
          label: 'Resend invitation',
          variant: 'primary',
        }
      case 'reset':
        return {
          title: 'Reset password?',
          message: `Email a new temporary password to ${op.email}? The user must change it on next login.`,
          label: 'Reset password',
          variant: 'primary',
        }
      case 'disable':
        return {
          title: 'Disable operator?',
          message: `${op.displayName ?? op.username} will lose access immediately and cannot sign in until re-enabled.`,
          label: 'Disable',
          variant: 'danger',
        }
      case 'enable':
        return {
          title: 'Enable operator?',
          message: `${op.displayName ?? op.username} will be able to sign in again.`,
          label: 'Enable',
          variant: 'primary',
        }
      default:
        return { title: '', message: '', label: 'Confirm', variant: 'primary' }
    }
  }

  const confirm = confirmMessage(pending)
  const isRowActionPending =
    pending && pending.type !== 'invite' ? `${pending.type}:${pending.operator.id}` : null

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Operators"
        primaryAction={{
          label: 'Invite Operator',
          onClick: () => setShowForm(true),
          icon: 'ti-user-plus',
        }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-semantic-red/20 bg-semantic-red/10 px-3 py-2 text-sm text-semantic-red">
            <i className="ti ti-alert-circle"></i>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-semantic-green/20 bg-semantic-green/10 px-3 py-2 text-sm text-semantic-green">
            <i className="ti ti-check"></i>
            <span>{success}</span>
          </div>
        )}

        {showForm && (
          <Card className="mb-6 overflow-hidden">
            <div className="border-b border-border bg-bg-secondary/50 px-6 py-4">
              <h3 className="text-lg font-semibold text-text-primary">Invite operator</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Create a system user account and assign one or more groups. Each group provides a single role set of permissions.
              </p>
            </div>

            <div className="space-y-6 p-6">
              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Account details
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Username</FieldLabel>
                    <FieldInput
                      placeholder="jane.doe"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <FieldLabel>Email</FieldLabel>
                    <FieldInput
                      type="email"
                      placeholder="jane@company.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Display name (optional)</FieldLabel>
                    <FieldInput
                      placeholder="Jane Doe"
                      value={form.displayName}
                      onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Access — user groups
                </h4>
                <MultiSelectDropdown
                  options={groupOptions}
                  selectedIds={form.groupIds}
                  onChange={(groupIds) => setForm((f) => ({ ...f, groupIds }))}
                  placeholder="Select user groups..."
                  searchPlaceholder="Search groups by name or role..."
                  emptyMessage={
                    groups.length === 0
                      ? 'No groups yet. Create groups under System Configuration → User Groups.'
                      : 'No groups match your search'
                  }
                  disabled={groups.length === 0}
                />
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-border bg-bg-secondary/30 px-6 py-4">
              <LoadingButton variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </LoadingButton>
              <LoadingButton
                disabled={!form.username.trim() || !form.email.trim()}
                loading={actionLoading && pending?.type === 'invite'}
                onClick={() => setPending({ type: 'invite' })}
              >
                Send invitation
              </LoadingButton>
            </div>
          </Card>
        )}

        <Card noPadding>
          <CardHeader className="border-b border-border p-5">
            <CardTitle>System operators</CardTitle>
          </CardHeader>
          {loading ? (
            <p className="p-5 text-sm text-text-secondary">Loading...</p>
          ) : (
            <DataTable
              data={operators}
              keyExtractor={(o) => o.id}
              columns={[
                {
                  header: 'Operator',
                  accessor: (o) => (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-medium text-brand-blue">
                        {(o.displayName ?? o.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{o.displayName ?? o.username}</div>
                        <div className="text-xs text-text-secondary">@{o.username}</div>
                        <div className="text-xs text-text-secondary">{o.email}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Groups',
                  accessor: (o) =>
                    o.groups.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {o.groups.map((g) => (
                          <span
                            key={g.id}
                            className="rounded bg-bg-secondary px-2 py-0.5 text-xs"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '—'
                    ),
                },
                {
                  header: 'Role sets',
                  accessor: (o) =>
                    o.roles.length > 0 ? o.roles.map((r) => r.name).join(', ') : '—',
                  className: 'text-sm text-text-secondary',
                },
                {
                  header: 'Last login',
                  accessor: (o) => formatLastLogin(o.lastLoginAt),
                  className: 'text-sm text-text-secondary whitespace-nowrap',
                },
                {
                  header: 'Status',
                  accessor: (o) => (
                    <div className="flex flex-col gap-1">
                      <Badge variant={o.status === 'ACTIVE' ? 'green' : 'gray'}>
                        {o.status}
                      </Badge>
                      {o.mustChangePassword && o.status === 'ACTIVE' && (
                        <span className="text-xs text-amber-600">Pending setup</span>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Actions',
                  accessor: (o) => (
                    <div className="flex flex-wrap gap-1">
                      {o.status === 'ACTIVE' && o.mustChangePassword && (
                        <LoadingButton
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          loading={isRowActionPending === `resend:${o.id}`}
                          onClick={() => setPending({ type: 'resend', operator: o })}
                        >
                          <i className="ti ti-mail"></i>
                          Resend invite
                        </LoadingButton>
                      )}
                      {o.status === 'ACTIVE' && !o.mustChangePassword && (
                        <LoadingButton
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          loading={isRowActionPending === `reset:${o.id}`}
                          onClick={() => setPending({ type: 'reset', operator: o })}
                        >
                          <i className="ti ti-key"></i>
                          Reset password
                        </LoadingButton>
                      )}
                      {o.status === 'ACTIVE' ? (
                        <LoadingButton
                          variant="ghost"
                          className="px-2 py-1 text-xs text-semantic-red hover:text-semantic-red"
                          loading={isRowActionPending === `disable:${o.id}`}
                          onClick={() => setPending({ type: 'disable', operator: o })}
                        >
                          <i className="ti ti-ban"></i>
                          Disable
                        </LoadingButton>
                      ) : (
                        <LoadingButton
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          loading={isRowActionPending === `enable:${o.id}`}
                          onClick={() => setPending({ type: 'enable', operator: o })}
                        >
                          <i className="ti ti-user-check"></i>
                          Enable
                        </LoadingButton>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <ConfirmModal
        open={pending !== null}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.label}
        variant={confirm.variant}
        loading={actionLoading}
        onConfirm={() => {
          if (!pending) return
          if (pending.type === 'invite') {
            executeInvite()
          } else {
            executeOperatorAction(pending.type, pending.operator)
          }
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
