import { useEffect, useId, useMemo, useRef, useState } from 'react'

export interface MultiSelectOption {
  id: string
  label: string
  description?: string
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
}

export function MultiSelectDropdown({
  options,
  selectedIds,
  onChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found',
  disabled = false,
}: MultiSelectDropdownProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const selectedOptions = useMemo(
    () => options.filter((o) => selectedSet.has(o.id)),
    [options, selectedSet],
  )

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (open) {
      searchRef.current?.focus()
    }
  }, [open])

  function toggleOption(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  function removeOption(id: string, event: React.MouseEvent) {
    event.stopPropagation()
    onChange(selectedIds.filter((x) => x !== id))
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((prev) => !prev)
        }}
        className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-primary px-3 py-2 text-left text-sm transition focus:border-brand-blue focus:outline-none ${
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-brand-blue/40'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedOptions.length === 0 ? (
            <span className="text-text-secondary">{placeholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.id}
                className="inline-flex max-w-full items-center gap-1 rounded bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue"
              >
                <span className="truncate">{option.label}</span>
                <button
                  type="button"
                  onClick={(e) => removeOption(option.id, e)}
                  className="rounded hover:bg-brand-blue/20"
                  aria-label={`Remove ${option.label}`}
                >
                  <i className="ti ti-x text-sm"></i>
                </button>
              </span>
            ))
          )}
        </div>
        <i
          className={`ti ti-chevron-down shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        ></i>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-bg-primary shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"></i>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-border bg-bg-secondary py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <ul
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            className="max-h-48 overflow-y-auto py-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-secondary">{emptyMessage}</li>
            ) : (
              filteredOptions.map((option) => {
                const selected = selectedSet.has(option.id)
                return (
                  <li key={option.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => toggleOption(option.id)}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-bg-secondary ${
                        selected ? 'bg-brand-blue/5' : ''
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? 'border-brand-blue bg-brand-blue text-white'
                            : 'border-border bg-bg-primary'
                        }`}
                      >
                        {selected && <i className="ti ti-check text-xs"></i>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-text-primary">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="block text-xs text-text-secondary">
                            {option.description}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
