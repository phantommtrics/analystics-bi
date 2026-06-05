import { useMemo } from 'react'
import type { SavedReportSummary } from '../../api/reports'
import { categoryMeta } from '../../lib/reportConstants'
import { buildStatementColumnOptions } from '../../lib/statementColumnOptions'
import { SearchableSelect } from '../ui/SearchableSelect'

interface ColumnMappingSelectProps {
  label: string
  value: string
  columns: string[]
  sampleRow?: Record<string, unknown> | null
  required?: boolean
  onChange: (value: string) => void
}

export function ColumnMappingSelect({
  label,
  value,
  columns,
  sampleRow,
  required,
  onChange,
}: ColumnMappingSelectProps) {
  const options = useMemo(
    () => buildStatementColumnOptions(columns, sampleRow, value ? [value] : []),
    [columns, sampleRow, value],
  )

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-text-secondary">
        {label}
        {required ? ' *' : ''}
      </span>
      <SearchableSelect
        options={options}
        value={value || null}
        onChange={(next) => onChange(next ?? '')}
        placeholder="Select column"
        searchPlaceholder="Search columns..."
        emptyMessage="No columns match. Type to use a custom column name."
        maxVisibleItems={5}
        allowCustom
        allowClear={!required}
        clearLabel="Not mapped"
        customOptionLabel={(query) => `Use column: ${query}`}
      />
    </label>
  )
}

interface ReportSelectProps {
  label: string
  value: string
  reports: SavedReportSummary[]
  required?: boolean
  onChange: (value: string) => void
}

export function ReportSelect({ label, value, reports, required, onChange }: ReportSelectProps) {
  const options = useMemo(
    () =>
      reports.map((report) => ({
        id: report.id,
        label: report.name,
        description: categoryMeta[report.category]?.label ?? report.category,
      })),
    [reports],
  )

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-text-secondary">
        {label}
        {required ? ' *' : ''}
      </span>
      <SearchableSelect
        options={options}
        value={value || null}
        onChange={(next) => onChange(next ?? '')}
        placeholder="Select report"
        searchPlaceholder="Search reports..."
        emptyMessage="No reports found"
        maxVisibleItems={5}
        allowClear={!required}
        clearLabel="No report"
      />
    </label>
  )
}
