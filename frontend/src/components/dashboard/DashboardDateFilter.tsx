import { useEffect, useRef, useState } from 'react'
import {
  DATE_FILTER_PRESETS,
  formatFilterLabel,
  type DashboardFilters,
} from '../../lib/dashboardFilters'

interface DashboardDateFilterProps {
  filters: DashboardFilters
  onChange: (filters: DashboardFilters) => void
  className?: string
  compact?: boolean
}

export function DashboardDateFilter({
  filters,
  onChange,
  className = '',
  compact = false,
}: DashboardDateFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-sm border border-border bg-bg-secondary text-text-primary transition-colors hover:bg-bg-tertiary ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        }`}
      >
        <i className="ti ti-calendar text-text-secondary"></i>
        <span>{formatFilterLabel(filters)}</span>
        <i
          className={`ti ti-chevron-down text-xs text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        ></i>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-bg-primary p-3 shadow-lg">
          <div className="mb-3 space-y-2">
            <p className="text-xs font-medium text-text-secondary">Presets</p>
            <div className="flex flex-wrap gap-1">
              {DATE_FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onChange(preset.getRange())
                    setOpen(false)
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
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                className="mt-1 w-full rounded-sm border border-border bg-bg-secondary px-2 py-1 text-sm"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              To
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                className="mt-1 w-full rounded-sm border border-border bg-bg-secondary px-2 py-1 text-sm"
              />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-text-secondary">
            Applied to all report widgets. Use placeholders like{' '}
            <code className="rounded bg-bg-secondary px-1">:dateFrom</code> and{' '}
            <code className="rounded bg-bg-secondary px-1">:dateTo</code> in report SQL.
          </p>
        </div>
      )}
    </div>
  )
}
