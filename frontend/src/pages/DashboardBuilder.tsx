import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardDateFilter } from '../components/dashboard/DashboardDateFilter'
import { TopBar } from '../components/layout/TopBar'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { DashboardBuilderPanel } from '../components/dashboard/DashboardBuilderPanel'
import { DashboardSaveModal } from '../components/dashboard/DashboardSaveModal'
import { DashboardGrid } from '../components/dashboard/DashboardGrid'
import { DashboardTabBar } from '../components/dashboard/DashboardTabBar'
import { dashboardsApi, type DashboardDetail, type DashboardSummary } from '../api/dashboards'
import { reportsApi, type SavedReportSummary } from '../api/reports'
import { useAuth } from '../auth/AuthContext'
import type { DashboardLayout } from '../lib/dashboardLayout'
import {
  createDashboardTab,
  dashboardTabFromDetail,
  duplicateTabTitle,
  isDashboardTabDirty,
  type DashboardTab,
} from '../lib/dashboardTabs'
import {
  formatReportDate,
  isSidebarReportCategory,
  type SidebarReportCategory,
} from '../lib/reportConstants'
import { useDashboardFilters } from '../hooks/useDashboardFilters'
import { filtersToQueryRecord, formatFilterLabel, serializeQueryFilters } from '../lib/dashboardFilters'
import { buildDashboardWidgetExportPermissions } from '../lib/widgetExport'

const initialTab = createDashboardTab({ title: 'Dashboard 1' })

