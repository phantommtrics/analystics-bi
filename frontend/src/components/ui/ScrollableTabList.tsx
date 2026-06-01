import { useCallback, useEffect, useRef, useState } from 'react'

export interface ScrollableTabItem<T extends string = string> {
  value: T
  label: string
}

interface ScrollableTabListProps<T extends string> {
  items: ScrollableTabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
}

export function ScrollableTabList<T extends string>({
  items,
  value,
  onChange,
  className = '',
  ariaLabel = 'Filter tabs',
}: ScrollableTabListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  const scrollBy = useCallback(
    (direction: 'left' | 'right') => {
      const el = scrollRef.current
      if (!el) return
      const amount = Math.max(120, el.clientWidth * 0.55)
      el.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth',
      })
    },
    [],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    updateScrollState()

    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    el.addEventListener('scroll', updateScrollState, { passive: true })

    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', updateScrollState)
    }
  }, [items, updateScrollState])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const active = el.querySelector<HTMLElement>(`[data-tab-value="${CSS.escape(value)}"]`)
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [value])

  return (
    <div
      className={`flex min-w-0 items-center rounded-md border border-border bg-bg-secondary p-1 ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy('left')}
          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary"
          aria-label="Show earlier categories"
        >
          <i className="ti ti-chevron-left text-base"></i>
        </button>
      )}

      <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-hidden">
        {canScrollLeft && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-bg-secondary to-transparent"
            aria-hidden="true"
          />
        )}
        {canScrollRight && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-bg-secondary to-transparent"
            aria-hidden="true"
          />
        )}

        <div className="flex flex-nowrap items-center gap-1">
          {items.map((item) => {
            const isActive = item.value === value
            return (
              <button
                key={item.value}
                type="button"
                data-tab-value={item.value}
                onClick={() => onChange(item.value)}
                className={`shrink-0 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-bg-primary text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                aria-pressed={isActive}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy('right')}
          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary"
          aria-label="Show more categories"
        >
          <i className="ti ti-chevron-right text-base"></i>
        </button>
      )}
    </div>
  )
}
