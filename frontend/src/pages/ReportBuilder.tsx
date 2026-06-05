import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TopBar } from '../components/layout/TopBar'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { LoadingButton } from '../components/ui/LoadingButton'
import { QueryTabBar } from '../components/report/QueryTabBar'
import { DatabaseTableExplorer, type SqlInsertMode } from '../components/report/DatabaseTableExplorer'
import { ReportBuilderQueryPreview } from '../components/report/ReportBuilderQueryPreview'
import { ReportBuilderSidebar } from '../components/report/ReportBuilderSidebar'
import { ReportSaveModal } from '../components/report/ReportSaveModal'
import { SqlEditor, type SqlEditorHandle } from '../components/report/SqlEditor'
import { datasourcesApi, type DataSourceSummary } from '../api/datasources'
import { reportBuilderApi } from '../api/reportBuilder'
import {
  reportsApi,
  type SavedReportSummary,
} from '../api/reports'
import { useAuth } from '../auth/AuthContext'
import {
  formatReportDate,
  type ReportCategory,
} from '../lib/reportConstants'
import { ReportVariablesPanel } from '../components/report/ReportVariablesPanel'
import { useReportVariables } from '../hooks/useReportVariables'
import { rowsToChartData, rowsToPieData } from '../lib/queryResultChart'
import {
  createQueryTab,
  duplicateTabTitle,
  isQueryTabDirty,
  queryTabFromDetail,
  type QueryEditorSnapshot,
  type QueryTab,
} from '../lib/queryTabs'