export function DashboardBuilder() {
  const { accessToken, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { filters, setFilters } = useDashboardFilters()
  const queryFilters = useMemo(() => filtersToQueryRecord(filters), [filters])
  const filterKey = useMemo(() => serializeQueryFilters(queryFilters), [queryFilters])

  const canEdit = hasPermission('dashboard-builder', 'edit')
  const canDelete = hasPermission('dashboard-builder', 'delete')

  const [dashboards, setDashboards] = useState<DashboardSummary[]>([])
  const [reports, setReports] = useState<SavedReportSummary[]>([])
  const [dashboardsLoading, setDashboardsLoading] = useState(true)
  const [reportsLoading, setReportsLoading] = useState(true)

  const [tabs, setTabs] = useState<DashboardTab[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState(initialTab.id)
  const [layoutPreviewExpanded, setLayoutPreviewExpanded] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [bannerSuccess, setBannerSuccess] = useState('')
  const [pendingDelete, setPendingDelete] = useState<DashboardSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [pendingUnpublish, setPendingUnpublish] = useState(false)

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  )

  const updateActiveTab = useCallback(
    (patch: Partial<DashboardTab>) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, ...patch } : t)),
      )
    },
    [activeTabId],
  )

  const reportsById = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports])

  const layoutDirty = isDashboardTabDirty(activeTab)
  const activeDashboardId = activeTab.savedDashboardId

  const getWidgetExportPermissions = useCallback(
    (reportId: string) =>
      buildDashboardWidgetExportPermissions(
        hasPermission,
        activeDashboardId ?? undefined,
        reportId,
      ),
    [hasPermission, activeDashboardId],
  )
  const exportContext = useMemo(
    () => ({
      dashboardName: activeTab.name,
      dashboardDescription: activeTab.description,
      filterLabel: formatFilterLabel(filters),
    }),
    [activeTab.name, activeTab.description, filters],
  )

  const openDashboardIds = useMemo(
    () =>
      [
        ...new Set(
          tabs.map((t) => t.savedDashboardId).filter((id): id is string => id !== null),
        ),
      ],
    [tabs],
  )

  const loadDashboards = useCallback(async () => {
    if (!accessToken) return
    const list = await dashboardsApi.list(accessToken)
    setDashboards(list)
  }, [accessToken])

  const syncUrlForTab = useCallback(
    (tab: DashboardTab) => {
      if (tab.savedDashboardId) {
        setSearchParams({ dashboardId: tab.savedDashboardId }, { replace: true })
      } else {
        setSearchParams({}, { replace: true })
      }
    },
    [setSearchParams],
  )

  const openDashboardInTab = useCallback(
    (dashboard: DashboardDetail) => {
      setLayoutPreviewExpanded(false)

      const existing = tabs.find((t) => t.savedDashboardId === dashboard.id)
      if (existing) {
        setActiveTabId(existing.id)
        syncUrlForTab(existing)
        return
      }

      const tab = dashboardTabFromDetail(dashboard)
      setTabs((prev) => [...prev, tab])
      setActiveTabId(tab.id)
      syncUrlForTab(tab)
    },
    [tabs, syncUrlForTab],
  )

  const loadDashboardById = useCallback(
    async (id: string) => {
      if (!accessToken) return
      const dashboard = await dashboardsApi.get(accessToken, id)
      openDashboardInTab(dashboard)
    },
    [accessToken, openDashboardInTab],
  )

  useEffect(() => {
    if (!accessToken) return
    setDashboardsLoading(true)
    loadDashboards()
      .catch((err) => setBannerError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setDashboardsLoading(false))
  }, [accessToken, loadDashboards])

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
    const dashboardId = searchParams.get('dashboardId')
    if (!accessToken || !dashboardId) return

    const existingTab = tabs.find((t) => t.savedDashboardId === dashboardId)
    if (existingTab) {
      if (activeTabId !== existingTab.id) {
        setActiveTabId(existingTab.id)
      }
      return
    }

    loadDashboardById(dashboardId).catch((err) =>
      setBannerError(err instanceof Error ? err.message : 'Failed to load dashboard'),
    )
  }, [accessToken, searchParams, tabs, activeTabId, loadDashboardById])

  function handleAddTab() {
    const tab = createDashboardTab({
      title: duplicateTabTitle(
        tabs.map((t) => t.title),
        'New dashboard',
      ),
    })
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    setLayoutPreviewExpanded(false)
    setSearchParams({}, { replace: true })
  }

  function handleSelectTab(tabId: string) {
    setActiveTabId(tabId)
    setLayoutPreviewExpanded(false)
    const tab = tabs.find((t) => t.id === tabId)
    if (tab) syncUrlForTab(tab)
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

  function handleSelectDashboard(summary: DashboardSummary) {
    const existingTab = tabs.find((t) => t.savedDashboardId === summary.id)
    if (existingTab) {
      handleSelectTab(existingTab.id)
      return
    }

    loadDashboardById(summary.id).catch((err) =>
      setBannerError(err instanceof Error ? err.message : 'Failed to load dashboard'),
    )
  }

  async function handleSaveConfirm(data: {
    name: string
    description: string
    showInSidebarMenu: boolean
    sidebarCategory: SidebarReportCategory | null
  }) {
    if (!accessToken) return
    setIsSaving(true)
    setBannerError('')
    try {
      const payload = {
        name: data.name,
        description: data.description || null,
        layout: activeTab.layout,
        showInSidebarMenu: data.showInSidebarMenu,
        sidebarCategory: data.sidebarCategory,
      }
      let saved: DashboardDetail

      if (activeTab.savedDashboardId) {
        saved = await dashboardsApi.update(accessToken, activeTab.savedDashboardId, payload)
        setBannerSuccess(`Dashboard "${saved.name}" saved`)
      } else {
        saved = await dashboardsApi.create(accessToken, payload)
        setBannerSuccess(`Dashboard "${saved.name}" created`)
      }

      const sidebarCategory =
        saved.sidebarCategory && isSidebarReportCategory(saved.sidebarCategory)
          ? saved.sidebarCategory
          : null
      const snapshot = {
        name: saved.name,
        description: saved.description ?? '',
        layout: saved.layout,
        showInSidebarMenu: saved.showInSidebarMenu,
        sidebarCategory,
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                savedDashboardId: saved.id,
                title: saved.name,
                name: saved.name,
                description: saved.description ?? '',
                layout: saved.layout,
                showInSidebarMenu: saved.showInSidebarMenu,
                sidebarCategory,
                isPublished: saved.isPublished,
                savedSnapshot: snapshot,
              }
            : t,
        ),
      )
      syncUrlForTab({ ...activeTab, savedDashboardId: saved.id })
      await loadDashboards()
      setShowSaveModal(false)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to save dashboard')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!accessToken || !pendingDelete) return
    setDeleteLoading(true)
    try {
      await dashboardsApi.delete(accessToken, pendingDelete.id)
      setBannerSuccess(`Dashboard "${pendingDelete.name}" deleted`)
      const deletedId = pendingDelete.id
      const nextTabs = tabs.filter((t) => t.savedDashboardId !== deletedId)
      const finalTabs =
        nextTabs.length === 0 ? [createDashboardTab({ title: 'Dashboard 1' })] : nextTabs

      if (activeTab.savedDashboardId === deletedId) {
        if (nextTabs.length === 0) {
          setActiveTabId(finalTabs[0].id)
          setSearchParams({}, { replace: true })
        } else {
          const idx = tabs.findIndex((t) => t.id === activeTabId)
          const fallback = nextTabs[Math.max(0, idx - 1)] ?? nextTabs[0]
          setActiveTabId(fallback.id)
          syncUrlForTab(fallback)
        }
      }

      setTabs(finalTabs)
      await loadDashboards()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleteLoading(false)
      setPendingDelete(null)
    }
  }

  async function confirmPublish() {
    if (!accessToken || !activeTab.savedDashboardId) return
    setPublishLoading(true)
    setBannerError('')
    try {
      const saved = await dashboardsApi.publish(accessToken, activeTab.savedDashboardId)
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, isPublished: saved.isPublished } : t,
        ),
      )
      setBannerSuccess(
        `"${saved.name}" is published. Assign view permission in Roles to make it visible in the menu.`,
      )
      await loadDashboards()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to publish dashboard')
    } finally {
      setPublishLoading(false)
      setPendingPublish(false)
    }
  }

  async function confirmUnpublish() {
    if (!accessToken || !activeTab.savedDashboardId) return
    setPublishLoading(true)
    setBannerError('')
    try {
      const saved = await dashboardsApi.unpublish(accessToken, activeTab.savedDashboardId)
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, isPublished: saved.isPublished } : t,
        ),
      )
      setBannerSuccess(`"${saved.name}" is unpublished and hidden from the dashboard menu.`)
      await loadDashboards()
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to unpublish dashboard')
    } finally {
      setPublishLoading(false)
      setPendingUnpublish(false)
    }
  }

  const setLayout = (layout: DashboardLayout) => updateActiveTab({ layout })

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Dashboard Builder"
        showDateFilter={false}
        showExport={false}
        primaryAction={
          canEdit
            ? {
                label: activeTab.savedDashboardId ? 'Save layout' : 'Save dashboard',
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
        {!layoutPreviewExpanded && (
          <DashboardBuilderPanel
            dashboards={dashboards}
            reports={reports}
            dashboardsLoading={dashboardsLoading}
            reportsLoading={reportsLoading}
            activeDashboardId={activeDashboardId}
            openDashboardIds={openDashboardIds}
            canEdit={canEdit}
            canDelete={canDelete}
            onSelectDashboard={handleSelectDashboard}
            onNewDashboard={handleAddTab}
            onDeleteDashboard={setPendingDelete}
          />
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DashboardTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={handleSelectTab}
            onAdd={handleAddTab}
            onClose={handleCloseTab}
          />

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-secondary px-4 py-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-text-primary">
                  {activeTab.name}
                </h1>
                {layoutDirty ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                    Unsaved
                  </span>
                ) : activeTab.savedDashboardId ? (
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
              </div>
              <p className="text-xs text-text-secondary">
                {activeTab.layout.widgets.length} widget
                {activeTab.layout.widgets.length === 1 ? '' : 's'}
                {activeDashboardId && dashboards.find((d) => d.id === activeDashboardId) && (
                  <>
                    {' '}
                    · Updated{' '}
                    {formatReportDate(dashboards.find((d) => d.id === activeDashboardId)!.updatedAt)}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DashboardDateFilter
                filters={filters}
                onChange={setFilters}
                compact
              />
              {canEdit && activeTab.savedDashboardId && !layoutDirty && (
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
              {activeTab.layout.widgets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLayoutPreviewExpanded(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-secondary"
                >
                  <i className="ti ti-arrows-maximize text-sm"></i>
                  Full preview
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:p-4">
            <DashboardGrid
              key={filterKey}
              accessToken={accessToken ?? ''}
              layout={activeTab.layout}
              reports={reports}
              reportsById={reportsById}
              canEdit={canEdit}
              queryFilters={queryFilters}
              dashboardId={activeDashboardId ?? undefined}
              showWidgetExport
              exportContext={exportContext}
              getWidgetExportPermissions={getWidgetExportPermissions}
              onChange={setLayout}
            />
          </div>
        </div>
      </div>

      {layoutPreviewExpanded && (
        <div className="fixed inset-0 z-40 flex flex-col bg-bg-primary">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-bg-secondary px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                Dashboard preview
              </p>
              <h2 className="truncate text-lg font-semibold text-text-primary">{activeTab.name}</h2>
              <p className="text-xs text-text-secondary">
                {activeTab.layout.widgets.length} widget
                {activeTab.layout.widgets.length === 1 ? '' : 's'} · read-only
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DashboardDateFilter filters={filters} onChange={setFilters} compact />
              <button
                type="button"
                onClick={() => setLayoutPreviewExpanded(false)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-2 text-sm font-medium transition-colors hover:bg-bg-secondary"
              >
                <i className="ti ti-arrows-minimize text-base"></i>
                Collapse
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            <DashboardGrid
              key={filterKey}
              accessToken={accessToken ?? ''}
              layout={activeTab.layout}
              reports={reports}
              reportsById={reportsById}
              canEdit={false}
              onChange={setLayout}
              previewMode
              queryFilters={queryFilters}
              dashboardId={activeDashboardId ?? undefined}
              showWidgetExport
              exportContext={exportContext}
              getWidgetExportPermissions={getWidgetExportPermissions}
            />
          </div>
        </div>
      )}

      <DashboardSaveModal
        open={showSaveModal}
        title={activeTab.savedDashboardId ? 'Save dashboard layout' : 'Save new dashboard'}
        initialName={activeTab.name === 'Untitled dashboard' ? '' : activeTab.name}
        initialDescription={activeTab.description}
        initialShowInSidebarMenu={activeTab.showInSidebarMenu}
        initialSidebarCategory={activeTab.sidebarCategory}
        loading={isSaving}
        onConfirm={handleSaveConfirm}
        onCancel={() => setShowSaveModal(false)}
      />

      <ConfirmModal
        open={pendingPublish}
        title="Publish dashboard?"
        message={`Publish "${activeTab.name}"? Per-dashboard view permissions will appear in Roles${activeTab.showInSidebarMenu ? ' under the matching sidebar section (e.g. Agents)' : ' under Dashboard'}. Users need Dashboard view and this dashboard's view to open it.`}
        confirmLabel="Publish"
        loading={publishLoading}
        onConfirm={confirmPublish}
        onCancel={() => setPendingPublish(false)}
      />

      <ConfirmModal
        open={pendingUnpublish}
        title="Unpublish dashboard?"
        message={`Unpublish "${activeTab.name}"? It will be removed from the dashboard menu and role permissions for this dashboard.`}
        confirmLabel="Unpublish"
        variant="danger"
        loading={publishLoading}
        onConfirm={confirmUnpublish}
        onCancel={() => setPendingUnpublish(false)}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete dashboard?"
        message={`Delete "${pendingDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
