import { useMemo, useState } from 'react'
import { Badge } from '../ui/Badge'
import { LoadingButton } from '../ui/LoadingButton'
import type { DashboardSummary } from '../../api/dashboards'
import type { SavedReportSummary } from '../../api/reports'
import { categoryMeta, formatReportDate } from '../../lib/reportConstants'
import { DEFAULT_KPI_WIDGET, iconClassName } from '../../lib/kpiWidgetConstants'

interface DashboardBuilderPanelProps {
  dashboards: DashboardSummary[]
  reports: SavedReportSummary[]
  dashboardsLoading: boolean
  reportsLoading: boolean
  activeDashboardId: string | null
  openDashboardIds: string[]
  canEdit: boolean
  canDelete: boolean
  onSelectDashboard: (dashboard: DashboardSummary) => void
  onNewDashboard: () => void
  onDeleteDashboard: (dashboard: DashboardSummary) => void
}

function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-bg-secondary"
        >
          <i
            className={`ti ti-chevron-${open ? 'down' : 'right'} shrink-0 text-sm text-text-secondary`}
          ></i>
          <span className="truncate text-sm font-semibold text-text-primary">{title}</span>
          <span className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-medium tabular-nums text-text-secondary">
            {count}
          </span>
        </button>
        {action}
      </div>
      {open && <div className="px-2 pb-3">{children}</div>}
    </div>
  )
}

