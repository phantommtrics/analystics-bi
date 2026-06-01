import { useEffect, useMemo, useState } from 'react'
import {
  DATE_PRESET_GROUPS,
  filtersDisabled,
  filtersWithPreset,
  formatFilterLabel,
  type DashboardFilters,
  type DateFilterPresetId,
} from '../../lib/dashboardFilters'
import {
  formatCalendarPeriodLabel,
  getCalendarPeriodRange,
  todayIso,
  type CalendarPeriodView,
} from '../../lib/dateFilterRanges'

interface DateRangeFilterPickerProps {
  filters: DashboardFilters
  onChange: (filters: DashboardFilters) => void
  showNoneOption?: boolean
  hint?: string
  className?: string
}

const CALENDAR_VIEWS: Array<{ id: CalendarPeriodView; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

export function DateRangeFilterPicker({
  filters,
  onChange,
  showNoneOption = true,
  hint,
  className = '',
}: DateRangeFilterPickerProps) {
  const [calendarView, setCalendarView] = useState<CalendarPeriodView>('month')
  const [calendarOffset, setCalendarOffset] = useState(0)

  const calendarAnchor = filters.enabled && filters.dateFrom ? filters.dateFrom : todayIso()

  const browseRange = useMemo(
    () => getCalendarPeriodRange(calendarView, calendarAnchor, calendarOffset),
    [calendarView, calendarAnchor, calendarOffset],
  )

  const browseLabel = useMemo(
    () => formatCalendarPeriodLabel(calendarView, browseRange),
    [calendarView, browseRange],
  )

  useEffect(() => {
    setCalendarOffset(0)
  }, [calendarView, calendarAnchor])

  function applyPreset(id: Exclude<DateFilterPresetId, 'none' | 'custom'>) {
    onChange(filtersWithPreset(id))
  }

  function applyBrowseRange() {
    onChange({
      enabled: true,
      preset: 'custom',
      dateFrom: browseRange.dateFrom,
      dateTo: browseRange.dateTo,
    })
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {showNoneOption && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Filter</p>
          <button
            type="button"
            onClick={() => onChange(filtersDisabled())}
            className={`w-full rounded-sm border px-2 py-1.5 text-left text-xs transition-colors ${
              !filters.enabled
                ? 'border-brand-blue/50 bg-brand-blue/10 text-brand-blue'
                : 'border-border text-text-primary hover:bg-bg-secondary'
            }`}
          >
            <i className="ti ti-filter-off mr-1.5"></i>
            No filter — do not load data
          </button>
        </div>
      )}

      {DATE_PRESET_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">{group.label}</p>
          <div className="flex flex-wrap gap-1">
            {group.presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={!filters.enabled}
                onClick={() => applyPreset(preset.id)}
                className={`rounded-sm border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  filters.enabled && filters.preset === preset.id
                    ? 'border-brand-blue/50 bg-brand-blue/10 text-brand-blue'
                    : 'border-border text-text-primary hover:bg-bg-secondary'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className={!filters.enabled ? 'pointer-events-none opacity-40' : ''}>
        <p className="mb-1.5 text-xs font-medium text-text-secondary">Browse period</p>
        <div className="mb-2 flex gap-1">
          {CALENDAR_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setCalendarView(v.id)}
              className={`flex-1 rounded-sm border px-2 py-1 text-xs ${
                calendarView === v.id
                  ? 'border-brand-blue/50 bg-brand-blue/10 text-brand-blue'
                  : 'border-border text-text-primary hover:bg-bg-secondary'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Previous period"
            onClick={() => setCalendarOffset((o) => o - 1)}
            className="rounded-sm border border-border px-2 py-1 text-xs hover:bg-bg-secondary"
          >
            <i className="ti ti-chevron-left"></i>
          </button>
          <div className="min-w-0 flex-1 truncate px-1 text-center text-xs font-medium text-text-primary">
            {browseLabel}
          </div>
          <button
            type="button"
            title="Next period"
            onClick={() => setCalendarOffset((o) => o + 1)}
            className="rounded-sm border border-border px-2 py-1 text-xs hover:bg-bg-secondary"
          >
            <i className="ti ti-chevron-right"></i>
          </button>
        </div>
        <button
          type="button"
          onClick={applyBrowseRange}
          className="mt-2 w-full rounded-sm border border-brand-blue/30 bg-brand-blue/5 px-2 py-1.5 text-xs text-brand-blue hover:bg-brand-blue/10"
        >
          Apply {browseLabel}
        </button>
      </div>

      <div className={`space-y-2 ${!filters.enabled ? 'pointer-events-none opacity-40' : ''}`}>
        <p className="text-xs font-medium text-text-secondary">Custom range</p>
        <label className="block text-xs text-text-secondary">
          From
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) =>
              onChange({
                enabled: true,
                preset: 'custom',
                dateFrom: e.target.value,
                dateTo: filters.dateTo || e.target.value,
              })
            }
            className="mt-1 w-full rounded-sm border border-border bg-bg-secondary px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-text-secondary">
          To
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) =>
              onChange({
                enabled: true,
                preset: 'custom',
                dateFrom: filters.dateFrom || e.target.value,
                dateTo: e.target.value,
              })
            }
            className="mt-1 w-full rounded-sm border border-border bg-bg-secondary px-2 py-1 text-sm"
          />
        </label>
      </div>

      <p className="text-[10px] text-text-secondary">
        {hint ??
          (filters.enabled
            ? `Active: ${formatFilterLabel(filters)}`
            : 'Data will not load until a date filter is selected.')}
      </p>
    </div>
  )
}
