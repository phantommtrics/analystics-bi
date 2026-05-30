import { useCallback, useEffect, useMemo, useState } from 'react'
import { reportsApi, type SavedReportSummary } from '../../api/reports'
import type { KpiWidgetLayout } from '../../lib/dashboardLayout'
import {
  extractKpiPairOptions,
  pairOptionMatchesWidget,
  type KpiDataPairOption,
} from '../../lib/kpiReportData'
import {
  iconClassName,
  KPI_COLOR_PRESETS,
  KPI_ICON_OPTIONS,
  normalizeHexColor,
} from '../../lib/kpiWidgetConstants'

export type KpiWidgetEditPatch = Pick<
  KpiWidgetLayout,
  | 'label'
  | 'value'
  | 'icon'
  | 'backgroundColor'
  | 'textColor'
  | 'savedReportId'
  | 'labelColumn'
  | 'valueColumn'
  | 'rowIndex'
>

interface KpiWidgetEditModalProps {
  open: boolean
  accessToken: string
  reports: SavedReportSummary[]
  widget: KpiWidgetLayout | null
  onConfirm: (patch: KpiWidgetEditPatch) => void
  onCancel: () => void
}

export function KpiWidgetEditModal({
  open,
  accessToken,
  reports,
  widget,
  onConfirm,
  onCancel,
}: KpiWidgetEditModalProps) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [icon, setIcon] = useState('ti-chart-bar')
  const [backgroundColor, setBackgroundColor] = useState('#1e3a5f')
  const [textColor, setTextColor] = useState('#ffffff')

  const [savedReportId, setSavedReportId] = useState<string>('')
  const [labelColumn, setLabelColumn] = useState<string | undefined>()
  const [valueColumn, setValueColumn] = useState<string | undefined>()
  const [rowIndex, setRowIndex] = useState<number | undefined>()

  const [pairs, setPairs] = useState<KpiDataPairOption[]>([])
  const [pairsLoading, setPairsLoading] = useState(false)
  const [pairsError, setPairsError] = useState('')
  const [useReportData, setUseReportData] = useState(false)

  useEffect(() => {
    if (!widget) return
    setLabel(widget.label)
    setValue(widget.value)
    setIcon(widget.icon)
    setBackgroundColor(widget.backgroundColor)
    setTextColor(widget.textColor)
    setSavedReportId(widget.savedReportId ?? '')
    setLabelColumn(widget.labelColumn)
    setValueColumn(widget.valueColumn)
    setRowIndex(widget.rowIndex)
    setUseReportData(Boolean(widget.savedReportId && (widget.valueColumn ?? widget.labelColumn)))
  }, [widget])

  const loadPairs = useCallback(
    async (reportId: string) => {
      if (!accessToken || !reportId) {
        setPairs([])
        return
      }
      setPairsLoading(true)
      setPairsError('')
      try {
        const result = await reportsApi.execute(accessToken, reportId)
        setPairs(extractKpiPairOptions(result))
      } catch (err) {
        setPairs([])
        setPairsError(err instanceof Error ? err.message : 'Failed to load report data')
      } finally {
        setPairsLoading(false)
      }
    },
    [accessToken],
  )

  useEffect(() => {
    if (!open || !useReportData || !savedReportId) {
      setPairs([])
      return
    }
    void loadPairs(savedReportId)
  }, [open, useReportData, savedReportId, loadPairs])

  const selectedPairId = useMemo(() => {
    const column = valueColumn ?? labelColumn
    if (!column) return ''
    const match = pairs.find((p) =>
      pairOptionMatchesWidget(p, {
        savedReportId: savedReportId || undefined,
        labelColumn: column,
        valueColumn: column,
        rowIndex,
      }),
    )
    return match?.id ?? ''
  }, [pairs, labelColumn, valueColumn, rowIndex, savedReportId])

  function selectPair(option: KpiDataPairOption) {
    setLabel(option.labelColumn)
    setValue(option.value)
    setLabelColumn(option.labelColumn)
    setValueColumn(option.valueColumn)
    setRowIndex(option.rowIndex)
  }

  function handleReportChange(reportId: string) {
    setSavedReportId(reportId)
    if (!reportId) {
      setLabelColumn(undefined)
      setValueColumn(undefined)
      setRowIndex(undefined)
      setPairs([])
      return
    }
    setLabelColumn(undefined)
    setValueColumn(undefined)
    setRowIndex(undefined)
  }

  function handleConfirm() {
    if (!widget) return
    const patch: KpiWidgetEditPatch = {
      label: label.trim(),
      value: value.trim(),
      icon,
      backgroundColor: normalizeHexColor(backgroundColor, widget.backgroundColor),
      textColor: normalizeHexColor(textColor, widget.textColor),
    }
    if (useReportData && savedReportId && labelColumn && valueColumn) {
      patch.savedReportId = savedReportId
      patch.labelColumn = valueColumn
      patch.valueColumn = valueColumn
      patch.rowIndex = rowIndex ?? 0
      patch.label = valueColumn
      patch.value = value.trim()
    } else {
      patch.savedReportId = undefined
      patch.labelColumn = undefined
      patch.valueColumn = undefined
      patch.rowIndex = undefined
    }
    onConfirm(patch)
  }

  if (!open || !widget) return null

  const canApply = useReportData
    ? Boolean(savedReportId && (valueColumn ?? labelColumn))
    : label.trim() && value.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onCancel}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-bg-primary shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Edit KPI card</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Pick label and value from a saved report, or enter text manually.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div
            className="rounded-md p-4 shadow-sm"
            style={{ backgroundColor, color: textColor }}
          >
            <i className={`${iconClassName(icon)} mb-2 block text-2xl`}></i>
            <div className="text-xl font-semibold">{value || '—'}</div>
            <div className="text-sm opacity-85">{label || 'Label'}</div>
            {savedReportId && labelColumn && (
              <p className="mt-2 text-[10px] opacity-70">
                Live data from saved report
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data source</label>
            <div className="flex rounded-md border border-border bg-bg-secondary p-0.5">
              <button
                type="button"
                onClick={() => {
                  setUseReportData(false)
                  handleReportChange('')
                }}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                  !useReportData
                    ? 'bg-bg-primary text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Manual text
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseReportData(true)
                  if (!savedReportId && reports[0]) {
                    handleReportChange(reports[0].id)
                  }
                }}
                disabled={reports.length === 0}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  useReportData
                    ? 'bg-bg-primary text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Saved report
              </button>
            </div>
            {reports.length === 0 && (
              <p className="mt-1 text-[10px] text-text-secondary">
                Save a report in Report Builder to use live KPI data.
              </p>
            )}
          </div>

          {useReportData && (
            <div className="space-y-3 rounded-md border border-border bg-bg-secondary/50 p-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Saved report
                </label>
                <select
                  value={savedReportId}
                  onChange={(e) => handleReportChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-blue"
                >
                  <option value="">Select a report...</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {savedReportId && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Column → value from report
                  </label>
                  {pairsLoading && (
                    <p className="text-xs text-text-secondary">Loading report data...</p>
                  )}
                  {pairsError && (
                    <p className="text-xs text-semantic-red">{pairsError}</p>
                  )}
                  {!pairsLoading && !pairsError && pairs.length === 0 && (
                    <p className="text-xs text-text-secondary">
                      No rows returned. Run the report in Report Builder first.
                    </p>
                  )}
                  {!pairsLoading && pairs.length > 0 && (
                    <ul className="max-h-40 space-y-1 overflow-y-auto">
                      {pairs.map((option) => (
                        <li key={option.id}>
                          <button
                            type="button"
                            onClick={() => selectPair(option)}
                            className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                              selectedPairId === option.id
                                ? 'border-brand-blue/40 bg-brand-blue/5'
                                : 'border-border bg-bg-primary hover:border-brand-blue/30'
                            }`}
                          >
                            <span className="min-w-0 truncate font-medium text-text-primary">
                              {option.label}
                            </span>
                            <span className="shrink-0 font-mono text-xs text-text-secondary">
                              {option.value}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[10px] text-text-secondary">
                    Each option uses the column name as the label and the cell value from that
                    column. With multiple rows, pick the row and column you want to display.
                  </p>
                </div>
              )}
            </div>
          )}

          {!useReportData && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Value text</label>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g. 12,450"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Label</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Daily transaction volume"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-blue"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {KPI_ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.label}
                  onClick={() => setIcon(opt.value)}
                  className={`rounded-md border px-2.5 py-2 text-sm transition-colors ${
                    icon === opt.value
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-border hover:bg-bg-secondary'
                  }`}
                >
                  <i className={iconClassName(opt.value)}></i>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Color presets</label>
            <div className="flex flex-wrap gap-2">
              {KPI_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  title={preset.name}
                  onClick={() => {
                    setBackgroundColor(preset.backgroundColor)
                    setTextColor(preset.textColor)
                  }}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-bg-secondary"
                >
                  <span
                    className="h-5 w-5 rounded border border-black/10"
                    style={{ backgroundColor: preset.backgroundColor }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Card color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border"
                />
                <input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 font-mono text-xs outline-none focus:border-brand-blue"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Text color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border"
                />
                <input
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 font-mono text-xs outline-none focus:border-brand-blue"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canApply}
            className="rounded-md bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={handleConfirm}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
