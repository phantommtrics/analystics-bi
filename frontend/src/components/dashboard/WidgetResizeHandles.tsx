import type { WidgetResizeHandle } from '../../lib/dashboardLayout'

type HandleConfig = {
  handle: WidgetResizeHandle
  className: string
  cursor: string
  icon: string
}

const HANDLES: HandleConfig[] = [
  {
    handle: 'n',
    className: 'left-1/2 top-0 h-4 w-12 -translate-x-1/2 -translate-y-1/2',
    cursor: 'cursor-ns-resize',
    icon: 'ti-chevron-up',
  },
  {
    handle: 's',
    className: 'bottom-0 left-1/2 h-4 w-12 -translate-x-1/2 translate-y-1/2',
    cursor: 'cursor-ns-resize',
    icon: 'ti-chevron-down',
  },
  {
    handle: 'w',
    className: 'left-0 top-1/2 h-12 w-4 -translate-x-1/2 -translate-y-1/2',
    cursor: 'cursor-ew-resize',
    icon: 'ti-chevron-left',
  },
  {
    handle: 'e',
    className: 'right-0 top-1/2 h-12 w-4 translate-x-1/2 -translate-y-1/2',
    cursor: 'cursor-ew-resize',
    icon: 'ti-chevron-right',
  },
  {
    handle: 'nw',
    className: 'left-0 top-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2',
    cursor: 'cursor-nwse-resize',
    icon: 'ti-arrow-up-left',
  },
  {
    handle: 'ne',
    className: 'right-0 top-0 h-5 w-5 translate-x-1/2 -translate-y-1/2',
    cursor: 'cursor-nesw-resize',
    icon: 'ti-arrow-up-right',
  },
  {
    handle: 'sw',
    className: 'bottom-0 left-0 h-5 w-5 -translate-x-1/2 translate-y-1/2',
    cursor: 'cursor-nesw-resize',
    icon: 'ti-arrow-down-left',
  },
  {
    handle: 'se',
    className: 'bottom-0 right-0 h-5 w-5 translate-x-1/2 translate-y-1/2',
    cursor: 'cursor-nwse-resize',
    icon: 'ti-arrow-down-right',
  },
]

interface WidgetResizeHandlesProps {
  active: boolean
  onStart: (handle: WidgetResizeHandle, e: React.MouseEvent) => void
}

export function WidgetResizeHandles({ active, onStart }: WidgetResizeHandlesProps) {
  const visible =
    'scale-100 opacity-100 pointer-events-auto'
  const hidden =
    'pointer-events-none scale-90 opacity-0 group-hover/widget:pointer-events-auto group-hover/widget:scale-100 group-hover/widget:opacity-100'

  return (
    <>
      {HANDLES.map(({ handle, className, cursor, icon }) => (
        <button
          key={handle}
          type="button"
          aria-label={`Resize ${handle}`}
          onMouseDown={(e) => onStart(handle, e)}
          className={`absolute z-30 flex items-center justify-center rounded-full border border-brand-blue/30 bg-bg-primary/95 text-brand-blue shadow-sm transition-all hover:scale-110 hover:border-brand-blue hover:bg-brand-blue/10 ${className} ${cursor} ${
            active ? visible : hidden
          }`}
        >
          <i className={`ti ${icon} text-[11px]`}></i>
        </button>
      ))}
      <div
        className={`pointer-events-none absolute inset-0 rounded-md ring-2 ring-brand-blue/30 transition-opacity ${
          active ? 'opacity-100' : 'opacity-0 group-hover/widget:opacity-100'
        }`}
      />
    </>
  )
}
