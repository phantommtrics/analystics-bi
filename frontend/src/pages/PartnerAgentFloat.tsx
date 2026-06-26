import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  partnerAgentFloatApi,
  type DeliveryHistoryItem,
  type PartnerAgentFloatConfig,
  type PartnerAgentFloatStatus,
  type PreviewSnapshot,
} from '../api/partnerAgentFloat'
import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { TablePagination } from '../components/ui/TablePagination'
import { useAuth } from '../auth/AuthContext'

const PAGE_SIZE = 20

const STATUS_VARIANTS = {
  SUCCESS: 'green',
  FAILED: 'red',
  RUNNING: 'amber',
} as const

type ConfigFormState = {
  enabled: boolean
  apiUrl: string
  partnerOrgCode: string
  intervalMinutes: number
  apiKey: string
  hmacSecret: string
  encryptionKey: string
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatInterval(ms: number) {
  if (ms % 60_000 === 0) {
    return `${ms / 60_000} min`
  }
  return `${Math.round(ms / 1000)} sec`
}

function emptyForm(): ConfigFormState {
  return {
    enabled: false,
    apiUrl: '',
    partnerOrgCode: '',
    intervalMinutes: 5,
    apiKey: '',
    hmacSecret: '',
    encryptionKey: '',
  }
}

function configToForm(config: PartnerAgentFloatConfig): ConfigFormState {
  return {
    enabled: config.enabled,
    apiUrl: config.apiUrl,
    partnerOrgCode: config.partnerOrgCode,
    intervalMinutes: Math.round(config.intervalMs / 60_000),
    apiKey: '',
    hmacSecret: '',
    encryptionKey: '',
  }
}

function statusToForm(status: PartnerAgentFloatStatus): ConfigFormState {
  return configToForm(status)
}

function openConfigForm(
  status: PartnerAgentFloatStatus | null,
  mode: 'add' | 'edit',
): ConfigFormState {
  if (mode === 'edit' && status) {
    return statusToForm(status)
  }
  return emptyForm()
}

export function PartnerAgentFloat() {
  const { accessToken, hasPermission } = useAuth()
  const canEdit = hasPermission('partner-agent-float', 'edit')

  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [canSelectOrganization, setCanSelectOrganization] = useState(false)
  const [status, setStatus] = useState<PartnerAgentFloatStatus | null>(null)
  const [configForm, setConfigForm] = useState<ConfigFormState | null>(null)
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [deliveries, setDeliveries] = useState<DeliveryHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState<PreviewSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadContext = useCallback(async () => {
    if (!accessToken) return
    const ctx = await partnerAgentFloatApi.context(accessToken, organizationId ?? undefined)
    setOrganizations(ctx.organizations)
    setCanSelectOrganization(ctx.canSelectOrganization)
    if (!organizationId && ctx.organizationId) {
      setOrganizationId(ctx.organizationId)
    } else if (!organizationId && ctx.organizations.length > 0) {
      setOrganizationId(ctx.organizations[0].id)
    }
  }, [accessToken, organizationId])

  const loadData = useCallback(async () => {
    if (!accessToken || !organizationId) return
    setLoading(true)
    setError('')
    try {
      const [configResult, statusResult, historyResult] = await Promise.all([
        partnerAgentFloatApi.getConfig(accessToken, organizationId),
        partnerAgentFloatApi.status(accessToken, organizationId),
        partnerAgentFloatApi.deliveries(accessToken, page, PAGE_SIZE, organizationId),
      ])
      setStatus(statusResult)
      setConfigForm(configToForm(configResult))
      setShowConfigForm(false)
      setDeliveries(historyResult.items)
      setTotal(historyResult.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent float sync')
    } finally {
      setLoading(false)
    }
  }, [accessToken, organizationId, page])

  useEffect(() => {
    void loadContext().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load organization context')
    })
  }, [loadContext])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken || !organizationId || !configForm || !canEdit) return
    setConfigSaving(true)
    setError('')
    setSuccess('')
    try {
      await partnerAgentFloatApi.updateConfig(
        accessToken,
        {
          enabled: configForm.enabled,
          apiUrl: configForm.apiUrl,
          partnerOrgCode: configForm.partnerOrgCode,
          intervalMs: configForm.intervalMinutes * 60_000,
          ...(configForm.apiKey ? { apiKey: configForm.apiKey } : {}),
          ...(configForm.hmacSecret ? { hmacSecret: configForm.hmacSecret } : {}),
          ...(configForm.encryptionKey ? { encryptionKey: configForm.encryptionKey } : {}),
        },
        organizationId,
      )
      setSuccess('Partner integration settings saved')
      setShowConfigForm(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setConfigSaving(false)
    }
  }

  const handleRunNow = async () => {
    if (!accessToken || !organizationId || !canEdit) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await partnerAgentFloatApi.run(accessToken, organizationId)
      if (result.status === 'SUCCESS') {
        setSuccess(
          `Delivered ${result.recordCount} agent balance(s) in ${result.durationMs}ms`,
        )
      } else {
        setError(result.errorMessage ?? 'Delivery failed')
      }
      setPage(1)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!accessToken || !organizationId) return
    setActionLoading(true)
    setError('')
    try {
      const result = await partnerAgentFloatApi.preview(accessToken, 50, organizationId)
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setActionLoading(false)
    }
  }

  const historyColumns = useMemo(
    () => [
      {
        header: 'Sent at',
        accessor: (row: DeliveryHistoryItem) => formatDateTime(row.createdAt),
      },
      {
        header: 'Status',
        accessor: (row: DeliveryHistoryItem) => (
          <Badge variant={STATUS_VARIANTS[row.status]}>{row.status}</Badge>
        ),
      },
      {
        header: 'Agents',
        accessor: (row: DeliveryHistoryItem) => row.recordCount.toLocaleString(),
        isNumeric: true,
      },
      {
        header: 'HTTP',
        accessor: (row: DeliveryHistoryItem) => row.httpStatus ?? '—',
        isNumeric: true,
      },
      {
        header: 'Duration',
        accessor: (row: DeliveryHistoryItem) =>
          row.durationMs != null ? `${row.durationMs}ms` : '—',
      },
      {
        header: 'Delivery ID',
        accessor: (row: DeliveryHistoryItem) => (
          <span className="font-mono text-xs">{row.deliveryId}</span>
        ),
      },
      {
        header: 'Error',
        accessor: (row: DeliveryHistoryItem) => row.errorMessage ?? '—',
      },
    ],
    [],
  )

  const previewColumns = useMemo(
    () => [
      {
        header: 'Agent number',
        accessor: (row: PreviewSnapshot['agents'][number]) => row.agent_number,
      },
      {
        header: 'After balance',
        accessor: (row: PreviewSnapshot['agents'][number]) => row.after_balance,
        isNumeric: true,
      },
      {
        header: 'Balance as of',
        accessor: (row: PreviewSnapshot['agents'][number]) =>
          formatDateTime(row.balance_as_of),
      },
    ],
    [],
  )

  const selectedOrgName =
    organizations.find((o) => o.id === organizationId)?.name ?? status?.organizationName

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Agent Float Sync"
        showDateFilter={false}
        showExport={false}
        primaryAction={
          canEdit
            ? {
                label: actionLoading ? 'Running…' : 'Run now',
                onClick: () => void handleRunNow(),
                icon: actionLoading ? 'ti-loader' : 'ti-player-play',
              }
            : undefined
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {canSelectOrganization && organizations.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  Organization
                  <select
                    value={organizationId ?? ''}
                    onChange={(e) => {
                      setOrganizationId(e.target.value)
                      setPage(1)
                      setPreview(null)
                      setShowConfigForm(false)
                    }}
                    className="rounded-sm border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!canSelectOrganization && selectedOrgName && (
                <span className="text-sm text-text-secondary">{selectedOrgName}</span>
              )}
            </div>
            <button
              type="button"
              disabled={actionLoading || loading || !organizationId}
              onClick={() => void handlePreview()}
              className="rounded-sm border border-border bg-bg-secondary px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Preview snapshot
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-md border border-semantic-red/30 bg-semantic-red/10 px-4 py-3 text-sm text-semantic-red">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-semantic-green/30 bg-semantic-green/10 px-4 py-3 text-sm text-semantic-green">
            {success}
          </div>
        )}

        {canEdit && (
          <Card className="mb-6">
            <CardHeader
              className="!items-start"
              action={
                !showConfigForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfigForm(
                        openConfigForm(status, status?.hasIntegration ? 'edit' : 'add'),
                      )
                      setShowConfigForm(true)
                      setError('')
                      setSuccess('')
                    }}
                    className="flex shrink-0 items-center gap-2 rounded-sm bg-brand-navy px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-navy/90"
                  >
                    <i className={`ti ${status?.hasIntegration ? 'ti-pencil' : 'ti-plus'}`} />
                    {status?.hasIntegration ? 'Edit' : 'Add'}
                  </button>
                ) : undefined
              }
            >
              <div>
                <CardTitle>Partner integration</CardTitle>
                <p className="mt-1 text-sm text-text-secondary">
                  {status?.hasIntegration
                    ? 'Credentials are stored per organization and encrypted at rest. Share the partner org code with your partner so they can verify each delivery.'
                    : 'No partner integration configured for this organization yet.'}
                </p>
              </div>
            </CardHeader>
            {showConfigForm && configForm && (
              <form onSubmit={(e) => void handleSaveConfig(e)} className="grid gap-4 md:grid-cols-2">
                {status && (
                  <div className="rounded-md border border-border bg-bg-secondary/50 p-3 text-sm md:col-span-2">
                    <p className="font-medium text-text-primary">Organization ID (auto-included in deliveries)</p>
                    <p className="mt-1 font-mono text-xs text-text-primary">{status.organizationId}</p>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-text-primary md:col-span-2">
                  <input
                    type="checkbox"
                    checked={configForm.enabled}
                    onChange={(e) =>
                      setConfigForm((f) => (f ? { ...f, enabled: e.target.checked } : f))
                    }
                  />
                  Enable scheduled delivery for this organization
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="mb-1 block font-medium text-text-primary">
                    Partner org code
                  </span>
                  <input
                    type="text"
                    required
                    value={configForm.partnerOrgCode}
                    onChange={(e) =>
                      setConfigForm((f) => (f ? { ...f, partnerOrgCode: e.target.value } : f))
                    }
                    placeholder="e.g. PHANTOM-AGENT-FLOAT"
                    pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,63}"
                    title="3–64 characters: letters, numbers, hyphens, underscores"
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-text-primary">Partner API URL</span>
                  <input
                    type="url"
                    required
                    value={configForm.apiUrl}
                    onChange={(e) =>
                      setConfigForm((f) => (f ? { ...f, apiUrl: e.target.value } : f))
                    }
                    placeholder="https://partner.example.com/api/agent-float"
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-text-primary">
                    Delivery interval (minutes)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    required
                    value={configForm.intervalMinutes}
                    onChange={(e) =>
                      setConfigForm((f) =>
                        f ? { ...f, intervalMinutes: Number(e.target.value) } : f,
                      )
                    }
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-text-primary">API key (Bearer)</span>
                  <input
                    type="password"
                    value={configForm.apiKey}
                    required={!status?.hasIntegration}
                    onChange={(e) =>
                      setConfigForm((f) => (f ? { ...f, apiKey: e.target.value } : f))
                    }
                    placeholder={
                      status?.keysConfigured.apiKey ? 'Leave blank to keep current' : ''
                    }
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-text-primary">HMAC secret</span>
                  <input
                    type="password"
                    value={configForm.hmacSecret}
                    required={!status?.hasIntegration}
                    onChange={(e) =>
                      setConfigForm((f) => (f ? { ...f, hmacSecret: e.target.value } : f))
                    }
                    placeholder={
                      status?.keysConfigured.hmacSecret ? 'Leave blank to keep current' : ''
                    }
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2"
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="mb-1 block font-medium text-text-primary">
                    Encryption key (base64, 32 bytes)
                  </span>
                  <input
                    type="password"
                    value={configForm.encryptionKey}
                    required={!status?.hasIntegration}
                    onChange={(e) =>
                      setConfigForm((f) => (f ? { ...f, encryptionKey: e.target.value } : f))
                    }
                    placeholder={
                      status?.keysConfigured.encryptionKey ? 'Leave blank to keep current' : ''
                    }
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-2"
                  />
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <button
                    type="submit"
                    disabled={configSaving}
                    className="rounded-sm bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
                  >
                    {configSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={configSaving}
                    onClick={() => {
                      setShowConfigForm(false)
                      if (status) {
                        setConfigForm(statusToForm(status))
                      }
                    }}
                    className="rounded-sm border border-border bg-bg-secondary px-4 py-2 text-sm text-text-primary hover:bg-bg-tertiary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </Card>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduler</CardTitle>
            </CardHeader>
            <p className="text-2xl font-semibold text-text-primary">
              {status?.enabled ? 'Enabled' : 'Disabled'}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Interval: {status ? formatInterval(status.intervalMs) : '—'}
            </p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <p className="text-sm font-medium text-text-primary">
              {status?.partnerOrgCode || 'No partner org code'}
            </p>
            <p className="mt-1 font-mono text-xs text-text-secondary">
              {status?.organizationId ?? '—'}
            </p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Last delivery</CardTitle>
            </CardHeader>
            {status?.lastDelivery ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANTS[status.lastDelivery.status]}>
                    {status.lastDelivery.status}
                  </Badge>
                  <span className="text-sm text-text-secondary">
                    {status.lastDelivery.recordCount.toLocaleString()} agents
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  {formatDateTime(status.lastDelivery.createdAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-secondary">No deliveries yet</p>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next run</CardTitle>
            </CardHeader>
            <p className="text-sm font-medium text-text-primary">
              {formatDateTime(status?.nextRunAt)}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {status?.configured ? 'Ready to deliver' : 'Configure partner settings to enable'}
            </p>
          </Card>
        </div>

        {preview && (
          <Card noPadding className="mb-6">
            <CardHeader className="mb-0 border-b border-border p-5">
              <CardTitle>
                Preview ({preview.agents.length} of {preview.totalAgents.toLocaleString()} agents)
              </CardTitle>
              <p className="mt-1 text-sm text-text-secondary">
                Snapshot at {formatDateTime(preview.snapshotAt)}
              </p>
            </CardHeader>
            <DataTable
              columns={previewColumns}
              data={preview.agents}
              keyExtractor={(row) => row.agent_number}
            />
          </Card>
        )}

        <Card noPadding>
          <CardHeader className="mb-0 border-b border-border p-5">
            <CardTitle>Delivery history</CardTitle>
          </CardHeader>
          {loading ? (
            <div className="p-8 text-center text-sm text-text-secondary">Loading deliveries…</div>
          ) : (
            <>
              <DataTable
                columns={historyColumns}
                data={deliveries}
                keyExtractor={(row) => row.id}
              />
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                totalRows={total}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