const initialTab = createQueryTab({ title: 'Query 1' })

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

  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [bannerSuccess, setBannerSuccess] = useState('')

  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SavedReportSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [pendingUnpublish, setPendingUnpublish] = useState(false)

  const sqlEditorRef = useRef<SqlEditorHandle>(null)

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  )

  const {
    variables,
    values: variableValues,
    queryFilters,
    hasDateVariables,
    dateFilters,
    dateFiltersEnabled,
    setVariable,
    setDateFilters,
  } = useReportVariables(activeTab.sql)

  const updateActiveTab = useCallback(
    (patch: Partial<QueryTab>) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, ...patch } : t)),
      )
    },
    [activeTabId],
  )

  const isDirty = isQueryTabDirty(activeTab)
  const activeReportId = activeTab.savedReportId

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

  const syncUrlForTab = useCallback(
    (tab: QueryTab) => {
      if (tab.savedReportId) {
        setSearchParams({ reportId: tab.savedReportId }, { replace: true })
      } else {
        setSearchParams({}, { replace: true })
      }
    },
    [setSearchParams],
  )

  const openSavedReportInTab = useCallback(
    (report: Parameters<typeof queryTabFromDetail>[0]) => {
      const existing = tabs.find((t) => t.savedReportId === report.id)
      if (existing) {
        setActiveTabId(existing.id)
        syncUrlForTab(existing)
        return
      }

      const tab = queryTabFromDetail(report)
      setTabs((prev) => [...prev, tab])
      setActiveTabId(tab.id)
      syncUrlForTab(tab)
    },
    [tabs, syncUrlForTab],
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
        const defaultId = list[0]?.id ?? ''
        if (defaultId) {
          setTabs((prev) =>
            prev.map((t) => (t.dataSourceId ? t : { ...t, dataSourceId: defaultId })),
          )
        }
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
    if (!accessToken || !activeTab.dataSourceId || !activeTab.sql.trim()) return
    if (hasDateVariables && !dateFiltersEnabled) {
      updateActiveTab({
        queryError: 'Select a date filter before running this query.',
        queryResult: null,
      })
      return
    }
    setIsRunning(true)
    updateActiveTab({
      queryError: null,
      queryResult: null,
    })
    setBannerError('')
    try {
      const result = await reportBuilderApi.executeQuery(accessToken, {
        dataSourceId: activeTab.dataSourceId,
        sql: activeTab.sql,
        filters: queryFilters ?? {},
      })
      updateActiveTab({ queryResult: result, queryError: null })
    } catch (err) {
      updateActiveTab({
        queryError: err instanceof Error ? err.message : 'Query failed',
        queryResult: null,
      })
    } finally {
      setIsRunning(false)
    }
  }, [
    accessToken,
    activeTab.dataSourceId,
    activeTab.sql,
    queryFilters,
    hasDateVariables,
    dateFiltersEnabled,
    updateActiveTab,
  ])

  useEffect(() => {
    const reportId = searchParams.get('reportId')
    if (!accessToken || !reportId) return

    const existingTab = tabs.find((t) => t.savedReportId === reportId)
    if (existingTab) {
      if (activeTabId !== existingTab.id) {
        setActiveTabId(existingTab.id)
      }
      return
    }

    loadReportById(reportId).catch((err) =>
      setBannerError(err instanceof Error ? err.message : 'Failed to load report'),
    )
  }, [accessToken, searchParams, tabs, activeTabId, loadReportById])

  useEffect(() => {
    if (searchParams.get('run') !== '1' || !activeTab.dataSourceId) return
    if (hasDateVariables && !dateFiltersEnabled) return
    void runQuery()
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('run')
        return next
      },
      { replace: true },
    )
  }, [
    searchParams,
    activeTab.dataSourceId,
    hasDateVariables,
    dateFiltersEnabled,
    runQuery,
    setSearchParams,
  ])

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
    const tab = createQueryTab({
      title: 'Query 1',
      dataSourceId: dataSources[0]?.id ?? '',
    })
    setTabs([tab])
    setActiveTabId(tab.id)
    setBannerSuccess('')
    setBannerError('')
    syncUrlForTab(tab)
  }

  function handleSelectReport(report: SavedReportSummary) {
    const existingTab = tabs.find((t) => t.savedReportId === report.id)
    if (existingTab) {
      handleSelectTab(existingTab.id)
      return
    }

    if (isDirty && !window.confirm('Discard unsaved changes and open this report?')) {
      return
    }

    loadReportById(report.id).catch((err) =>
      setBannerError(err instanceof Error ? err.message : 'Failed to load report'),
    )
  }

  function handleSelectTab(tabId: string) {
    setActiveTabId(tabId)
    const tab = tabs.find((t) => t.id === tabId)
    if (tab) syncUrlForTab(tab)
  }

  function handleAddTab() {
    const tab = createQueryTab({
      title: duplicateTabTitle(
        tabs.map((t) => t.title),
        'New query',
      ),
      dataSourceId: dataSources[0]?.id ?? activeTab.dataSourceId,
    })
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    syncUrlForTab(tab)
  }

  function handleCloseTab(id: string) {
    if (tabs.length <= 1) return
    const idx = tabs.findIndex((t) => t.id === id)
    const next = tabs.filter((t) => t.id !== id)
    setTabs(next)
    if (activeTabId === id) {
      const fallback = next[Math.max(0, idx - 1)] ?? next[0]
      setActiveTabId(fallback.id)
      syncUrlForTab(fallback)
    }
  }

  const insertSqlFragment = useCallback(
    (fragment: string, mode: SqlInsertMode = 'append') => {
      const normalizedFragment = fragment.trim()
      if (mode === 'line1') {
        const rest = activeTab.sql.trim()
        updateActiveTab({
          sql: rest ? `${normalizedFragment}\n${activeTab.sql.trimEnd()}` : normalizedFragment,
        })
        requestAnimationFrame(() => {
          requestAnimationFrame(() => sqlEditorRef.current?.focusAtStart())
        })
        return
      }

      const trimmed = activeTab.sql.trim()
      updateActiveTab({
        sql: trimmed ? `${trimmed}\n${fragment}` : fragment,
      })
    },
    [activeTab.sql, updateActiveTab],
  )

  const activeDataSource = dataSources.find((d) => d.id === activeTab.dataSourceId)

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
        dataSourceId: activeTab.dataSourceId,
      }

      const saved = activeReportId
        ? await reportsApi.update(accessToken, activeReportId, payload)
        : await reportsApi.create(accessToken, payload)

      setBannerSuccess(
        activeReportId
          ? `Report "${saved.name}" updated`
          : `Report "${saved.name}" saved`,
      )

      const snapshot: QueryEditorSnapshot = {
        name: saved.name,
        description: saved.description ?? '',
        category: saved.category,
        sql: saved.sql,
        visualization: saved.visualization,
        dataSourceId: saved.dataSourceId,
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                savedReportId: saved.id,
                title: saved.name,
                name: saved.name,
                description: saved.description ?? '',
                category: saved.category,
                dataSourceId: saved.dataSourceId,
                isPublished: saved.isPublished,
                savedSnapshot: snapshot,
                sql: saved.sql,
                visualization: saved.visualization,
              }
            : t,
        ),
      )
      syncUrlForTab({ ...activeTab, savedReportId: saved.id })
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
      const nextTabs = tabs.filter((t) => t.savedReportId !== deletedId)
      const finalTabs =
        nextTabs.length === 0
          ? [
              createQueryTab({
                title: 'Query 1',
                dataSourceId: dataSources[0]?.id ?? '',
              }),
            ]
          : nextTabs

      if (activeTab.savedReportId === deletedId) {
        if (nextTabs.length === 0) {
          setActiveTabId(finalTabs[0].id)
          syncUrlForTab(finalTabs[0])
        } else {
          const idx = tabs.findIndex((t) => t.id === activeTabId)
          const fallback = nextTabs[Math.max(0, idx - 1)] ?? nextTabs[0]
          setActiveTabId(fallback.id)
          syncUrlForTab(fallback)
        }
      }

      setTabs(finalTabs)
      await loadSavedReports()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to delete report')
    } finally {
      setDeleteLoading(false)
      setPendingDelete(null)
    }
  }

  async function confirmPublish() {
    if (!accessToken || !activeReportId) return
    setPublishLoading(true)
    setBannerError('')
    try {
      const saved = await reportsApi.publish(accessToken, activeReportId)
      updateActiveTab({ isPublished: saved.isPublished })
      setBannerSuccess(
        `"${saved.name}" is published. In Roles, grant Reports view plus this report's view permission.`,
      )
      await loadSavedReports()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to publish report')
    } finally {
      setPublishLoading(false)
      setPendingPublish(false)
    }
  }

  async function confirmUnpublish() {
    if (!accessToken || !activeReportId) return
    setPublishLoading(true)
    setBannerError('')
    try {
      const saved = await reportsApi.unpublish(accessToken, activeReportId)
      updateActiveTab({ isPublished: saved.isPublished })
      setBannerSuccess(`"${saved.name}" is unpublished and hidden from the report catalog.`)
      await loadSavedReports()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to unpublish report')
    } finally {
      setPublishLoading(false)
      setPendingUnpublish(false)
    }
  }

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
                  if (!activeTab.dataSourceId) {
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col lg:flex-row">
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

          <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-secondary px-4 py-2.5">
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-text-primary">
                  {activeTab.name}
                </h1>
                {isDirty ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Unsaved
                  </span>
                ) : activeReportId ? (
                  activeTab.isPublished ? (
                    <span className="rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-blue">
                      Published
                    </span>
                  ) : (
                    <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                      Draft
                    </span>
                  )
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
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && activeReportId && !isDirty && (
                activeTab.isPublished ? (
                  <button
                    type="button"
                    onClick={() => setPendingUnpublish(true)}
                    disabled={publishLoading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-secondary disabled:opacity-50"
                  >
                    <i className="ti ti-eye-off text-sm"></i>
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingPublish(true)}
                    disabled={publishLoading}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
                  >
                    <i className="ti ti-world-upload text-sm"></i>
                    Publish
                  </button>
                )
              )}
              <select
                value={activeTab.dataSourceId}
                onChange={(e) => updateActiveTab({ dataSourceId: e.target.value })}
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
                disabled={!activeTab.dataSourceId || !activeTab.sql.trim()}
                onClick={runQuery}
              >
                {!isRunning && <i className="ti ti-player-play"></i>}
                Run query
              </LoadingButton>
              <span className="hidden text-[10px] text-text-secondary lg:inline">⌘↵</span>
            </div>
            </div>

            <QueryTabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={handleSelectTab}
              onAdd={handleAddTab}
              onClose={handleCloseTab}
            />

            <ReportVariablesPanel
              variables={variables}
              values={variableValues}
              hasDateVariables={hasDateVariables}
              dateFilters={dateFilters}
              onVariableChange={setVariable}
              onDateFiltersChange={setDateFilters}
            />

            <div className="shrink-0 bg-[#1e1e1e] px-4 pb-2 pt-2 text-[#d4d4d4]">
              <p className="mb-1.5 text-[11px] text-[#858585]">
                SQL editor · scroll inside the editor for longer queries
              </p>
              <SqlEditor
                ref={sqlEditorRef}
                value={activeTab.sql}
                onChange={(sql) => updateActiveTab({ sql })}
                visibleLines={25}
              />
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border border-t border-border lg:grid-cols-[minmax(260px,32%)_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
          <div className="flex min-h-0 min-w-0 flex-col bg-bg-primary">
            {accessToken && (
              <DatabaseTableExplorer
                accessToken={accessToken}
                dataSourceId={activeTab.dataSourceId}
                onInsertFragment={insertSqlFragment}
              />
            )}
          </div>
          <div className="flex min-h-0 min-w-0 flex-col bg-bg-tertiary">
            <ReportBuilderQueryPreview
              visualization={activeTab.visualization}
              onVisualizationChange={(v) => updateActiveTab({ visualization: v })}
              queryResult={activeTab.queryResult}
              queryError={activeTab.queryError}
              isRunning={isRunning}
              chartData={chartData}
              pieData={pieData}
            />
          </div>
        </div>
      </div>

      <ReportSaveModal
        open={saveModalOpen}
        title={activeReportId ? 'Save report changes' : 'Save new report'}
        initialName={activeTab.name === 'Untitled report' ? '' : activeTab.name}
        initialDescription={activeTab.description}
        initialCategory={activeTab.category}
        loading={isSaving}
        onConfirm={handleSaveConfirm}
        onCancel={() => setSaveModalOpen(false)}
      />

      <ConfirmModal
        open={pendingPublish}
        title="Publish report?"
        message={`Publish "${activeTab.name}"? Per-report view permissions will appear in Roles under Reports. Users need Reports view and this report's view to open it.`}
        confirmLabel="Publish"
        loading={publishLoading}
        onConfirm={confirmPublish}
        onCancel={() => setPendingPublish(false)}
      />

      <ConfirmModal
        open={pendingUnpublish}
        title="Unpublish report?"
        message={`Unpublish "${activeTab.name}"? It will be removed from the report catalog and role permissions for this report.`}
        confirmLabel="Unpublish"
        variant="danger"
        loading={publishLoading}
        onConfirm={confirmUnpublish}
        onCancel={() => setPendingUnpublish(false)}
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
