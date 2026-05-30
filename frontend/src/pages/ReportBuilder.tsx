import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TopBar } from '../components/layout/TopBar'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { LoadingButton } from '../components/ui/LoadingButton'
import { QueryTabBar } from '../components/report/QueryTabBar'
import { ReportBuilderSidebar } from '../components/report/ReportBuilderSidebar'
import { ReportPreviewPanel } from '../components/report/ReportPreviewPanel'
import { ReportSaveModal } from '../components/report/ReportSaveModal'
import { SqlEditor } from '../components/report/SqlEditor'
import { datasourcesApi, type DataSourceSummary } from '../api/datasources'
import { reportBuilderApi } from '../api/reportBuilder'
import {
  reportsApi,
  type SavedReportDetail,
  type SavedReportSummary,
} from '../api/reports'
import { useAuth } from '../auth/AuthContext'
import {
  formatReportDate,
  type ReportCategory,
  type ReportVisualization,
} from '../lib/reportConstants'
import { rowsToChartData, rowsToPieData } from '../lib/queryResultChart'
import { createQueryTab, duplicateTabTitle, type QueryTab } from '../lib/queryTabs'

const initialTab = createQueryTab('', 'Query 1')

type EditorSnapshot = {
  name: string
  description: string
  category: ReportCategory
  sql: string
  visualization: ReportVisualization
  dataSourceId: string
}

function snapshotsEqual(a: EditorSnapshot, b: EditorSnapshot) {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.category === b.category &&
    a.sql === b.sql &&
    a.visualization === b.visualization &&
    a.dataSourceId === b.dataSourceId
  )
}

