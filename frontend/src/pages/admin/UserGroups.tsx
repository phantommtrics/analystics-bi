import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { DataTable } from '../../components/ui/DataTable'
import { ExpandableCard } from '../../components/ui/ExpandableCard'
import { LoadingButton } from '../../components/ui/LoadingButton'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import {
  adminApi,
  type GroupDetail,
  type GroupSummary,
  type OperatorSummary,
  type OrganizationSummary,
  type RoleSummary,
} from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'
import { setsEqual } from '../../lib/setUtils'

type PendingAction =
  | { type: 'create' }
  | { type: 'save' }
  | { type: 'delete'; groupId: string; groupName: string }
  | null

export function UserGroups() {
  const { accessToken, refreshUser, user } = useAuth()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [operators, setOperators] = useState<OperatorSummary[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editMemberIds, setEditMemberIds] = useState<string[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState<{
    name: string
    description: string
    roleId: string
    memberIds: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formRoleId, setFormRoleId] = useState<string | null>(null)
  const [formOrganizationId, setFormOrganizationId] = useState('')

  const isOwner = user?.userType === 'OWNER'
  const defaultOrgId =
    organizations.find((o) => o.isDefault)?.id ?? organizations[0]?.id ?? ''

  const dirty = useMemo(() => {
    if (!selectedGroupId || !savedSnapshot || !selectedRoleId) return false
    return (
      editName.trim() !== savedSnapshot.name ||
      editDescription.trim() !== savedSnapshot.description ||
      selectedRoleId !== savedSnapshot.roleId ||
      !setsEqual(new Set(editMemberIds), new Set(savedSnapshot.memberIds))
    )
  }, [
    selectedGroupId,
    savedSnapshot,
    editName,
    editDescription,
    selectedRoleId,
    editMemberIds,
  ])

  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({
        id: r.id,
        label: r.name,
        description: r.description ?? undefined,
      })),
    [roles],
  )

  const memberOptions = useMemo(() => {
    const selectedGroup = groups.find((g) => g.id === selectedGroupId)
    if (!selectedGroup) return []
    return operators
      .filter((op) => op.organizationId === selectedGroup.organizationId)
      .map((op) => ({
        id: op.id,
        label: op.displayName?.trim() || op.username,
        description: op.email,
      }))
  }, [operators, groups, selectedGroupId])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    const orgList = isOwner ? await adminApi.listOrganizations(accessToken) : []
    const [groupList, roleList, operatorList] = await Promise.all([
      adminApi.listGroups(accessToken),
      adminApi.listRoles(accessToken),
      adminApi.listOperators(accessToken),
    ])
    setOrganizations(orgList)
    setGroups(groupList)
    setRoles(roleList)
    setOperators(operatorList)
    if (!formOrganizationId) {
      const orgId =
        orgList.find((o) => o.isDefault)?.id ??
        orgList[0]?.id ??
        user?.organization?.id ??
        ''
      if (orgId) setFormOrganizationId(orgId)
    }
  }, [accessToken, formOrganizationId, isOwner, user?.organization?.id])

  const applyGroupDetail = useCallback((detail: GroupDetail) => {
    const memberIds = (detail.members ?? []).map((m) => m.id)
    setEditName(detail.name)
    setEditDescription(detail.description ?? '')
    setSelectedRoleId(detail.roleId)
    setEditMemberIds(memberIds)
    setSavedSnapshot({
      name: detail.name,
      description: detail.description ?? '',
      roleId: detail.roleId,
      memberIds,
    })
  }, [])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [accessToken, loadData])

  useEffect(() => {
    if (!accessToken || !selectedGroupId) {
      setSelectedRoleId(null)
      setEditName('')
      setEditDescription('')
      setEditMemberIds([])
      setSavedSnapshot(null)
      return
    }
    setDetailLoading(true)
    adminApi
      .getGroup(accessToken, selectedGroupId)
      .then(applyGroupDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load group'))
      .finally(() => setDetailLoading(false))
  }, [accessToken, selectedGroupId, applyGroupDetail])

  async function executeCreate() {
    if (!accessToken || !formName.trim() || !formRoleId) return
    setActionLoading(true)
    setError('')
    try {
      const created = await adminApi.createGroup(accessToken, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        roleId: formRoleId,
        organizationId: formOrganizationId || defaultOrgId || undefined,
      })
      setSuccess(`Group "${created.name}" created`)
      await loadData()
      setShowForm(false)
      setFormName('')
      setFormDescription('')
      setFormRoleId(null)
      setSelectedGroupId(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  async function executeSave() {
    if (!accessToken || !selectedGroupId || !selectedRoleId || !dirty) return
    setActionLoading(true)
    setSuccess('')
    setError('')
    try {
      const updated = await adminApi.updateGroup(accessToken, selectedGroupId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        roleId: selectedRoleId,
        memberIds: editMemberIds,
      })
      applyGroupDetail(updated)
      await loadData()
      await refreshUser()
      setSuccess('Group saved. Member permissions update on next login.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  async function executeDelete(groupId: string) {
    if (!accessToken) return
    setActionLoading(true)
    try {
      await adminApi.deleteGroup(accessToken, groupId)
      setSuccess('Group deleted')
      if (selectedGroupId === groupId) setSelectedGroupId(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="User Groups"
        primaryAction={{
          label: 'New Group',
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
              <CardTitle>Create user group</CardTitle>
            </CardHeader>
            <p className="mb-4 text-sm text-text-secondary">
              Each group maps to exactly one role set. Assign operators as members so they inherit
              that role&apos;s permissions.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {isOwner && organizations.length > 0 && (
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">Organization</label>
                  <select
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm"
                    value={formOrganizationId || defaultOrgId}
                    onChange={(e) => setFormOrganizationId(e.target.value)}
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                        {org.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Group name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  placeholder="e.g. Finance Team"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Role set</label>
                <SearchableSelect
                  options={roleOptions}
                  value={formRoleId}
                  onChange={setFormRoleId}
                  placeholder="Select role set..."
                  searchPlaceholder="Search roles..."
                  emptyMessage="No roles available. Create a role first."
                  disabled={roles.length === 0}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Description (optional)</label>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  placeholder="Short description"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <LoadingButton
                loading={actionLoading && pending?.type === 'create'}
                disabled={!formName.trim() || !formRoleId}
                onClick={() => setPending({ type: 'create' })}
              >
                Create group
              </LoadingButton>
              <LoadingButton variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </LoadingButton>
            </div>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <ExpandableCard
            title="Groups"
            noPadding
            headerClassName="mb-0 border-b border-border p-5"
            bodyClassName="p-0"
          >
            {loading ? (
              <p className="p-5 text-sm text-text-secondary">Loading...</p>
            ) : (
              <DataTable
                data={groups}
                keyExtractor={(g) => g.id}
                columns={[
                  {
                    header: 'Group',
                    accessor: (g) => (
                      <button
                        className={`text-left font-medium ${selectedGroupId === g.id ? 'text-brand-blue' : ''}`}
                        onClick={() => setSelectedGroupId(g.id)}
                      >
                        {g.name}
                      </button>
                    ),
                  },
                  {
                    header: 'Role set',
                    accessor: (g) => g.role.name,
                    className: 'text-sm text-text-secondary',
                  },
                  {
                    header: 'Members',
                    accessor: (g) => g.memberCount,
                    className: 'text-sm text-text-secondary',
                  },
                ]}
              />
            )}
          </ExpandableCard>

          <ExpandableCard
            title={selectedGroup ? `${selectedGroup.name}` : 'Select a group'}
            action={
              selectedGroupId ? (
                <div className="flex gap-2">
                  <LoadingButton
                    loading={actionLoading && pending?.type === 'save'}
                    disabled={!selectedRoleId || !editName.trim() || !dirty}
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setPending({ type: 'save' })}
                  >
                    Save
                  </LoadingButton>
                  {selectedGroup && selectedGroup.memberCount === 0 && (
                    <LoadingButton
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      loading={
                        actionLoading &&
                        pending?.type === 'delete' &&
                        pending.groupId === selectedGroup.id
                      }
                      onClick={() =>
                        setPending({
                          type: 'delete',
                          groupId: selectedGroup.id,
                          groupName: selectedGroup.name,
                        })
                      }
                    >
                      Delete
                    </LoadingButton>
                  )}
                </div>
              ) : null
            }
          >
            {!selectedGroupId ? (
              <p className="text-sm text-text-secondary">
                Select a group to edit its name, role set, and members.
              </p>
            ) : detailLoading ? (
              <p className="text-sm text-text-secondary">Loading group...</p>
            ) : (
              <div className="space-y-4">
                {dirty && (
                  <p className="text-xs text-amber-700">Unsaved changes</p>
                )}
                {isOwner && selectedGroup && (
                  <p className="text-xs text-text-secondary">
                    Organization: {selectedGroup.organizationName}
                  </p>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Group name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Description</label>
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Assigned role set</label>
                  <SearchableSelect
                    options={roleOptions}
                    value={selectedRoleId}
                    onChange={setSelectedRoleId}
                    placeholder="Select role set..."
                    searchPlaceholder="Search roles..."
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Members</label>
                  <MultiSelectDropdown
                    options={memberOptions}
                    selectedIds={editMemberIds}
                    onChange={setEditMemberIds}
                    placeholder="Select operators..."
                    searchPlaceholder="Search operators..."
                    emptyMessage="No operators in this organization. Invite them under Operators first."
                  />
                  <p className="mt-2 text-xs text-text-secondary">
                    Members inherit permissions from the role set above. You can also assign groups
                    from Operators.
                  </p>
                </div>
              </div>
            )}
          </ExpandableCard>
        </div>
      </div>

      <ConfirmModal
        open={pending?.type === 'create'}
        title="Create user group?"
        message={`Create group "${formName.trim()}" with the selected role set?`}
        confirmLabel="Create"
        loading={actionLoading}
        onConfirm={executeCreate}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={pending?.type === 'save'}
        title="Save group?"
        message={`Update "${selectedGroup?.name}"? Members receive updated permissions on next login.`}
        confirmLabel="Save"
        loading={actionLoading}
        onConfirm={executeSave}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={pending?.type === 'delete'}
        title="Delete group?"
        message={`Permanently delete "${pending?.type === 'delete' ? pending.groupName : ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={actionLoading}
        onConfirm={() =>
          pending?.type === 'delete' ? executeDelete(pending.groupId) : undefined
        }
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
