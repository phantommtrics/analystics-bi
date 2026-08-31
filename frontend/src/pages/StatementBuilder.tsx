import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReportFiltersDropdown } from '../components/shared/ReportFiltersDropdown'
import { StatementBuilderPanel } from '../components/statement/StatementBuilderPanel'
import { StatementConfigForm } from '../components/statement/StatementConfigForm'
import { StatementPreview } from '../components/statement/StatementPreview'
import { StatementSaveModal } from '../components/statement/StatementSaveModal'
import { StatementTabBar } from '../components/statement/StatementTabBar'
import { TopBar } from '../components/layout/TopBar'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { LoadingButton } from '../components/ui/LoadingButton'
import { reportsApi, type SavedReportSummary } from '../api/reports'
import {
  statementsApi,
  type StatementSummary,
} from '../api/statements'
import { useAuth } from '../auth/AuthContext'
import { useStatementColumns } from '../hooks/useStatementColumns'
import { useStatementData } from '../hooks/useStatementData'
import { useStatementReportSql } from '../hooks/useStatementReportSql'
import { useReportVariables } from '../hooks/useReportVariables'
import type { ReportCategory } from '../lib/reportConstants'
import {
  emptyConfigForType,
  sanitizeStatementConfigForSave,
  type StatementConfig,
  type StatementType,
} from '../lib/statementConfig'
import { statementTypeMeta } from '../lib/statementConstants'
import {
  createStatementTab,
  duplicateTabTitle,
  isStatementTabDirty,
  statementTabFromDetail,
  type StatementEditorSnapshot,
  type StatementTab,
} from '../lib/statementTabs'

const initialTab = createStatementTab('FINANCIAL_PL', { title: 'Statement 1' })

