import {
  createStatementCustomColumnId,
  type StatementCustomColumn,
} from '../../lib/statementConfig'
import { ColumnMappingSelect } from './ColumnMappingSelect'

interface CustomColumnsSectionProps {
  columns: string[]
  sampleRow?: Record<string, unknown> | null
  customColumns: StatementCustomColumn[]
  onChange: (customColumns: StatementCustomColumn[]) => void
}

export function CustomColumnsSection({
  columns,
  sampleRow,
  customColumns,
  onChange,
}: CustomColumnsSectionProps) {
  function updateColumn(id: string, patch: Partial<StatementCustomColumn>) {
    onChange(customColumns.map((col) => (col.id === id ? { ...col, ...patch } : col)))
  }

  function removeColumn(id: string) {
    onChange(customColumns.filter((col) => col.id !== id))
  }

  function addColumn() {
    onChange([
      ...customColumns,
      {
        id: createStatementCustomColumnId(),
        header: '',
        sourceColumn: '',
      },
    ])
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-bg-secondary/40 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Custom columns</h3>
        <p className="mt-0.5 text-xs text-text-secondary">
          Add extra columns to the statement table. Pick a report column or
          type a custom column name.
        </p>
      </div>

      {customColumns.length === 0 ? (
        <p className="text-xs text-text-secondary">No custom columns yet.</p>
      ) : (
        <div className="space-y-3">
          {customColumns.map((column, index) => (
            <div
              key={column.id}
              className="grid gap-3 rounded-md border border-border bg-bg-primary p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">Column header</span>
                <input
                  type="text"
                  value={column.header}
                  onChange={(e) => updateColumn(column.id, { header: e.target.value })}
                  placeholder={`Column ${index + 1}`}
                  className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
                />
              </label>
              <ColumnMappingSelect
                label="Source column"
                value={column.sourceColumn}
                columns={columns}
                sampleRow={sampleRow}
                required
                onChange={(sourceColumn) => updateColumn(column.id, { sourceColumn })}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeColumn(column.id)}
                  className="rounded-sm px-2 py-2 text-sm text-semantic-red hover:bg-semantic-red/10"
                  title="Remove custom column"
                >
                  <i className="ti ti-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addColumn}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-blue hover:text-brand-blue"
      >
        <i className="ti ti-plus"></i>
        Add custom column
      </button>
    </div>
  )
}
