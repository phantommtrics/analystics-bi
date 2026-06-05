import { useEffect, useMemo, useRef, useState } from 'react'
import { formatQueryFiltersLabel, type DashboardFilters } from '../../lib/dashboardFilters'
import {
  hasFilterValue,
  isDateVariable,
  isRequiredVariable,
  parseVariableToken,
} from '../../lib/sqlVariables'
import { ReportFilterFields, type ReportFilterFieldsProps } from './ReportFilterFields'

export interface ReportFiltersDropdownProps extends ReportFilterFieldsProps {
  className?: string
  compact?: boolean
}

export function ReportFiltersDropdown({
  variables,
  values,
  hasDateVariables,
  dateFilters,
  onVariableChange,
  onDateFiltersChange,
  hideDateFilter = false,
  dateHint,
  showHint = false,
  className = '',
  compact = false,
}: ReportFiltersDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const hasCustomVariables = useMemo(
    () => variables.some((token) => !isDateVariable(token)),
    [variables],
  )

  const showDateSection = hasDateVariables && !hideDateFilter
  const hasFilters = showDateSection || hasCustomVariables

  const label = formatQueryFiltersLabel(dateFilters, {
    hasDateVariables: showDateSection,
    variables,
    values,
  })

  const filtersIncomplete =
    (showDateSection && !dateFilters.enabled) ||
    variables
      .filter((token) => !isDateVariable(token))
      .map((token) => parseVariableToken(token))
      .filter(isRequiredVariable)
      .some((def) => !hasFilterValue(values[def.token], def))

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

  if (!hasFilters) {
    return null
  }

  const icon =
    showDateSection && !dateFilters.enabled
      ? 'ti-filter-off'
      : hasCustomVariables && !showDateSection
        ? 'ti-filter'
        : 'ti-calendar'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex max-w-[min(100vw-8rem,20rem)] items-center gap-2 rounded-sm border border-border bg-bg-secondary text-text-primary transition-colors hover:bg-bg-tertiary ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        } ${filtersIncomplete ? 'border-dashed text-text-secondary' : ''}`}
      >
        <i className={`ti ${icon} shrink-0 text-text-secondary`}></i>
        <span className="truncate">{label}</span>
        <i
          className={`ti ti-chevron-down shrink-0 text-xs text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        ></i>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 max-h-[min(80vh,520px)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-border bg-bg-primary p-3 shadow-lg">
          <ReportFilterFields
            variables={variables}
            values={values}
            hasDateVariables={hasDateVariables}
            dateFilters={dateFilters}
            onVariableChange={onVariableChange}
            onDateFiltersChange={(next) => {
              onDateFiltersChange(next)
              if (!next.enabled && showDateSection && !hasCustomVariables) {
                setOpen(false)
              }
            }}
            hideDateFilter={hideDateFilter}
            dateHint={dateHint}
            showHint={showHint}
          />
        </div>
      )}
    </div>
  )
}