export function DashboardBuilderPanel({
  dashboards,
  reports,
  dashboardsLoading,
  reportsLoading,
  activeDashboardId,
  openDashboardIds,
  canEdit,
  canDelete,
  onSelectDashboard,
  onNewDashboard,
  onDeleteDashboard,
}: DashboardBuilderPanelProps) {
  const [dashboardsOpen, setDashboardsOpen] = useState(true)
  const [reportsOpen, setReportsOpen] = useState(true)
  const [kpiOpen, setKpiOpen] = useState(true)
  const [dashboardSearch, setDashboardSearch] = useState('')
  const [reportSearch, setReportSearch] = useState('')

  const filteredDashboards = useMemo(() => {
    const q = dashboardSearch.trim().toLowerCase()
    if (!q) return dashboards
    return dashboards.filter((d) => d.name.toLowerCase().includes(q))
  }, [dashboards, dashboardSearch])

  const filteredReports = useMemo(() => {
    const q = reportSearch.trim().toLowerCase()
    if (!q) return reports
    return reports.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.dataSourceName.toLowerCase().includes(q),
    )
  }, [reports, reportSearch])

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-bg-primary lg:w-[272px] lg:border-b-0 lg:border-r">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Library</h2>
        <p className="text-xs text-text-secondary">Dashboards, reports &amp; KPI cards</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <CollapsibleSection
          title="Dashboards"
          count={dashboards.length}
          open={dashboardsOpen}
          onToggle={() => setDashboardsOpen((o) => !o)}
          action={
            canEdit ? (
              <LoadingButton
                variant="secondary"
                className="mr-1 shrink-0 px-2 py-1 text-xs"
                onClick={onNewDashboard}
              >
                <i className="ti ti-plus"></i>
              </LoadingButton>
            ) : undefined
          }
        >
          <div className="relative mb-2">
            <i className="ti ti-search absolute left-2 top-1/2 -translate-y-1/2 text-sm text-text-secondary"></i>
            <input
              type="search"
              value={dashboardSearch}
              onChange={(e) => setDashboardSearch(e.target.value)}
              placeholder="Search dashboards..."
              className="w-full rounded-md border border-border bg-bg-secondary py-1.5 pl-7 pr-2 text-xs outline-none focus:border-brand-blue"
            />
          </div>
          {dashboardsLoading ? (
            <p className="px-1 py-2 text-xs text-text-secondary">Loading...</p>
          ) : filteredDashboards.length === 0 ? (
            <p className="px-1 py-2 text-xs text-text-secondary">
              {dashboardSearch ? 'No match.' : 'No dashboards yet.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {filteredDashboards.map((dashboard) => {
                const isOpen = openDashboardIds.includes(dashboard.id)
                return (
                <li key={dashboard.id}>
                  <button
                    type="button"
                    onClick={() => onSelectDashboard(dashboard)}
                    className={`group w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                      dashboard.id === activeDashboardId
                        ? 'border-brand-blue/40 bg-brand-blue/5'
                        : isOpen
                          ? 'border-brand-blue/20 bg-brand-blue/[0.02]'
                          : 'border-transparent hover:border-border hover:bg-bg-secondary'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="line-clamp-2 text-xs font-medium">{dashboard.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {dashboard.isPublished ? (
                          <span className="rounded-full bg-brand-blue/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-brand-blue">
                            Live
                          </span>
                        ) : (
                          <span className="rounded-full bg-bg-secondary px-1.5 py-0.5 text-[9px] font-medium uppercase text-text-secondary">
                            Draft
                          </span>
                        )}
                        {canDelete && (
                        <button
                          type="button"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteDashboard(dashboard)
                          }}
                          className="shrink-0 rounded p-0.5 text-text-secondary opacity-0 hover:text-semantic-red group-hover:opacity-100"
                        >
                          <i className="ti ti-trash text-sm"></i>
                        </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-[10px] text-text-secondary">
                      {dashboard.widgetCount} widget{dashboard.widgetCount === 1 ? '' : 's'} ·{' '}
                      {formatReportDate(dashboard.updatedAt)}
                    </p>
                  </button>
                </li>
                )
              })}
            </ul>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Saved reports"
          count={reports.length}
          open={reportsOpen}
          onToggle={() => setReportsOpen((o) => !o)}
        >
          <p className="mb-2 px-1 text-[10px] text-text-secondary">Drag onto the layout canvas</p>
          <div className="relative mb-2">
            <i className="ti ti-search absolute left-2 top-1/2 -translate-y-1/2 text-sm text-text-secondary"></i>
            <input
              type="search"
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="Search reports..."
              className="w-full rounded-md border border-border bg-bg-secondary py-1.5 pl-7 pr-2 text-xs outline-none focus:border-brand-blue"
            />
          </div>
          {reportsLoading ? (
            <p className="px-1 py-2 text-xs text-text-secondary">Loading...</p>
          ) : filteredReports.length === 0 ? (
            <p className="px-1 py-2 text-xs text-text-secondary">
              {reportSearch ? 'No match.' : 'Save reports in Report Builder first.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filteredReports.map((report) => {
                const meta = categoryMeta[report.category]
                return (
                  <li key={report.id}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/report-id', report.id)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      className="flex cursor-grab items-start gap-2 rounded-md border border-border bg-bg-secondary p-2 transition-colors hover:border-brand-blue active:cursor-grabbing"
                    >
                      <i className="ti ti-grip-vertical mt-0.5 shrink-0 text-text-secondary"></i>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-medium">{report.name}</p>
                        <Badge variant={meta.badgeVariant} className="mt-1">
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="KPI cards"
          count={1}
          open={kpiOpen}
          onToggle={() => setKpiOpen((o) => !o)}
        >
          <p className="mb-2 px-1 text-[10px] text-text-secondary">
            Drag onto the layout canvas, then edit label, value, icon &amp; colors
          </p>
          <ul className="space-y-1.5">
            <li>
              <div
                draggable={canEdit}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/widget-type', 'kpi')
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className={`flex items-start gap-2 rounded-md border border-border bg-bg-secondary p-2 transition-colors ${
                  canEdit
                    ? 'cursor-grab hover:border-brand-blue active:cursor-grabbing'
                    : 'opacity-60'
                }`}
              >
                <i className="ti ti-grip-vertical mt-0.5 shrink-0 text-text-secondary"></i>
                <div
                  className="min-w-0 flex-1 rounded-md p-2.5"
                  style={{
                    backgroundColor: DEFAULT_KPI_WIDGET.backgroundColor,
                    color: DEFAULT_KPI_WIDGET.textColor,
                  }}
                >
                  <i className={`${iconClassName(DEFAULT_KPI_WIDGET.icon)} text-[22px] opacity-90`}></i>
                  <div className="mt-2">
                    <p className="mb-0.5 text-kpi font-medium leading-none">
                      {DEFAULT_KPI_WIDGET.value}
                    </p>
                    <p className="text-sm opacity-85">{DEFAULT_KPI_WIDGET.label}</p>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </CollapsibleSection>
      </div>
    </aside>
  )
}
