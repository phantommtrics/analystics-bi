import { useMemo, useState } from 'react'
import type { DashboardFilters } from '../../lib/dashboardFilters'
import { isDateVariable } from '../../lib/sqlVariables'
import { ReportFilterFields } from '../shared/ReportFilterFields'

interface ReportVariablesPanelProps {
  variables: string[]
  values: Record<string, string>
  hasDateVariables: boolean
  dateFilters: DashboardFilters
  onVariableChange: (name: string, value: string) => void
  onDateFiltersChange: (filters: DashboardFilters) => void
  compact?: boolean
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

  const hasCustomVariables = useMemo(
    () => variables.some((token) => !isDateVariable(token)),
    [variables],
  )

  if (hideDateFilter && !hasCustomVariables) {
    return null
  }

  if (variables.length === 0) {
    return (
      <div
        className={`shrink-0 border-b border-border bg-bg-secondary ${compact ? 'px-3 py-2' : 'px-4 py-2.5'}`}
      >
        <p className="text-[11px] text-text-secondary">
          No variables in SQL. Add placeholders like{' '}
          <code className="rounded bg-bg-primary px-1">:dateFrom</code>,{' '}
          <code className="rounded bg-bg-primary px-1">:status?</code>, or{' '}
          <code className="rounded bg-bg-primary px-1">:region[]</code>.
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
        <div className={`border-t border-border ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <ReportFilterFields
            variables={variables}
            values={values}
            hasDateVariables={hasDateVariables}
            dateFilters={dateFilters}
            onVariableChange={onVariableChange}
            onDateFiltersChange={onDateFiltersChange}
            hideDateFilter={hideDateFilter}
            dateHint="Choose a range before running the query. Select “No filter” to skip loading data."
            showHint
          />
        </div>
      )}
    </div>
  )
}
