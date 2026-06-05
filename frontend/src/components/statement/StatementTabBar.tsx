import type { StatementTab } from '../../lib/statementTabs'
import { isStatementTabDirty } from '../../lib/statementTabs'

interface StatementTabBarProps {
  tabs: StatementTab[]
  activeTabId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
}

export function StatementTabBar({
  tabs,
  activeTabId,
  onSelect,
  onAdd,
  onClose,
}: StatementTabBarProps) {
  return (
    <div className="flex min-w-0 items-end gap-0.5 overflow-x-auto border-b border-border bg-bg-secondary px-1 pt-1">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const dirty = isStatementTabDirty(tab)
        return (
          <div
            key={tab.id}
            className={`group flex max-w-[220px] shrink-0 items-center rounded-t-md border border-b-0 text-xs transition-colors ${
              isActive
                ? 'border-border bg-bg-primary text-text-primary'
                : 'border-transparent bg-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className="flex min-w-0 items-center gap-1.5 px-3 py-2"
              title={tab.title}
            >
              <i className="ti ti-file-invoice shrink-0 text-sm opacity-70"></i>
              <span className="truncate">{tab.title}</span>
              {tab.savedStatementId && (
                <i
                  className="ti ti-device-floppy shrink-0 text-[10px] opacity-60"
                  title="Saved statement"
                />
              )}
              {dirty && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  title="Unsaved changes"
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
                className="mr-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100 dark:hover:bg-white/10"
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
        className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        title="New statement tab"
        aria-label="New statement tab"
      >
        <i className="ti ti-plus text-base"></i>
      </button>
    </div>
  )
}
