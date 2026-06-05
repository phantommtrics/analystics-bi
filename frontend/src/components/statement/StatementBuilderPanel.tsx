import { useMemo, useState } from 'react'
import { Badge } from '../ui/Badge'
import type { StatementSummary } from '../../api/statements'
import { formatReportDate } from '../../lib/reportConstants'
import { STATEMENT_TYPES, statementTypeMeta } from '../../lib/statementConstants'
import type { StatementType } from '../../lib/statementConfig'

interface StatementBuilderPanelProps {
  statements: StatementSummary[]
  loading: boolean
  activeStatementId: string | null
  openStatementIds: string[]
  canEdit: boolean
  canDelete: boolean
  onSelectStatement: (statement: StatementSummary) => void
  onNewStatement: (type: StatementType) => void
  onDeleteStatement: (statement: StatementSummary) => void
}

export function StatementBuilderPanel({
  statements,
  loading,
  activeStatementId,
  openStatementIds,
  canEdit,
  canDelete,
  onSelectStatement,
  onNewStatement,
  onDeleteStatement,
}: StatementBuilderPanelProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All' | StatementType>('All')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return statements.filter((statement) => {
      if (typeFilter !== 'All' && statement.type !== typeFilter) return false
      if (!q) return true
      return statement.name.toLowerCase().includes(q)
    })
  }, [statements, search, typeFilter])

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-bg-primary lg:w-[272px] lg:border-b-0 lg:border-r">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Statements</h2>
        <p className="text-xs text-text-secondary">Saved statement templates</p>
      </div>

      <div className="space-y-3 border-b border-border p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search statements..."
          className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'All' | StatementType)}
          className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
        >
          <option value="All">All types</option>
          {STATEMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {canEdit && (
        <div className="space-y-2 border-b border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            New statement
          </p>
          {STATEMENT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => onNewStatement(type.value)}
              className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-brand-blue hover:bg-brand-blue/5"
            >
              <i className={`ti ${type.icon} text-brand-blue`}></i>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-text-primary">{type.label}</span>
                <span className="block truncate text-xs text-text-secondary">
                  {type.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="px-2 py-8 text-center text-sm text-text-secondary">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-text-secondary">
            No statements yet
          </div>
        ) : (
          filtered.map((statement) => {
            const meta = statementTypeMeta(statement.type)
            const isOpen = openStatementIds.includes(statement.id)
            const active = statement.id === activeStatementId
            return (
              <div
                key={statement.id}
                className={`mb-1 rounded-md border px-3 py-2 transition-colors ${
                  active
                    ? 'border-brand-blue bg-brand-blue/10'
                    : isOpen
                      ? 'border-brand-blue/20 bg-brand-blue/[0.02]'
                      : 'border-transparent hover:border-border hover:bg-bg-secondary'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectStatement(statement)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {statement.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="gray">{meta.label}</Badge>
                        {statement.isPublished ? (
                          <Badge variant="green">Published</Badge>
                        ) : (
                          <Badge variant="amber">Draft</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">
                        {formatReportDate(statement.updatedAt)}
                      </div>
                    </div>
                  </div>
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteStatement(statement)}
                    className="mt-2 text-xs text-semantic-red hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
