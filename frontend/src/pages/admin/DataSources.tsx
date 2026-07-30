import { useCallback, useEffect, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { DataTable } from '../../components/ui/DataTable'
import { LoadingButton } from '../../components/ui/LoadingButton'
import {
  datasourcesApi,
  type DataSourceSummary,
} from '../../api/datasources'
import { adminApi, type OrganizationSummary } from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'

type PendingAction =
  | { type: 'create' }
  | { type: 'save' }
  | { type: 'delete'; dataSource: DataSourceSummary }
  | null

type FormState = {
  name: string
  host: string
  port: string
  database: string
  username: string
  password: string
  sslMode: 'DISABLE' | 'REQUIRE'
  isActive: boolean
}

const emptyForm = (): FormState => ({
  name: '',
  host: '',
  port: '5432',
  database: '',
  username: '',
  password: '',
  sslMode: 'REQUIRE',
  isActive: true,
})

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

export function DataSources() {
  const { accessToken, user } = useAuth()
  const [dataSources, setDataSources] = useState<DataSourceSummary[]>([])
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [listOrganizationId, setListOrganizationId] = useState('')
  const [formOrganizationId, setFormOrganizationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [form, setForm] = useState<FormState>(emptyForm())

  const isOwner = user?.userType === 'OWNER'
  const defaultOrgId =
    organizations.find((o) => o.isDefault)?.id ?? organizations[0]?.id ?? ''

  const loadData = useCallback(async () => {
    if (!accessToken) return
    const orgList = isOwner ? await adminApi.listOrganizations(accessToken) : []
    const list = await datasourcesApi.list(
      accessToken,
      false,
      listOrganizationId || undefined,
    )
    setOrganizations(orgList)
    setDataSources(list)
    if (!formOrganizationId) {
      const orgId = orgList.find((o) => o.isDefault)?.id ?? orgList[0]?.id ?? ''
      if (orgId) setFormOrganizationId(orgId)
    }
  }, [accessToken, formOrganizationId, isOwner, listOrganizationId])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [accessToken, loadData])

  function openCreateForm() {
    setEditingId(null)
    setForm(emptyForm())
    setFormOrganizationId(listOrganizationId || defaultOrgId)
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  function openEditForm(dataSource: DataSourceSummary) {
    setEditingId(dataSource.id)
    setForm({
      name: dataSource.name,
      host: dataSource.host,
      port: String(dataSource.port),
      database: dataSource.database,
      username: dataSource.username,
      password: '',
      sslMode: dataSource.sslMode,
      isActive: dataSource.isActive,
    })
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  async function executeSave() {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        name: form.name.trim(),
        host: form.host.trim(),
        port: Number(form.port),
        database: form.database.trim(),
        username: form.username.trim(),
        sslMode: form.sslMode,
        isActive: form.isActive,
        ...(form.password.trim() ? { password: form.password } : {}),
      }

      if (editingId) {
        if (!payload.name || !payload.host || !payload.database || !payload.username) {
          throw new Error('Please fill in all required fields')
        }
        await datasourcesApi.update(accessToken, editingId, payload)
        setSuccess(`Data source "${payload.name}" updated`)
      } else {
        if (!form.password.trim()) {
          throw new Error('Password is required for new data sources')
        }
        await datasourcesApi.create(accessToken, {
          ...payload,
          password: form.password,
          organizationId: formOrganizationId || defaultOrgId || undefined,
        })
        setSuccess(`Data source "${payload.name}" created`)
      }

      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm())
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save data source')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  async function executeDelete(dataSource: DataSourceSummary) {
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    try {
      await datasourcesApi.delete(accessToken, dataSource.id)
      setSuccess(`Data source "${dataSource.name}" deleted`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete data source')
    } finally {
      setActionLoading(false)
      setPending(null)
    }
  }

  async function handleTest(dataSource: DataSourceSummary) {
    if (!accessToken) return
    setTestingId(dataSource.id)
    setError('')
    try {
      const result = await datasourcesApi.test(accessToken, dataSource.id)
      setTestResults((prev) => ({
        ...prev,
        [dataSource.id]: {
          ok: result.ok,
          message: result.ok
            ? `Connected in ${result.latencyMs}ms`
            : (result.message ?? 'Connection failed'),
        },
      }))
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [dataSource.id]: {
          ok: false,
          message: err instanceof Error ? err.message : 'Connection failed',
        },
      }))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Data Sources"
        primaryAction={{
          label: 'New Data Source',
          onClick: openCreateForm,
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

        {isOwner && organizations.length > 1 && (
          <div className="mb-4 max-w-md">
            <FieldLabel>Filter by organization</FieldLabel>
            <select
              value={listOrganizationId}
              onChange={(e) => setListOrganizationId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            >
              <option value="">All organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                  {org.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? 'Edit data source' : 'Add data source'}</CardTitle>
            </CardHeader>
            <p className="mb-4 text-sm text-text-secondary">
              Register a read-only PostgreSQL connection to your client&apos;s database. Credentials
              are encrypted before storage.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {isOwner && organizations.length > 0 && !editingId && (
                <div className="md:col-span-2">
                  <FieldLabel>Organization</FieldLabel>
                  <select
                    value={formOrganizationId || defaultOrgId}
                    onChange={(e) => setFormOrganizationId(e.target.value)}
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
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
                <FieldLabel>Name</FieldLabel>
                <FieldInput
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Client Production DB"
                />
              </div>
              <div>
                <FieldLabel>Host</FieldLabel>
                <FieldInput
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  placeholder="db.example.com"
                />
              </div>
              <div>
                <FieldLabel>Port</FieldLabel>
                <FieldInput
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>Database</FieldLabel>
                <FieldInput
                  value={form.database}
                  onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                  placeholder="analytics"
                />
              </div>
              <div>
                <FieldLabel>Username</FieldLabel>
                <FieldInput
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div>
                <FieldLabel>
                  Password{editingId ? ' (leave blank to keep current)' : ''}
                </FieldLabel>
                <FieldInput
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <FieldLabel>SSL</FieldLabel>
                <select
                  value={form.sslMode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sslMode: e.target.value as 'DISABLE' | 'REQUIRE',
                    }))
                  }
                  className="w-full rounded-md border border-border bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
                >
                  <option value="REQUIRE">Require SSL</option>
                  <option value="DISABLE">Disable SSL</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-border"
                  />
                  Active (available in Report Builder)
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <LoadingButton
                loading={actionLoading && (pending?.type === 'create' || pending?.type === 'save')}
                disabled={!form.name.trim() || !form.host.trim() || !form.database.trim()}
                onClick={() => setPending({ type: editingId ? 'save' : 'create' })}
              >
                {editingId ? 'Save changes' : 'Create data source'}
              </LoadingButton>
              <LoadingButton
                variant="secondary"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  setForm(emptyForm())
                }}
              >
                Cancel
              </LoadingButton>
            </div>
          </Card>
        )}

        <Card noPadding>
          {loading ? (
            <p className="p-5 text-sm text-text-secondary">Loading...</p>
          ) : dataSources.length === 0 ? (
            <p className="p-5 text-sm text-text-secondary">
              No data sources configured. Add a connection to your client&apos;s read-only
              PostgreSQL database.
            </p>
          ) : (
            <DataTable
              data={dataSources}
              keyExtractor={(ds) => ds.id}
              columns={[
                ...(isOwner && organizations.length > 1
                  ? [
                      {
                        header: 'Organization',
                        accessor: (ds: DataSourceSummary) => (
                          <span className="text-sm text-text-secondary">{ds.organizationName}</span>
                        ),
                      },
                    ]
                  : []),
                {
                  header: 'Name',
                  accessor: (ds) => (
                    <div>
                      <div className="font-medium">{ds.name}</div>
                      <div className="text-xs text-text-secondary">
                        {ds.host}:{ds.port}/{ds.database}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'User',
                  accessor: (ds) => ds.username,
                  className: 'text-sm text-text-secondary',
                },
                {
                  header: 'SSL',
                  accessor: (ds) => ds.sslMode,
                  className: 'text-sm text-text-secondary',
                },
                {
                  header: 'Status',
                  accessor: (ds) => (
                    <Badge variant={ds.isActive ? 'green' : 'gray'}>
                      {ds.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  header: 'Connection',
                  accessor: (ds) => {
                    const result = testResults[ds.id]
                    return (
                      <div className="flex flex-col gap-1">
                        <LoadingButton
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          loading={testingId === ds.id}
                          onClick={() => handleTest(ds)}
                        >
                          Test
                        </LoadingButton>
                        {result && (
                          <span
                            className={`text-xs ${result.ok ? 'text-semantic-green' : 'text-semantic-red'}`}
                          >
                            {result.message}
                          </span>
                        )}
                      </div>
                    )
                  },
                },
                {
                  header: 'Actions',
                  accessor: (ds) => (
                    <div className="flex gap-2">
                      <LoadingButton
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() => openEditForm(ds)}
                      >
                        Edit
                      </LoadingButton>
                      <LoadingButton
                        variant="danger"
                        className="px-2 py-1 text-xs"
                        loading={
                          actionLoading &&
                          pending?.type === 'delete' &&
                          pending.dataSource.id === ds.id
                        }
                        onClick={() => setPending({ type: 'delete', dataSource: ds })}
                      >
                        Delete
                      </LoadingButton>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <ConfirmModal
        open={pending?.type === 'create' || pending?.type === 'save'}
        title={editingId ? 'Save data source?' : 'Create data source?'}
        message={
          editingId
            ? `Save changes to "${form.name.trim()}"?`
            : `Register "${form.name.trim()}" as a read-only PostgreSQL data source?`
        }
        confirmLabel={editingId ? 'Save' : 'Create'}
        loading={actionLoading}
        onConfirm={executeSave}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={pending?.type === 'delete'}
        title="Delete data source?"
        message={`Permanently delete "${pending?.type === 'delete' ? pending.dataSource.name : ''}"? Reports using this source will stop working.`}
        confirmLabel="Delete"
        variant="danger"
        loading={actionLoading}
        onConfirm={() =>
          pending?.type === 'delete' ? executeDelete(pending.dataSource) : undefined
        }
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
