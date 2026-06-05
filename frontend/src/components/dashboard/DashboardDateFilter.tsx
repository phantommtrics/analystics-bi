import type { DashboardFilters } from '../../lib/dashboardFilters'
import { ReportFiltersDropdown } from '../shared/ReportFiltersDropdown'

interface DashboardDateFilterProps {
  filters: DashboardFilters
  onChange: (filters: DashboardFilters) => void
  className?: string
  compact?: boolean
  variables?: string[]
  values?: Record<string, string>
  hasDateVariables?: boolean
  onVariableChange?: (name: string, value: string) => void
}

/** @deprecated Use ReportFiltersDropdown directly. Kept for date-only callers. */
export function DashboardDateFilter({
  filters,
  onChange,
  className = '',
  compact = false,
  variables = [],
  values = {},
  hasDateVariables = true,
  onVariableChange,
}: DashboardDateFilterProps) {
  return (
    <ReportFiltersDropdown
      variables={variables}
      values={values}
      hasDateVariables={hasDateVariables}
      dateFilters={filters}
      onDateFiltersChange={onChange}
      onVariableChange={onVariableChange ?? (() => {})}
      className={className}
      compact={compact}
      dateHint="Applied to all report widgets. Use :dateFrom and :dateTo in report SQL."
    />
  )
}
