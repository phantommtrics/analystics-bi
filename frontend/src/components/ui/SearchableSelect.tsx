import { useEffect, useId, useMemo, useRef, useState } from 'react'

export interface SelectOption {
  id: string
  label: string
  description?: string
}

interface SearchableSelectProps {
  options: SelectOption[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found',
  disabled = false,
}: SearchableSelectProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = options.find((o) => o.id === value)

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
    if (open) searchRef.current?.focus()
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-primary px-3 py-2 text-left text-sm transition focus:border-brand-blue focus:outline-none ${
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-brand-blue/40'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-secondary'}>
          {selected ? selected.label : placeholder}
        </span>
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
          <ul id={listboxId} role="listbox" className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-secondary">{emptyMessage}</li>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value === option.id
                return (
                  <li key={option.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.id)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={`flex w-full flex-col px-3 py-2 text-left text-sm transition hover:bg-bg-secondary ${
                        isSelected ? 'bg-brand-blue/5 text-brand-blue' : ''
                      }`}
                    >
                      <span className="font-medium">{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-text-secondary">{option.description}</span>
                      )}
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
