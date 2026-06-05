import { formatTimeAgo } from '../../lib/format'
import type { DashboardFilters } from '../../lib/dashboardFilters'
import { ReportFiltersDropdown } from '../shared/ReportFiltersDropdown'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useSidebar } from './AppShell'

export interface TopBarReportFilters {
  variables: string[]
  values: Record<string, string>
  hasDateVariables: boolean
  dateFilters: DashboardFilters
  onVariableChange: (name: string, value: string) => void
  onDateFiltersChange: (filters: DashboardFilters) => void
}

interface TopBarProps {
  title: string
  lastUpdatedMinutes?: number
  /** @deprecated Use reportFilters instead */
  showDateFilter?: boolean
  dateFilter?: DashboardFilters
  onDateFilterChange?: (filters: DashboardFilters) => void
  reportFilters?: TopBarReportFilters
  showExport?: boolean
  onExport?: () => void
  exportLoading?: boolean
  onMenuClick?: () => void
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: string
  }
  toolbar?: React.ReactNode
}

export function TopBar({
  title,
  lastUpdatedMinutes = 2,
  showDateFilter = true,
  dateFilter,
  onDateFilterChange,
  reportFilters,
  showExport = true,
  onExport,
  exportLoading = false,
  primaryAction,
  toolbar,
}: TopBarProps) {
  const { openSidebar } = useSidebar()

  const filtersControl = reportFilters ?? (
    showDateFilter && dateFilter && onDateFilterChange
      ? {
          variables: [] as string[],
          values: {} as Record<string, string>,
          hasDateVariables: true,
          dateFilters: dateFilter,
          onVariableChange: () => {},
          onDateFiltersChange: onDateFilterChange,
        }
      : undefined
  )

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg-primary">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-medium text-text-primary">
            {title}
          </h1>
          <span className="text-xs text-text-secondary">
            Last updated {formatTimeAgo(lastUpdatedMinutes)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {filtersControl && (
            <ReportFiltersDropdown
              {...filtersControl}
              className="hidden md:block"
              dateHint="Applied to report data. Use :dateFrom and :dateTo in SQL."
            />
          )}

          {showExport && (
            <button
              type="button"
              onClick={onExport}
              disabled={!onExport || exportLoading}
              className="hidden items-center gap-2 rounded-sm border border-border bg-bg-secondary px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50 md:flex"
            >
              <i className={`ti ${exportLoading ? 'ti-loader animate-spin' : 'ti-download'} text-text-secondary`}></i>
              <span>{exportLoading ? 'Exporting…' : 'Export'}</span>
            </button>
          )}

          <ThemeToggle />

          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="flex items-center gap-2 rounded-sm bg-brand-navy px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-navy/90"
            >
              {primaryAction.icon && (
                <i className={`ti ${primaryAction.icon}`}></i>
              )}
              <span>{primaryAction.label}</span>
            </button>
          )}

          <button
            className="p-2 text-text-secondary md:hidden"
            onClick={openSidebar}
            aria-label="Open navigation"
          >
            <i className="ti ti-menu-2 text-xl"></i>
          </button>
        </div>
      </div>
      {toolbar && (
        <div className="border-t border-border px-4 py-2.5 sm:px-6">{toolbar}</div>
      )}
    </header>
  )
}
