import { useMemo, useState } from 'react'
import { DateRangeFilterPicker } from '../shared/DateRangeFilterPicker'
import type { DashboardFilters } from '../../lib/dashboardFilters'
import {
  formatVariableLabel,
  isDateVariable,
  SQL_VARIABLE_HINT,
} from '../../lib/sqlVariables'

interface ReportVariablesPanelProps {
  variables: string[]
  values: Record<string, string>
  hasDateVariables: boolean
  dateFilters: DashboardFilters
  onVariableChange: (name: string, value: string) => void
  onDateFiltersChange: (filters: DashboardFilters) => void
  compact?: boolean
  /** When true, date range is controlled from the page TopBar instead. */
  hideDateFilter?: boolean
}

export function ReportVariablesPanel({
  variables,
  values,
  hasDateVariables,
  dateFilters,
  onVariableChange,
  onDateFiltersChange,
  compact = false,
  hideDateFilter = false,
}: ReportVariablesPanelProps) {
  const [expanded, setExpanded] = useState(true)

  const customVariables = useMemo(
    () => variables.filter((v) => !isDateVariable(v)),
    [variables],
  )

  if (hideDateFilter && customVariables.length === 0) {
    return null
  }

  if (variables.length === 0) {
    return (
      <div
        className={`shrink-0 border-b border-border bg-bg-secondary ${compact ? 'px-3 py-2' : 'px-4 py-2.5'}`}
      >
        <p className="text-[11px] text-text-secondary">
          No variables in SQL. Add placeholders like{' '}
          <code className="rounded bg-bg-primary px-1">:dateFrom</code> to filter results.
        </p>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-b border-border bg-bg-secondary">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`flex w-full items-center justify-between gap-2 text-left ${compact ? 'px-3 py-2' : 'px-4 py-2.5'}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <i className="ti ti-filter text-sm text-text-secondary"></i>
          <span className="text-xs font-medium text-text-primary">
            Variables ({variables.length})
            {hasDateVariables && !dateFilters.enabled && (
              <span className="ml-2 font-normal text-text-secondary">· No date filter</span>
            )}
          </span>
        </div>
        <i
          className={`ti ti-chevron-down shrink-0 text-xs text-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`}
        ></i>
      </button>

      {expanded && (
        <div className={`space-y-3 border-t border-border ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          {hasDateVariables && !hideDateFilter && (
            <DateRangeFilterPicker
              filters={dateFilters}
              onChange={onDateFiltersChange}
              hint="Choose a range before running the query. Select “No filter” to skip loading data."
            />
          )}

          {customVariables.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                Parameters
              </p>
              <div className="flex flex-wrap gap-2">
                {customVariables.map((name) => (
                  <label
                    key={name}
                    className="min-w-[120px] flex-1 text-[11px] text-text-secondary"
                  >
                    {formatVariableLabel(name)}
                    <input
                      type="text"
                      value={values[name] ?? ''}
                      onChange={(e) => onVariableChange(name, e.target.value)}
                      placeholder={`:${name}`}
                      className="mt-0.5 block w-full rounded-sm border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-text-secondary">{SQL_VARIABLE_HINT}</p>
        </div>
      )}
    </div>
  )
}
