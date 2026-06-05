import { useMemo } from 'react'
import { DateRangeFilterPicker } from './DateRangeFilterPicker'
import type { DashboardFilters } from '../../lib/dashboardFilters'
import {
  formatVariableLabel,
  isDateVariable,
  parseVariableToken,
  SQL_VARIABLE_HINT,
  variableInputHint,
  type SqlVariableDef,
} from '../../lib/sqlVariables'

export interface ReportFilterFieldsProps {
  variables: string[]
  values: Record<string, string>
  hasDateVariables: boolean
  dateFilters: DashboardFilters
  onVariableChange: (name: string, value: string) => void
  onDateFiltersChange: (filters: DashboardFilters) => void
  /** Hide date section when controlled elsewhere (unused in unified dropdown). */
  hideDateFilter?: boolean
  dateHint?: string
  showHint?: boolean
}

function VariableBadges({ def }: { def: SqlVariableDef }) {
  return (
    <span className="ml-1 inline-flex gap-1">
      {def.array && (
        <span className="rounded bg-brand-blue/10 px-1 py-0.5 text-[9px] font-medium uppercase text-brand-blue">
          list
        </span>
      )}
      {def.optional && (
        <span className="rounded bg-bg-primary px-1 py-0.5 text-[9px] font-medium uppercase text-text-secondary">
          optional
        </span>
      )}
    </span>
  )
}

export function ReportFilterFields({
  variables,
  values,
  hasDateVariables,
  dateFilters,
  onVariableChange,
  onDateFiltersChange,
  hideDateFilter = false,
  dateHint = 'Applied to report data. Use :dateFrom and :dateTo in SQL.',
  showHint = true,
}: ReportFilterFieldsProps) {
  const customDefs = useMemo(
    () =>
      variables
        .filter((token) => !isDateVariable(token))
        .map((token) => parseVariableToken(token)),
    [variables],
  )

  if (variables.length === 0) {
    return (
      <p className="text-[11px] text-text-secondary">
        No variables in SQL. Add placeholders like{' '}
        <code className="rounded bg-bg-secondary px-1">:dateFrom</code>,{' '}
        <code className="rounded bg-bg-secondary px-1">:status?</code>, or{' '}
        <code className="rounded bg-bg-secondary px-1">:region[]</code>.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {hasDateVariables && !hideDateFilter && (
        <DateRangeFilterPicker
          filters={dateFilters}
          onChange={onDateFiltersChange}
          hint={dateHint}
        />
      )}

      {customDefs.length > 0 && (
        <div className="space-y-2">
          {hasDateVariables && !hideDateFilter && (
            <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
              Parameters
            </p>
          )}
          <div className="space-y-2">
            {customDefs.map((def) => (
              <label
                key={def.token}
                className="block text-[11px] text-text-secondary"
              >
                <span className="inline-flex flex-wrap items-center gap-0.5">
                  {formatVariableLabel(def.token)}
                  <VariableBadges def={def} />
                </span>
                <input
                  type="text"
                  value={values[def.token] ?? ''}
                  onChange={(e) => onVariableChange(def.token, e.target.value)}
                  placeholder={variableInputHint(def)}
                  className="mt-0.5 block w-full rounded-sm border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {showHint && (
        <p className="text-[10px] text-text-secondary">{SQL_VARIABLE_HINT}</p>
      )}
    </div>
  )
}
