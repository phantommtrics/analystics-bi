import { formatTimeAgo } from '../../lib/format'
import { DashboardDateFilter } from '../dashboard/DashboardDateFilter'
import type { DashboardFilters } from '../../lib/dashboardFilters'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useSidebar } from './AppShell'

interface TopBarProps {
  title: string
  lastUpdatedMinutes?: number
  showDateFilter?: boolean
  dateFilter?: DashboardFilters
  onDateFilterChange?: (filters: DashboardFilters) => void
  showExport?: boolean
  onMenuClick?: () => void
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: string
  }
}

export function TopBar({
  title,
  lastUpdatedMinutes = 2,
  showDateFilter = true,
  dateFilter,
  onDateFilterChange,
  showExport = true,
  primaryAction,
}: TopBarProps) {
  const { openSidebar } = useSidebar()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary px-4 sm:px-6">
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-xl font-medium text-text-primary">
          {title}
        </h1>
        <span className="text-xs text-text-secondary">
          Last updated {formatTimeAgo(lastUpdatedMinutes)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {showDateFilter && dateFilter && onDateFilterChange && (
          <DashboardDateFilter
            filters={dateFilter}
            onChange={onDateFilterChange}
            className="hidden md:block"
          />
        )}

        {showDateFilter && !dateFilter && (
          <div className="hidden items-center gap-2 rounded-sm border border-border bg-bg-secondary px-3 py-1.5 text-sm text-text-primary md:flex">
            <i className="ti ti-calendar text-text-secondary"></i>
            <span>Today</span>
            <i className="ti ti-chevron-down ml-1 text-xs text-text-secondary"></i>
          </div>
        )}

        {showExport && (
          <button className="hidden items-center gap-2 rounded-sm border border-border bg-bg-secondary px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary md:flex">
            <i className="ti ti-download text-text-secondary"></i>
            <span>Export</span>
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
    </header>
  )
}
