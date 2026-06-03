import { useEffect, useId, useRef, useState } from 'react'
import type { ReportVisualization } from '../../lib/reportConstants'
import { isChartVisualization } from '../../lib/widgetExport'

import type { WidgetExportFormat } from '../../lib/widgetExport'

interface ExportOption {
  format: WidgetExportFormat
  label: string
  icon: string
  enabled: boolean
}

interface WidgetExportMenuProps {
  visualization: ReportVisualization
  disabled?: boolean
  permissions: {
    png: boolean
    csv: boolean
    pdf: boolean
    xlsx: boolean
  }
  onExport: (format: WidgetExportFormat) => void | Promise<void>
}

export function WidgetExportMenu({
  visualization,
  disabled = false,
  permissions,
  onExport,
}: WidgetExportMenuProps) {
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<WidgetExportFormat | null>(null)

  const isChart = isChartVisualization(visualization)

  const options: ExportOption[] = isChart
    ? [{ format: 'png', label: 'PNG image', icon: 'ti-photo', enabled: permissions.png }]
    : [
        { format: 'csv', label: 'CSV', icon: 'ti-file-type-csv', enabled: permissions.csv },
        { format: 'xlsx', label: 'Excel (XLSX)', icon: 'ti-file-spreadsheet', enabled: permissions.xlsx },
        { format: 'pdf', label: 'PDF', icon: 'ti-file-type-pdf', enabled: permissions.pdf },
      ]

  const availableOptions = options.filter((o) => o.enabled)
  if (availableOptions.length === 0) return null

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const handleSelect = async (format: WidgetExportFormat) => {
    setExporting(format)
    try {
      await onExport(format)
      setOpen(false)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        title="Export widget"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled || exporting !== null}
        onClick={() => setOpen((value) => !value)}
        className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
      >
        {exporting ? (
          <i className="ti ti-loader-2 animate-spin text-sm"></i>
        ) : (
          <i className="ti ti-download text-sm"></i>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] overflow-hidden rounded-md border border-border bg-bg-primary py-1 shadow-lg"
        >
          {availableOptions.map((option) => (
            <button
              key={option.format}
              type="button"
              role="menuitem"
              disabled={exporting !== null}
              onClick={() => handleSelect(option.format)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-bg-secondary disabled:opacity-50"
            >
              <i className={`ti ${option.icon} text-sm text-text-secondary`}></i>
              <span>{option.label}</span>
              {exporting === option.format && (
                <i className="ti ti-loader-2 ml-auto animate-spin text-xs"></i>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
