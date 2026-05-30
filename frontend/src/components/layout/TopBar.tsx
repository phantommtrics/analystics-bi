import { useEffect, useRef, useState } from 'react'
import { formatTimeAgo } from '../../lib/format'
import {
  DATE_FILTER_PRESETS,
  formatFilterLabel,
  type DashboardFilters,
} from '../../lib/dashboardFilters'
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
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filterOpen) return
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filterOpen])

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
          <div ref={filterRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className="flex items-center gap-2 rounded-sm border border-border bg-bg-secondary px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary"
            >
              <i className="ti ti-calendar text-text-secondary"></i>
              <span>{formatFilterLabel(dateFilter)}</span>
              <i className={`ti ti-chevron-down ml-1 text-xs text-text-secondary transition-transform ${filterOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-bg-primary p-3 shadow-lg">
                <div className="mb-3 space-y-2">
                  <p className="text-xs font-medium text-text-secondary">Presets</p>
                  <div className="flex flex-wrap gap-1">
                    {DATE_FILTER_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          onDateFilterChange(preset.getRange())
                          setFilterOpen(false)
                        }}
                        className="rounded-sm border border-border px-2 py-1 text-xs text-text-primary hover:bg-bg-secondary"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-text-secondary">
                    From
                    <input
                      type="date"
                      value={dateFilter.dateFrom}
                      onChange={(e) =>
                        onDateFilterChange({ ...dateFilter, dateFrom: e.target.value })
                      }
                      className="mt-1 w-full rounded-sm border border-border bg-bg-secondary px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-text-secondary">
                    To
                    <input
                      type="date"
                      value={dateFilter.dateTo}
                      onChange={(e) =>
                        onDateFilterChange({ ...dateFilter, dateTo: e.target.value })
                      }
                      className="mt-1 w-full rounded-sm border border-border bg-bg-secondary px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
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
