import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from './Card'

interface ExpandableCardProps {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  noPadding?: boolean
  className?: string
  headerClassName?: string
  bodyClassName?: string
  /** Extra classes on the expanded overlay scroll area (padding is applied by default). */
  expandedBodyClassName?: string
}

export function ExpandableCard({
  title,
  children,
  action,
  noPadding = false,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  expandedBodyClassName = '',
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExpanded(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  const expandControl = (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary"
      aria-label={expanded ? 'Collapse to original view' : 'Expand to full window'}
      title={expanded ? 'Collapse' : 'Expand'}
    >
      <i className={`ti text-lg ${expanded ? 'ti-arrows-minimize' : 'ti-arrows-maximize'}`}></i>
    </button>
  )

  const header = (
    <CardHeader
      className={headerClassName}
      action={
        <div className="flex items-center gap-2">
          {action}
          {expandControl}
        </div>
      }
    >
      <CardTitle>{title}</CardTitle>
    </CardHeader>
  )

  const inlineBody = (
    <div className={`${noPadding ? '' : 'px-4 pb-4 sm:px-5 sm:pb-5'} ${bodyClassName}`}>
      {children}
    </div>
  )

  const expandedBody = (
    <div
      className={`min-h-0 flex-1 overflow-auto p-5 sm:p-6 md:p-8 ${expandedBodyClassName}`}
    >
      <div className={bodyClassName}>{children}</div>
    </div>
  )

  return (
    <>
      <Card noPadding className={`flex flex-col ${className}`}>
        {header}
        <div className="min-h-0 flex-1">{inlineBody}</div>
      </Card>

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-4 sm:p-6">
          <Card
            noPadding
            className="mx-auto flex h-full w-full max-w-[1600px] flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="shrink-0 border-b border-border px-5 pt-5 sm:px-6 sm:pt-6">
              {header}
            </div>
            {expandedBody}
          </Card>
        </div>
      )}
    </>
  )
}
