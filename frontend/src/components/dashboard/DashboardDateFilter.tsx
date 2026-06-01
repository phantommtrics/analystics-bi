import { useEffect, useRef, useState } from 'react'
import { DateRangeFilterPicker } from '../shared/DateRangeFilterPicker'
import { formatFilterLabel, type DashboardFilters } from '../../lib/dashboardFilters'

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
        } ${!filters.enabled ? 'border-dashed text-text-secondary' : ''}`}
      >
        <i
          className={`ti ${filters.enabled ? 'ti-calendar' : 'ti-filter-off'} text-text-secondary`}
        ></i>
        <span>{formatFilterLabel(filters)}</span>
        <i
          className={`ti ti-chevron-down text-xs text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        ></i>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 max-h-[min(80vh,520px)] w-80 overflow-y-auto rounded-md border border-border bg-bg-primary p-3 shadow-lg">
          <DateRangeFilterPicker
            filters={filters}
            onChange={(next) => {
              onChange(next)
              if (!next.enabled) setOpen(false)
            }}
            hint="Applied to all report widgets. Use :dateFrom and :dateTo in report SQL."
          />
        </div>
      )}
    </div>
  )
}