export function StatementBuilder() {
  const { accessToken, hasPermission, refreshUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const canEdit = hasPermission('statement-builder', 'edit')
  const canDelete = hasPermission('statement-builder', 'delete')

  const [statements, setStatements] = useState<StatementSummary[]>([])
  const [reports, setReports] = useState<SavedReportSummary[]>([])
  const [statementsLoading, setStatementsLoading] = useState(true)
  const [reportsLoading, setReportsLoading] = useState(true)

  const [tabs, setTabs] = useState<StatementTab[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState(initialTab.id)

  const [isSaving, setIsSaving] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [bannerSuccess, setBannerSuccess] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<StatementSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [pendingUnpublish, setPendingUnpublish] = useState(false)

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  )

  const updateActiveTab = useCallback(
    (patch: Partial<StatementTab>) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, ...patch } : t)),
      )
    },
    [activeTabId],
  )

  const dirty = isStatementTabDirty(activeTab)
  const typeMeta = statementTypeMeta(activeTab.type)

  const { sqlSources, loading: sqlLoading } = useStatementReportSql(
    accessToken,
    activeTab.config.dataReportId || undefined,
    activeTab.config.headerReportId,
  )
  const {
    variables,
    variableDefs,
    values: variableValues,
    queryFilters,
    hasDateVariables,
    dateFilters,
    filtersReady,
    setVariable,
    setDateFilters,
  } = useReportVariables(sqlSources)

  const effectiveQueryFilters =
    sqlLoading || !filtersReady ? undefined : queryFilters

  const { data, headerData, loading: dataLoading, error: dataError } = useStatementData(
    accessToken,
    activeTab.config.dataReportId || undefined,
    activeTab.config.headerReportId,
    effectiveQueryFilters,
    activeTab.isPublished ? activeTab.savedStatementId ?? undefined : undefined,
  )

  const { columns } = useStatementColumns(
    accessToken,
    activeTab.config.dataReportId || undefined,
    data,
    {
      queryFilters: effectiveQueryFilters,
      variableDefs,
      values: variableValues,
    },
  )

  const openStatementIds = useMemo(
    () =>
      [
        ...new Set(
          tabs
            .map((t) => t.savedStatementId)
            .filter((id): id is string => id !== null),
        ),
      ],
    [tabs],
  )

  const loadStatements = useCallback(async () => {
    if (!accessToken) return
    const list = await statementsApi.list(accessToken)
    setStatements(list)
  }, [accessToken])

  const syncUrlForTab = useCallback(
    (tab: StatementTab) => {
      if (tab.savedStatementId) {
        setSearchParams({ statementId: tab.savedStatementId }, { replace: true })
      } else {
        setSearchParams({}, { replace: true })
      }
    },
    [setSearchParams],
  )

  const openStatementInTab = useCallback(
    (detail: Parameters<typeof statementTabFromDetail>[0]) => {
      const existing = tabs.find((t) => t.savedStatementId === detail.id)
      if (existing) {
        setActiveTabId(existing.id)
        syncUrlForTab(existing)
        return
      }

      const tab = statementTabFromDetail(detail)
      setTabs((prev) => [...prev, tab])
      setActiveTabId(tab.id)
      syncUrlForTab(tab)
    },
    [tabs, syncUrlForTab],
  )

  const loadStatementById = useCallback(
    async (id: string) => {
      if (!accessToken) return
      const detail = await statementsApi.get(accessToken, id)
      openStatementInTab(detail)
    },
    [accessToken, openStatementInTab],
  )

  useEffect(() => {
    if (!accessToken) return
    setStatementsLoading(true)
    loadStatements()
      .catch((err) => setBannerError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setStatementsLoading(false))
  }, [accessToken, loadStatements])

  useEffect(() => {
    if (!accessToken) return
    setReportsLoading(true)
    reportsApi
      .list(accessToken)
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setReportsLoading(false))
  }, [accessToken])

  useEffect(() => {
    const statementId = searchParams.get('statementId')
    if (!accessToken || !statementId) return

    const existingTab = tabs.find((t) => t.savedStatementId === statementId)
    if (existingTab) {
      if (activeTabId !== existingTab.id) {
        setActiveTabId(existingTab.id)
      }
      return
    }

    loadStatementById(statementId).catch((err) =>
      setBannerError(err instanceof Error ? err.message : 'Failed to load statement'),
    )
  }, [accessToken, searchParams, tabs, activeTabId, loadStatementById])

  function handleNewStatement(type: StatementType) {
    if (dirty && !window.confirm('Discard unsaved changes and start a new statement?')) {
      return
    }
    const tab = createStatementTab(type, {
      title: duplicateTabTitle(
        tabs.map((t) => t.title),
        'New statement',
      ),
    })
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    setBannerError('')
    setBannerSuccess('')
    syncUrlForTab(tab)
  }

  function handleSelectStatement(summary: StatementSummary) {
    const existingTab = tabs.find((t) => t.savedStatementId === summary.id)
    if (existingTab) {
      handleSelectTab(existingTab.id)
      return
    }

    if (dirty && !window.confirm('Discard unsaved changes and open this statement?')) {
      return
    }

    loadStatementById(summary.id).catch((err) =>
      setBannerError(err instanceof Error ? err.message : 'Failed to load statement'),
    )
  }

  function handleSelectTab(tabId: string) {
    setActiveTabId(tabId)
    const tab = tabs.find((t) => t.id === tabId)
    if (tab) syncUrlForTab(tab)
  }

  function handleAddTab() {
    const tab = createStatementTab(activeTab.type, {
      title: duplicateTabTitle(
        tabs.map((t) => t.title),
        'New statement',
      ),
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

  async function handleSaveConfirm(data: {
    name: string
    description: string
    category: ReportCategory
    type: StatementType
  }) {
    if (!accessToken) return
    setIsSaving(true)
    setBannerError('')
    try {
      const nextConfig = sanitizeStatementConfigForSave(
        data.type,
        data.type !== activeTab.type ? emptyConfigForType(data.type) : activeTab.config,
      )
      const payload = {
        name: data.name,
        description: data.description || null,
        type: data.type,
        category: data.category,
        config: nextConfig,
      }

      const saved = activeTab.savedStatementId
        ? await statementsApi.update(accessToken, activeTab.savedStatementId, payload)
        : await statementsApi.create(accessToken, payload)

      setBannerSuccess(
        activeTab.savedStatementId
          ? `Statement "${saved.name}" saved`
          : `Statement "${saved.name}" created`,
      )

      const snapshot: StatementEditorSnapshot = {
        name: saved.name,
        description: saved.description ?? '',
        category: saved.category,
        type: saved.type,
        config: saved.config,
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                savedStatementId: saved.id,
                title: saved.name,
                name: saved.name,
                description: saved.description ?? '',
                category: saved.category,
                type: saved.type,
                config: saved.config,
                isPublished: saved.isPublished,
                savedSnapshot: snapshot,
              }
            : t,
        ),
      )
      syncUrlForTab({ ...activeTab, savedStatementId: saved.id })
      if (!activeTab.savedStatementId) {
        await refreshUser()
      }
      await loadStatements()
      setShowSaveModal(false)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to save statement')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!accessToken || !pendingDelete) return
    setDeleteLoading(true)
    try {
      await statementsApi.delete(accessToken, pendingDelete.id)
      setBannerSuccess(`Statement "${pendingDelete.name}" deleted`)
      const deletedId = pendingDelete.id
      const nextTabs = tabs.filter((t) => t.savedStatementId !== deletedId)
      const finalTabs =
        nextTabs.length === 0 ? [createStatementTab('FINANCIAL_PL', { title: 'Statement 1' })] : nextTabs

      if (activeTab.savedStatementId === deletedId) {
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
      await loadStatements()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleteLoading(false)
      setPendingDelete(null)
    }
  }

  async function confirmPublish() {
    if (!accessToken || !activeTab.savedStatementId) return
    setPublishLoading(true)
    setBannerError('')
    try {
      const saved = await statementsApi.publish(accessToken, activeTab.savedStatementId)
      updateActiveTab({ isPublished: saved.isPublished })
      setBannerSuccess(
        `"${saved.name}" is published. Your role was granted access automatically; adjust in Roles if others need it.`,
      )
      await refreshUser()
      await loadStatements()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to publish statement')
    } finally {
      setPublishLoading(false)
      setPendingPublish(false)
    }
  }

  async function confirmUnpublish() {
    if (!accessToken || !activeTab.savedStatementId) return
    setPublishLoading(true)
    setBannerError('')
    try {
      const saved = await statementsApi.unpublish(accessToken, activeTab.savedStatementId)
      updateActiveTab({ isPublished: saved.isPublished })
      setBannerSuccess(`"${saved.name}" is unpublished and hidden from the statement catalog.`)
      await loadStatements()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to unpublish statement')
    } finally {
      setPublishLoading(false)
      setPendingUnpublish(false)
    }
  }

  const previewLoading = useMemo(
    () => dataLoading || sqlLoading || !filtersReady,
    [dataLoading, sqlLoading, filtersReady],
  )

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Statement Builder"
        showDateFilter={false}
        showExport={false}
        primaryAction={
          canEdit
            ? {
                label: activeTab.savedStatementId ? 'Save statement' : 'Save statement',
                onClick: () => setShowSaveModal(true),
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
        <StatementBuilderPanel
          statements={statements}
          loading={statementsLoading || reportsLoading}
          activeStatementId={activeTab.savedStatementId}
          openStatementIds={openStatementIds}
          canEdit={canEdit}
          canDelete={canDelete}
          onSelectStatement={handleSelectStatement}
          onNewStatement={handleNewStatement}
          onDeleteStatement={setPendingDelete}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-secondary px-4 py-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-text-primary">
                  {activeTab.name}
                </h1>
                {dirty ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                    Unsaved
                  </span>
                ) : activeTab.savedStatementId ? (
                  activeTab.isPublished ? (
                    <span className="rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-medium uppercase text-brand-blue">
                      Published
                    </span>
                  ) : (
                    <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
                      Draft
                    </span>
                  )
                ) : null}
                <span className="rounded-full bg-bg-primary px-2 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
                  {typeMeta.label}
                </span>
              </div>
              <p className="text-xs text-text-secondary">{typeMeta.description}</p>
            </div>

            {canEdit && activeTab.savedStatementId && !dirty && (
              <div className="flex items-center gap-2">
                {activeTab.isPublished ? (
                  <LoadingButton
                    variant="secondary"
                    loading={publishLoading}
                    onClick={() => setPendingUnpublish(true)}
                  >
                    Unpublish
                  </LoadingButton>
                ) : (
                  <LoadingButton
                    loading={publishLoading}
                    onClick={() => setPendingPublish(true)}
                  >
                    Publish
                  </LoadingButton>
                )}
              </div>
            )}
          </div>

          <StatementTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={handleSelectTab}
            onAdd={handleAddTab}
            onClose={handleCloseTab}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="shrink-0 border-b border-border p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-text-primary">Configuration</h2>
                {(variables.length > 0 || hasDateVariables) && (
                  <ReportFiltersDropdown
                    variables={variables}
                    values={variableValues}
                    hasDateVariables={hasDateVariables}
                    dateFilters={dateFilters}
                    onVariableChange={setVariable}
                    onDateFiltersChange={setDateFilters}
                  />
                )}
              </div>
              <StatementConfigForm
                type={activeTab.type}
                config={activeTab.config}
                reports={reports}
                columns={columns}
                sampleRow={data?.rows?.[0] ?? null}
                onChange={(config: StatementConfig) => updateActiveTab({ config })}
              />
            </div>

            <div className="min-h-0 flex-1 bg-bg-secondary/40 p-4">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">Preview</h2>
              <StatementPreview
                type={activeTab.type}
                config={activeTab.config}
                data={data}
                headerData={headerData}
                title={activeTab.config.headerTitle ?? activeTab.name}
                subtitle={activeTab.config.headerSubtitle ?? (activeTab.description || undefined)}
                loading={previewLoading}
                error={dataError}
              />
            </div>
          </div>
        </div>
      </div>

      <StatementSaveModal
        open={showSaveModal}
        title={activeTab.savedStatementId ? 'Save statement' : 'Create statement'}
        initialName={activeTab.name}
        initialDescription={activeTab.description}
        initialCategory={activeTab.category}
        initialType={activeTab.type}
        allowTypeChange={!activeTab.savedStatementId}
        loading={isSaving}
        onConfirm={handleSaveConfirm}
        onCancel={() => setShowSaveModal(false)}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete statement?"
        message={`Remove "${pendingDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmModal
        open={pendingPublish}
        title="Publish statement?"
        message={`Publish "${activeTab.name}"? Your role gets this statement's permissions automatically. Other users still need the grant in Roles.`}
        confirmLabel="Publish"
        loading={publishLoading}
        onConfirm={confirmPublish}
        onCancel={() => setPendingPublish(false)}
      />

      <ConfirmModal
        open={pendingUnpublish}
        title="Unpublish statement?"
        message={`Unpublish "${activeTab.name}"? It will be hidden from the statement catalog.`}
        confirmLabel="Unpublish"
        variant="danger"
        loading={publishLoading}
        onConfirm={confirmUnpublish}
        onCancel={() => setPendingUnpublish(false)}
      />
    </div>
  )
}