export function ReportBuilder() {
  const { accessToken, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const canEdit = hasPermission('report-builder', 'edit') || hasPermission('reports', 'edit')
  const canDelete =
    hasPermission('report-builder', 'delete') || hasPermission('reports', 'delete')

  const [dataSources, setDataSources] = useState<DataSourceSummary[]>([])
  const [savedReports, setSavedReports] = useState<SavedReportSummary[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)

  const [tabs, setTabs] = useState<QueryTab[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState(initialTab.id)
  const [previewExpanded, setPreviewExpanded] = useState(false)

  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const [reportName, setReportName] = useState('Untitled report')
  const [reportDescription, setReportDescription] = useState('')
  const [reportCategory, setReportCategory] = useState<ReportCategory>('GENERAL')
  const [selectedDataSourceId, setSelectedDataSourceId] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState<EditorSnapshot | null>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [bannerSuccess, setBannerSuccess] = useState('')

  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SavedReportSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  )

  const updateActiveTab = useCallback(
    (patch: Partial<QueryTab>) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, ...patch } : t)),
      )
    },
    [activeTabId],
  )

  const currentSnapshot = useMemo<EditorSnapshot>(
    () => ({
      name: reportName,
      description: reportDescription,
      category: reportCategory,
      sql: activeTab.sql,
      visualization: activeTab.visualization,
      dataSourceId: selectedDataSourceId,
    }),
    [
      reportName,
      reportDescription,
      reportCategory,
      activeTab.sql,
      activeTab.visualization,
      selectedDataSourceId,
    ],
  )

  const isDirty = savedSnapshot === null || !snapshotsEqual(currentSnapshot, savedSnapshot)

  const splitView = activeTab.previewOpen

  const chartData = useMemo(() => {
    if (!activeTab.queryResult || activeTab.queryResult.rows.length === 0) {
      return { labels: [] as string[], series: [] as { name: string; data: number[] }[] }
    }
    return rowsToChartData(activeTab.queryResult.columns, activeTab.queryResult.rows)
  }, [activeTab.queryResult])

  const pieData = useMemo(() => {
    if (!activeTab.queryResult) return []
    return rowsToPieData(activeTab.queryResult.columns, activeTab.queryResult.rows)
  }, [activeTab.queryResult])

  const loadSavedReports = useCallback(async () => {
    if (!accessToken) return
    const list = await reportsApi.list(accessToken)
    setSavedReports(list)
  }, [accessToken])

  const openReportIds = useMemo(
    () =>
      [
        ...new Set(
          tabs.map((t) => t.savedReportId).filter((id): id is string => id !== null),
        ),
      ],
    [tabs],
  )

  const setReportContext = useCallback(
    (report: SavedReportDetail) => {
      setActiveReportId(report.id)
      setReportName(report.name)
      setReportDescription(report.description ?? '')
      setReportCategory(report.category)
      setSelectedDataSourceId(report.dataSourceId)
      setSavedSnapshot({
        name: report.name,
        description: report.description ?? '',
        category: report.category,
        sql: report.sql,
        visualization: report.visualization,
        dataSourceId: report.dataSourceId,
      })
      setSearchParams({ reportId: report.id }, { replace: true })
    },
    [setSearchParams],
  )

  const openSavedReportInTab = useCallback(
    (report: SavedReportDetail) => {
      setReportContext(report)
      setPreviewExpanded(false)

      const existing = tabs.find((t) => t.savedReportId === report.id)
      if (existing) {
        setActiveTabId(existing.id)
        return
      }

      const tab = createQueryTab(
        report.sql,
        report.name,
        report.visualization,
        report.id,
      )
      setTabs((prev) => [...prev, tab])
      setActiveTabId(tab.id)
    },
    [tabs, setReportContext],
  )

  const syncReportContextForTab = useCallback(
    async (tab: QueryTab) => {
      if (!accessToken || !tab.savedReportId) return
      const report = await reportsApi.get(accessToken, tab.savedReportId)
      setReportContext(report)
    },
    [accessToken, setReportContext],
  )

  const loadReportById = useCallback(
    async (id: string) => {
      if (!accessToken) return
      const report = await reportsApi.get(accessToken, id)
      openSavedReportInTab(report)
    },
    [accessToken, openSavedReportInTab],
  )

  useEffect(() => {
    if (!accessToken) return
    datasourcesApi
      .list(accessToken, true)
      .then((list) => {
        setDataSources(list)
        setSelectedDataSourceId((prev) => prev || list[0]?.id || '')
      })
      .catch(() => setDataSources([]))
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    setReportsLoading(true)
    loadSavedReports()
      .catch((err) =>
        setBannerError(err instanceof Error ? err.message : 'Failed to load reports'),
      )
      .finally(() => setReportsLoading(false))
  }, [accessToken, loadSavedReports])

  const runQuery = useCallback(async () => {
    if (!accessToken || !selectedDataSourceId || !activeTab.sql.trim()) return
    setIsRunning(true)
    updateActiveTab({
      queryError: null,
      queryResult: null,
      previewOpen: true,
    })
    setBannerError('')
    try {
      const result = await reportBuilderApi.executeQuery(accessToken, {
        dataSourceId: selectedDataSourceId,
        sql: activeTab.sql,
      })
      updateActiveTab({ queryResult: result, queryError: null, previewOpen: true })
    } catch (err) {
      updateActiveTab({
        queryError: err instanceof Error ? err.message : 'Query failed',
        queryResult: null,
        previewOpen: true,
      })
    } finally {
      setIsRunning(false)
    }
  }, [accessToken, selectedDataSourceId, activeTab.sql, updateActiveTab])

  useEffect(() => {
    const reportId = searchParams.get('reportId')
    if (!accessToken || !reportId) return

    const existingTab = tabs.find((t) => t.savedReportId === reportId)
    if (existingTab) {
      if (activeTabId !== existingTab.id) {
        setActiveTabId(existingTab.id)
      }
      if (activeReportId !== reportId) {
        syncReportContextForTab(existingTab).catch((err) =>
          setBannerError(err instanceof Error ? err.message : 'Failed to load report'),
        )
      }
      return
    }

    loadReportById(reportId).catch((err) =>
      setBannerError(err instanceof Error ? err.message : 'Failed to load report'),
    )
  }, [
    accessToken,
    searchParams,
    tabs,
    activeTabId,
    activeReportId,
    loadReportById,
    syncReportContextForTab,
  ])

  useEffect(() => {
    if (searchParams.get('run') !== '1' || !selectedDataSourceId) return
    void runQuery()
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('run')
        return next
      },
      { replace: true },
    )
  }, [searchParams, selectedDataSourceId, runQuery, setSearchParams])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void runQuery()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [runQuery])

  function handleNewReport() {
    if (isDirty && !window.confirm('Discard unsaved changes and start a new report?')) {
      return
    }
    const tab = createQueryTab('', 'Query 1')
    setTabs([tab])
    setActiveTabId(tab.id)
    setPreviewExpanded(false)
    setActiveReportId(null)
    setReportName('Untitled report')
    setReportDescription('')
    setReportCategory('GENERAL')
    if (dataSources.length > 0) {
      setSelectedDataSourceId(dataSources[0].id)
    }
    setSavedSnapshot(null)
    setBannerSuccess('')
    setBannerError('')
    setSearchParams({}, { replace: true })
  }

  async function handleSelectReport(report: SavedReportSummary) {
    const existingTab = tabs.find((t) => t.savedReportId === report.id)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      try {
        await syncReportContextForTab(existingTab)
      } catch (err) {
        setBannerError(err instanceof Error ? err.message : 'Failed to load report')
      }
      return
    }

    if (isDirty && !window.confirm('Discard unsaved changes and open this report?')) {
      return
    }

    loadReportById(report.id).catch((err) =>
      setBannerError(err instanceof Error ? err.message : 'Failed to load report'),
    )
  }

  async function handleSelectTab(tabId: string) {
    setActiveTabId(tabId)
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    if (!tab.savedReportId) {
      setActiveReportId(null)
      setReportName('Untitled report')
      setReportDescription('')
      setReportCategory('GENERAL')
      setSavedSnapshot(null)
      setSearchParams({}, { replace: true })
      return
    }

    try {
      await syncReportContextForTab(tab)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to load report')
    }
  }

  function handleAddTab() {
    const tab = createQueryTab(
      '',
      duplicateTabTitle(
        tabs.map((t) => t.title),
        'New query',
      ),
    )
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
  }

  function handleCloseTab(id: string) {
    if (tabs.length <= 1) return
    const closing = tabs.find((t) => t.id === id)
    const idx = tabs.findIndex((t) => t.id === id)
    const next = tabs.filter((t) => t.id !== id)
    setTabs(next)
    if (activeTabId === id) {
      const fallback = next[Math.max(0, idx - 1)] ?? next[0]
      setActiveTabId(fallback.id)
      void handleSelectTab(fallback.id)
    } else if (
      closing?.savedReportId &&
      closing.savedReportId === activeReportId &&
      !next.some((t) => t.savedReportId === closing.savedReportId)
    ) {
      setActiveReportId(null)
      setReportName('Untitled report')
      setReportDescription('')
      setReportCategory('GENERAL')
      setSavedSnapshot(null)
      setSearchParams({}, { replace: true })
    }
  }

  function closePreview() {
    updateActiveTab({ previewOpen: false })
    setPreviewExpanded(false)
  }

  async function handleSaveConfirm(data: {
    name: string
    description: string
    category: ReportCategory
  }) {
    if (!accessToken) return
    setIsSaving(true)
    setBannerError('')
    try {
      const payload = {
        name: data.name,
        description: data.description || null,
        category: data.category,
        sql: activeTab.sql,
        visualization: activeTab.visualization,
        dataSourceId: selectedDataSourceId,
      }

      let saved: SavedReportDetail
      if (activeReportId) {
        saved = await reportsApi.update(accessToken, activeReportId, payload)
        setBannerSuccess(`Report "${saved.name}" updated`)
      } else {
        saved = await reportsApi.create(accessToken, payload)
        setBannerSuccess(`Report "${saved.name}" saved`)
      }

      setReportContext(saved)
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                savedReportId: saved.id,
                title: saved.name,
                sql: saved.sql,
                visualization: saved.visualization,
              }
            : t,
        ),
      )
      await loadSavedReports()
      setSaveModalOpen(false)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to save report')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!accessToken || !pendingDelete) return
    setDeleteLoading(true)
    setBannerError('')
    try {
      await reportsApi.delete(accessToken, pendingDelete.id)
      setBannerSuccess(`Report "${pendingDelete.name}" moved to trash`)
      const deletedId = pendingDelete.id
      setTabs((prev) => {
        const next = prev.filter((t) => t.savedReportId !== deletedId)
        if (activeReportId === deletedId) {
          if (next.length > 0) {
            const fallback = next[0]
            setActiveTabId(fallback.id)
            void handleSelectTab(fallback.id)
          } else {
            const tab = createQueryTab('', 'Query 1')
            setActiveTabId(tab.id)
            setActiveReportId(null)
            setReportName('Untitled report')
            setReportDescription('')
            setReportCategory('GENERAL')
            setSavedSnapshot(null)
            setSearchParams({}, { replace: true })
            return [tab]
          }
        }
        return next
      })
      await loadSavedReports()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to delete report')
    } finally {
      setDeleteLoading(false)
      setPendingDelete(null)
    }
  }

  const activeDataSource = dataSources.find((d) => d.id === selectedDataSourceId)

  const editorPaneClass = splitView
    ? previewExpanded
      ? 'h-[min(28%,200px)] shrink-0'
      : 'min-h-0 flex-1'
    : 'min-h-0 flex-1'

  const previewPaneClass = splitView
    ? previewExpanded
      ? 'min-h-0 flex-[3]'
      : 'min-h-0 flex-1'
    : 'hidden'

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Report Builder"
        showDateFilter={false}
        showExport={false}
        primaryAction={
          canEdit
            ? {
                label: activeReportId ? 'Save changes' : 'Save report',
                onClick: () => {
                  if (!selectedDataSourceId) {
                    setBannerError('Select a data source before saving')
                    return
                  }
                  if (!activeTab.sql.trim()) {
                    setBannerError('SQL query cannot be empty')
                    return
                  }
                  setSaveModalOpen(true)
                },
                icon: 'ti-device-floppy',
              }
            : undefined
        }
      />

      {(bannerError || bannerSuccess) && (
        <div
          className={`shrink-0 px-6 py-2 text-sm ${bannerError ? 'bg-semantic-red/10 text-semantic-red' : 'bg-semantic-green/10 text-semantic-green'}`}
        >
          {bannerError || bannerSuccess}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ReportBuilderSidebar
          reports={savedReports}
          activeReportId={activeReportId}
          openReportIds={openReportIds}
          loading={reportsLoading}
          canEdit={canEdit}
          canDelete={canDelete}
          onSelect={handleSelectReport}
          onNew={handleNewReport}
          onDelete={setPendingDelete}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-primary">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-secondary px-4 py-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-text-primary">
                  {reportName}
                </h1>
                {isDirty ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Unsaved
                  </span>
                ) : activeReportId ? (
                  <span className="rounded-full bg-semantic-green/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-semantic-green">
                    Saved
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                {activeDataSource
                  ? `${activeDataSource.name} · ${activeDataSource.database}`
                  : 'No data source'}
                {activeReportId && savedReports.find((r) => r.id === activeReportId) && (
                  <>
                    {' '}
                    · Updated{' '}
                    {formatReportDate(
                      savedReports.find((r) => r.id === activeReportId)!.updatedAt,
                    )}
                  </>
                )}
                {' '}
                · Active tab: {activeTab.title}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedDataSourceId}
                onChange={(e) => setSelectedDataSourceId(e.target.value)}
                disabled={dataSources.length === 0}
                className="min-w-[160px] rounded-sm border border-border bg-bg-primary px-2 py-1.5 text-sm outline-none focus:border-brand-blue"
              >
                {dataSources.length === 0 ? (
                  <option value="">No data sources</option>
                ) : (
                  dataSources.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name}
                    </option>
                  ))
                )}
              </select>
              <LoadingButton
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                loading={isRunning}
                disabled={!selectedDataSourceId || !activeTab.sql.trim()}
                onClick={runQuery}
              >
                {!isRunning && <i className="ti ti-player-play"></i>}
                Run query
              </LoadingButton>
              <span className="hidden text-[10px] text-text-secondary lg:inline">⌘↵</span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <QueryTabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={(id) => void handleSelectTab(id)}
              onAdd={handleAddTab}
              onClose={handleCloseTab}
            />

            <div className="flex min-h-0 flex-1 flex-col">
              <div className={`flex flex-col overflow-hidden ${editorPaneClass}`}>
                <div className="flex min-h-0 flex-1 flex-col bg-[#1e1e1e] p-4 text-[#d4d4d4]">
                  {!splitView && (
                    <p className="mb-2 shrink-0 text-[11px] text-[#858585]">
                      Write SQL below, then run query to open split preview.
                    </p>
                  )}
                  <SqlEditor
                    value={activeTab.sql}
                    onChange={(sql) => updateActiveTab({ sql })}
                    minHeight={splitView && !previewExpanded ? '100%' : '320px'}
                  />
                </div>
              </div>

              {splitView && (
                <>
                  <div className="relative shrink-0 border-y border-border bg-border">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] text-text-secondary">
                      {previewExpanded ? 'Expanded preview' : 'Split view'}
                    </div>
                  </div>
                  <div className={previewPaneClass}>
                    <ReportPreviewPanel
                      visualization={activeTab.visualization}
                      onVisualizationChange={(v) => updateActiveTab({ visualization: v })}
                      queryResult={activeTab.queryResult}
                      queryError={activeTab.queryError}
                      isRunning={isRunning}
                      chartData={chartData}
                      pieData={pieData}
                      previewExpanded={previewExpanded}
                      onToggleExpand={() => setPreviewExpanded((e) => !e)}
                      onClosePreview={closePreview}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReportSaveModal
        open={saveModalOpen}
        title={activeReportId ? 'Save report changes' : 'Save new report'}
        initialName={reportName === 'Untitled report' ? '' : reportName}
        initialDescription={reportDescription}
        initialCategory={reportCategory}
        loading={isSaving}
        onConfirm={handleSaveConfirm}
        onCancel={() => setSaveModalOpen(false)}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete report?"
        message={`Soft-delete "${pendingDelete?.name}"? It will be removed from the catalog and builder.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
