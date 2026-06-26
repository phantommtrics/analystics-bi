import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  partnerAgentFloatApi,
  type DeliveryHistoryItem,
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

export function PartnerAgentFloat() {
  const { accessToken, hasPermission } = useAuth()
  const canRun = hasPermission('partner-agent-float', 'edit')

  const [status, setStatus] = useState<PartnerAgentFloatStatus | null>(null)
  const [deliveries, setDeliveries] = useState<DeliveryHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState<PreviewSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const [statusResult, historyResult] = await Promise.all([
        partnerAgentFloatApi.status(accessToken),
        partnerAgentFloatApi.deliveries(accessToken, page, PAGE_SIZE),
      ])
      setStatus(statusResult)
      setDeliveries(historyResult.items)
      setTotal(historyResult.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent float sync')
    } finally {
      setLoading(false)
    }
  }, [accessToken, page])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleRunNow = async () => {
    if (!accessToken || !canRun) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await partnerAgentFloatApi.run(accessToken)
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
    if (!accessToken) return
    setActionLoading(true)
    setError('')
    try {
      const result = await partnerAgentFloatApi.preview(accessToken, 50)
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

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Agent Float Sync"
        showDateFilter={false}
        showExport={false}
        primaryAction={
          canRun
            ? {
                label: actionLoading ? 'Running…' : 'Run now',
                onClick: () => void handleRunNow(),
                icon: actionLoading ? 'ti-loader' : 'ti-player-play',
              }
            : undefined
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-secondary">
              Periodic EMoney agent float balance delivery to partner API
            </p>
            <button
              type="button"
              disabled={actionLoading || loading}
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
              <CardTitle>Partner API</CardTitle>
            </CardHeader>
            <p className="text-sm font-medium text-text-primary">
              {status?.apiUrlMasked || 'Not configured'}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Keys:{' '}
              {status
                ? [
                    status.keysConfigured.apiKey && 'API key',
                    status.keysConfigured.hmacSecret && 'HMAC',
                    status.keysConfigured.encryptionKey && 'Encryption',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'None'
                : '—'}
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
              {status?.configured ? 'Ready to deliver' : 'Configure .env secrets to enable'}
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
