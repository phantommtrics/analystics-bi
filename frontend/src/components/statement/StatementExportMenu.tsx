import { useEffect, useId, useRef, useState } from 'react'
import type { WidgetExportFormat } from '../../lib/widgetExport'

interface StatementExportMenuProps {
  disabled?: boolean
  permissions: {
    csv: boolean
    pdf: boolean
    xlsx: boolean
  }
  onExport: (format: 'csv' | 'pdf' | 'xlsx') => void | Promise<void>
}

export function StatementExportMenu({
  disabled = false,
  permissions,
  onExport,
}: StatementExportMenuProps) {
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<WidgetExportFormat | null>(null)

  const options = [
    { format: 'csv' as const, label: 'CSV', icon: 'ti-file-type-csv', enabled: permissions.csv },
    { format: 'xlsx' as const, label: 'Excel (XLSX)', icon: 'ti-file-spreadsheet', enabled: permissions.xlsx },
    { format: 'pdf' as const, label: 'PDF', icon: 'ti-file-type-pdf', enabled: permissions.pdf },
  ].filter((o) => o.enabled)

  if (options.length === 0) return null

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

  async function handleExport(format: 'csv' | 'pdf' | 'xlsx') {
    setExporting(format)
    try {
      await onExport(format)
      setOpen(false)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || exporting !== null}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-secondary disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <i className="ti ti-download text-sm"></i>
        Export
        <i className={`ti ti-chevron-${open ? 'up' : 'down'} text-xs`}></i>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-md border border-border bg-bg-primary py-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.format}
              type="button"
              role="menuitem"
              disabled={exporting !== null}
              onClick={() => void handleExport(option.format)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-bg-secondary disabled:opacity-50"
            >
              <i className={`ti ${option.icon}`}></i>
              {option.label}
              {exporting === option.format && (
                <i className="ti ti-loader ml-auto animate-spin text-xs"></i>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
