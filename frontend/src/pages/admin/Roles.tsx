import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { DataTable } from '../../components/ui/DataTable'
import { ExpandableCard } from '../../components/ui/ExpandableCard'
import { LoadingButton } from '../../components/ui/LoadingButton'
import { PermissionMatrix } from '../../components/admin/PermissionMatrix'
import { adminApi, type PermissionsCatalog, type RoleSummary } from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'
import { setsEqual } from '../../lib/setUtils'

type PendingAction = { type: 'create' } | { type: 'savePermissions' } | null

export function Roles() {
  const { accessToken, refreshUser } = useAuth()
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [catalog, setCatalog] = useState<PermissionsCatalog | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [savedPermissionIds, setSavedPermissionIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')

  const permissionsDirty = useMemo(() => {
    if (!selectedRoleId) return false
    return !setsEqual(selectedIds, savedPermissionIds)
  }, [selectedRoleId, selectedIds, savedPermissionIds])

  const loadRoles = useCallback(async () => {
    if (!accessToken) return
    const list = await adminApi.listRoles(accessToken)
    setRoles(list)
  }, [accessToken])

  const loadCatalog = useCallback(async () => {
    if (!accessToken) return
    const data = await adminApi.getPermissionsCatalog(accessToken)
    setCatalog(data)
  }, [accessToken])

  const loadRolePermissions = useCallback(
    async (roleId: string) => {
      if (!accessToken) return
      const detail = await adminApi.getRole(accessToken, roleId)
      const ids = new Set(detail.permissionIds)
      setSelectedIds(ids)
      setSavedPermissionIds(new Set(ids))
    },
    [accessToken],
  )

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    Promise.all([loadRoles(), loadCatalog()])
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [accessToken, loadRoles, loadCatalog])

  useEffect(() => {
    if (selectedRoleId) {
      loadRolePermissions(selectedRoleId).catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load role'),
      )
    } else {
      setSelectedIds(new Set())
      setSavedPermissionIds(new Set())
    }
  }, [selectedRoleId, loadRolePermissions])

  async function executeCreateRole() {
    if (!accessToken || !formName.trim()) return
    setActionLoading(true)
    setError('')
    try {
      const created = await adminApi.createRole(accessToken, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      })
      await loadRoles()
      setShowForm(false)
      setFormName('')
      setFormDescription('')
      setSelectedRoleId(created.id)
      setSuccess(`Role "${formName.trim()}" created`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  async function executeSavePermissions() {
    if (!accessToken || !selectedRoleId || !permissionsDirty) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await adminApi.setRolePermissions(accessToken, selectedRoleId, [...selectedIds])
      await Promise.all([loadRolePermissions(selectedRoleId), loadRoles(), refreshUser()])
      setSuccess('Permissions saved. Your access and menus have been updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId)

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Roles"
        primaryAction={{
          label: 'New Role',
          onClick: () => setShowForm(true),
          icon: 'ti-plus',
        }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-md border border-semantic-red/20 bg-semantic-red/10 px-3 py-2 text-sm text-semantic-red">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-semantic-green/20 bg-semantic-green/10 px-3 py-2 text-sm text-semantic-green">
            {success}
          </div>
        )}

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create role</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <input
                placeholder="Role name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <input
                placeholder="Description (optional)"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <LoadingButton
                  loading={actionLoading && pending?.type === 'create'}
                  disabled={!formName.trim()}
                  onClick={() => setPending({ type: 'create' })}
                >
                  Create
                </LoadingButton>
                <LoadingButton variant="secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </LoadingButton>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <ExpandableCard
            title="Permission sets"
            noPadding
            headerClassName="mb-0 border-b border-border p-5"
            bodyClassName="p-0"
          >
            {loading ? (
              <p className="p-5 text-sm text-text-secondary">Loading...</p>
            ) : (
              <DataTable
                data={roles}
                keyExtractor={(r) => r.id}
                columns={[
                  {
                    header: 'Role',
                    accessor: (r) => (
                      <button
                        className={`text-left font-medium ${selectedRoleId === r.id ? 'text-brand-blue' : ''}`}
                        onClick={() => setSelectedRoleId(r.id)}
                      >
                        {r.name}
                      </button>
                    ),
                  },
                  {
                    header: 'Users',
                    accessor: (r) => r.userCount,
                    className: 'text-sm text-text-secondary',
                  },
                  {
                    header: 'Groups',
                    accessor: (r) => r.groupCount ?? 0,
                    className: 'text-sm text-text-secondary',
                  },
                  {
                    header: 'Permissions',
                    accessor: (r) => r.permissionCount,
                    className: 'text-sm text-text-secondary',
                  },
                ]}
              />
            )}
          </ExpandableCard>

          <ExpandableCard
            title={selectedRole ? `${selectedRole.name} — permissions` : 'Select a role'}
            action={
              selectedRoleId ? (
                <LoadingButton
                  className="px-3 py-1.5 text-xs"
                  loading={actionLoading && pending?.type === 'savePermissions'}
                  disabled={!permissionsDirty}
                  onClick={() => setPending({ type: 'savePermissions' })}
                >
                  Save permissions
                </LoadingButton>
              ) : null
            }
          >
            {selectedRoleId && catalog ? (
              <>
                <p className="mb-3 text-xs text-text-secondary">
                  Org operators get this role through User Groups, not a direct role assignment.
                  Confirm the operator&apos;s group is linked to this role.
                </p>
                {permissionsDirty && (
                  <p className="mb-3 text-xs text-amber-700">Unsaved changes to this permission set</p>
                )}
                <PermissionMatrix
                  modules={catalog.modules}
                  actions={catalog.actions}
                  moduleActions={catalog.moduleActions}
                  permissions={catalog.permissions}
                  selectedIds={selectedIds}
                  onChange={setSelectedIds}
                />
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                Select a role from the list to configure its permission matrix.
              </p>
            )}
          </ExpandableCard>
        </div>
      </div>

      <ConfirmModal
        open={pending?.type === 'create'}
        title="Create role?"
        message={`Create permission set "${formName.trim()}"?`}
        confirmLabel="Create"
        loading={actionLoading}
        onConfirm={executeCreateRole}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={pending?.type === 'savePermissions'}
        title="Save permissions?"
        message={`Update permissions for "${selectedRole?.name}"? Users with this role will see changes on next login.`}
        confirmLabel="Save"
        loading={actionLoading}
        onConfirm={executeSavePermissions}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
