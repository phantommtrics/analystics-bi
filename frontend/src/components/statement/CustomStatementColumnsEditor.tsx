import {
  createStatementCustomColumnId,
  type CustomStatementConfig,
} from '../../lib/statementConfig'
import {
  defaultColumnAlign,
  defaultColumnDecimals,
  STATEMENT_COLUMN_ALIGN_OPTIONS,
  STATEMENT_COLUMN_DATA_TYPES,
  STATEMENT_CURRENCY_PRESETS,
  type CustomStatementColumnDef,
  type CustomStatementColumnDataType,
} from '../../lib/statementColumnFormat'
import { ColumnMappingSelect, ReportSelect } from './ColumnMappingSelect'
import type { SavedReportSummary } from '../../api/reports'

interface CustomStatementColumnsEditorProps {
  config: CustomStatementConfig
  reports: SavedReportSummary[]
  columns: string[]
  sampleRow?: Record<string, unknown> | null
  onChange: (config: CustomStatementConfig) => void
}

function HeaderFields({
  config,
  onChange,
}: {
  config: CustomStatementConfig
  onChange: (patch: Partial<CustomStatementConfig>) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1 block text-text-secondary">Header title</span>
        <input
          type="text"
          value={config.headerTitle ?? ''}
          onChange={(e) => onChange({ headerTitle: e.target.value })}
          className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
          placeholder="Statement title shown to users"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-text-secondary">Header subtitle</span>
        <input
          type="text"
          value={config.headerSubtitle ?? ''}
          onChange={(e) => onChange({ headerSubtitle: e.target.value })}
          className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
          placeholder="Period or entity label"
        />
      </label>
    </div>
  )
}

export function CustomStatementColumnsEditor({
  config,
  reports,
  columns,
  sampleRow,
  onChange,
}: CustomStatementColumnsEditorProps) {
  const update = (patch: Partial<CustomStatementConfig>) => onChange({ ...config, ...patch })

  function updateColumn(id: string, patch: Partial<CustomStatementColumnDef>) {
    update({
      columns: config.columns.map((column) =>
        column.id === id ? { ...column, ...patch } : column,
      ),
    })
  }

  function removeColumn(id: string) {
    update({ columns: config.columns.filter((column) => column.id !== id) })
  }

  function addColumn() {
    update({
      columns: [
        ...config.columns,
        {
          id: createStatementCustomColumnId(),
          header: '',
          sourceColumn: '',
          dataType: 'text',
        },
      ],
    })
  }

  function handleDataTypeChange(column: CustomStatementColumnDef, dataType: CustomStatementColumnDataType) {
    const patch: Partial<CustomStatementColumnDef> = {
      dataType,
      align: defaultColumnAlign(dataType),
      decimals: defaultColumnDecimals(dataType),
    }
    if (dataType === 'currency' && !column.currency) {
      patch.currency = 'GMD'
    }
    updateColumn(column.id, patch)
  }

  return (
    <div className="space-y-4">
      <HeaderFields config={config} onChange={update} />

      <ReportSelect
        label="Data report"
        value={config.dataReportId}
        reports={reports}
        required
        onChange={(dataReportId) => update({ dataReportId })}
      />

      <ReportSelect
        label="Header metadata report (optional)"
        value={config.headerReportId ?? ''}
        reports={reports}
        onChange={(headerReportId) =>
          update({ headerReportId: headerReportId || undefined })
        }
      />

      <ColumnMappingSelect
        label="Group by column (optional)"
        value={config.groupByColumn ?? ''}
        columns={columns}
        sampleRow={sampleRow}
        onChange={(groupByColumn) =>
          update({ groupByColumn: groupByColumn || undefined })
        }
      />

      <div className="space-y-3 rounded-md border border-border bg-bg-secondary/40 p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Table columns</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            Define each column with a display name, report field, data type, and formatting options.
          </p>
        </div>

        {config.columns.length === 0 ? (
          <p className="text-xs text-text-secondary">No columns yet.</p>
        ) : (
          <div className="space-y-4">
            {config.columns.map((column, index) => {
              const showCurrency = column.dataType === 'currency'
              const showDecimals =
                column.dataType === 'number' ||
                column.dataType === 'currency' ||
                column.dataType === 'percent'
              const showNumericOptions =
                column.dataType === 'number' || column.dataType === 'currency'

              return (
                <div
                  key={column.id}
                  className="space-y-3 rounded-md border border-border bg-bg-primary p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Column {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeColumn(column.id)}
                      className="rounded-sm px-2 py-1 text-xs text-semantic-red hover:bg-semantic-red/10"
                      title="Remove column"
                    >
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block text-text-secondary">Display name *</span>
                      <input
                        type="text"
                        value={column.header}
                        onChange={(e) => updateColumn(column.id, { header: e.target.value })}
                        placeholder="Column header"
                        className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                      />
                    </label>

                    <ColumnMappingSelect
                      label="Report column"
                      value={column.sourceColumn}
                      columns={columns}
                      sampleRow={sampleRow}
                      required
                      onChange={(sourceColumn) => updateColumn(column.id, { sourceColumn })}
                    />

                    <label className="block text-sm">
                      <span className="mb-1 block text-text-secondary">Data type</span>
                      <select
                        value={column.dataType}
                        onChange={(e) =>
                          handleDataTypeChange(
                            column,
                            e.target.value as CustomStatementColumnDataType,
                          )
                        }
                        className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                      >
                        {STATEMENT_COLUMN_DATA_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block text-text-secondary">Alignment</span>
                      <select
                        value={column.align ?? defaultColumnAlign(column.dataType)}
                        onChange={(e) =>
                          updateColumn(column.id, {
                            align: e.target.value as CustomStatementColumnDef['align'],
                          })
                        }
                        className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                      >
                        {STATEMENT_COLUMN_ALIGN_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {showCurrency && (
                      <label className="block text-sm">
                        <span className="mb-1 block text-text-secondary">Currency</span>
                        <input
                          type="text"
                          list={`currency-presets-${column.id}`}
                          value={column.currency ?? 'GMD'}
                          onChange={(e) => updateColumn(column.id, { currency: e.target.value })}
                          placeholder="GMD"
                          className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                        />
                        <datalist id={`currency-presets-${column.id}`}>
                          {STATEMENT_CURRENCY_PRESETS.map((code) => (
                            <option key={code} value={code} />
                          ))}
                        </datalist>
                      </label>
                    )}

                    {showDecimals && (
                      <label className="block text-sm">
                        <span className="mb-1 block text-text-secondary">Decimal places</span>
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={column.decimals ?? defaultColumnDecimals(column.dataType)}
                          onChange={(e) =>
                            updateColumn(column.id, {
                              decimals: Math.min(4, Math.max(0, Number(e.target.value) || 0)),
                            })
                          }
                          className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    {showNumericOptions && (
                      <label className="flex items-center gap-2 text-text-primary">
                        <input
                          type="checkbox"
                          checked={column.highlightNegative ?? false}
                          onChange={(e) =>
                            updateColumn(column.id, { highlightNegative: e.target.checked })
                          }
                          className="rounded border-border"
                        />
                        Highlight negative values
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-text-primary">
                      <input
                        type="checkbox"
                        checked={column.monospace ?? column.dataType !== 'text'}
                        onChange={(e) => updateColumn(column.id, { monospace: e.target.checked })}
                        className="rounded border-border"
                      />
                      Monospace font
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={addColumn}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-blue hover:text-brand-blue"
        >
          <i className="ti ti-plus"></i>
          Add column
        </button>
      </div>
    </div>
  )
}
