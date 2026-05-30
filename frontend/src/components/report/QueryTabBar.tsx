import type { QueryTab } from '../../lib/queryTabs'

interface QueryTabBarProps {
  tabs: QueryTab[]
  activeTabId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
}

export function QueryTabBar({
  tabs,
  activeTabId,
  onSelect,
  onAdd,
  onClose,
}: QueryTabBarProps) {
  return (
    <div className="flex min-w-0 items-end gap-0.5 overflow-x-auto border-b border-border bg-[#252526] px-1 pt-1">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const hasResult = Boolean(tab.queryResult || tab.queryError)
        return (
          <div
            key={tab.id}
            className={`group flex max-w-[200px] shrink-0 items-center rounded-t-md border border-b-0 text-xs transition-colors ${
              isActive
                ? 'border-border bg-[#1e1e1e] text-[#e8e8e8]'
                : 'border-transparent bg-transparent text-[#969696] hover:bg-[#2a2d2e] hover:text-[#cccccc]'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className="flex min-w-0 items-center gap-1.5 px-3 py-2"
              title={tab.title}
            >
              <i className="ti ti-code shrink-0 text-sm opacity-70"></i>
              <span className="truncate">{tab.title}</span>
              {tab.savedReportId && (
                <i
                  className="ti ti-device-floppy shrink-0 text-[10px] opacity-60"
                  title="Saved report"
                />
              )}
              {hasResult && (
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${tab.queryError ? 'bg-semantic-red' : 'bg-semantic-green'}`}
                />
              )}
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
                className="mr-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                aria-label={`Close ${tab.title}`}
              >
                <i className="ti ti-x text-sm"></i>
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAdd}
        className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#969696] transition-colors hover:bg-[#2a2d2e] hover:text-[#cccccc]"
        title="New query tab"
        aria-label="New query tab"
      >
        <i className="ti ti-plus text-base"></i>
      </button>
    </div>
  )
}
