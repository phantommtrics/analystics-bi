import { useCallback, useEffect, useMemo, useState } from 'react'
import { reportBuilderApi, type SchemaColumn, type SchemaTable } from '../../api/reportBuilder'
import { SearchableSelect } from '../ui/SearchableSelect'

export type SqlInsertMode = 'append' | 'line1'

interface DatabaseTableExplorerProps {
  accessToken: string
  dataSourceId: string
  onInsertFragment: (fragment: string, mode?: SqlInsertMode) => void
}

function tableOptionId(table: SchemaTable): string {
  return `${table.schema}\0${table.name}`
}

function parseTableOptionId(id: string): { schema: string; table: string } | null {
  const idx = id.indexOf('\0')
  if (idx <= 0) return null
  return { schema: id.slice(0, idx), table: id.slice(idx + 1) }
}

export function DatabaseTableExplorer({
  accessToken,
  dataSourceId,
  onInsertFragment,
}: DatabaseTableExplorerProps) {
  const [tables, setTables] = useState<SchemaTable[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [tablesError, setTablesError] = useState('')

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [columns, setColumns] = useState<SchemaColumn[]>([])
  const [columnsLoading, setColumnsLoading] = useState(false)
  const [columnsError, setColumnsError] = useState('')

  const tableOptions = useMemo(
    () =>
      tables.map((t) => ({
        id: tableOptionId(t),
        label: t.qualifiedName,
        description: t.schema === 'public' ? undefined : `schema: ${t.schema}`,
      })),
    [tables],
  )

  const selectedTable = useMemo(() => {
    if (!selectedTableId) return null
    const parsed = parseTableOptionId(selectedTableId)
    if (!parsed) return null
    return tables.find((t) => t.schema === parsed.schema && t.name === parsed.table) ?? null
  }, [selectedTableId, tables])

  const loadTables = useCallback(async () => {
    if (!accessToken || !dataSourceId) {
      setTables([])
      return
    }
    setTablesLoading(true)
    setTablesError('')
    try {
      const list = await reportBuilderApi.listTables(accessToken, dataSourceId)
      setTables(list)
    } catch (err) {
      setTables([])
      setTablesError(err instanceof Error ? err.message : 'Failed to load tables')
    } finally {
      setTablesLoading(false)
    }
  }, [accessToken, dataSourceId])

  useEffect(() => {
    setSelectedTableId(null)
    setColumns([])
    setColumnsError('')
    void loadTables()
  }, [loadTables])

  useEffect(() => {
    if (!accessToken || !dataSourceId || !selectedTableId) {
      setColumns([])
      setColumnsError('')
      return
    }

    const parsed = parseTableOptionId(selectedTableId)
    if (!parsed) return

    let cancelled = false
    setColumnsLoading(true)
    setColumnsError('')

    reportBuilderApi
      .getTableColumns(accessToken, dataSourceId, parsed.schema, parsed.table)
      .then((list) => {
        if (!cancelled) setColumns(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setColumns([])
          setColumnsError(err instanceof Error ? err.message : 'Failed to load columns')
        }
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, dataSourceId, selectedTableId])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Database tables
            </h3>
            <p className="text-[10px] text-text-secondary">
              {tablesLoading
                ? 'Loading tables…'
                : `${tables.length} table${tables.length === 1 ? '' : 's'} available`}
            </p>
          </div>
          <button
            type="button"
            title="Refresh tables"
            onClick={() => void loadTables()}
            disabled={!dataSourceId || tablesLoading}
            className="rounded-sm p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-40"
          >
            <i className={`ti ti-refresh text-sm ${tablesLoading ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-b border-border px-3 py-3">
        {!dataSourceId ? (
          <p className="text-xs text-text-secondary">Select a data source to browse tables.</p>
        ) : (
          <>
            <SearchableSelect
              options={tableOptions}
              value={selectedTableId}
              onChange={setSelectedTableId}
              placeholder="Search tables…"
              searchPlaceholder="Filter table names…"
              emptyMessage={tablesLoading ? 'Loading…' : 'No tables match'}
              maxVisibleItems={5}
              disabled={tablesLoading || !dataSourceId}
            />
            {tablesError && (
              <p className="text-[11px] text-semantic-red">{tablesError}</p>
            )}
            {selectedTable && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onInsertFragment(selectedTable.qualifiedName)}
                  className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] text-text-primary hover:bg-bg-secondary"
                >
                  <i className="ti ti-table-plus text-xs"></i>
                  Insert table
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onInsertFragment(
                      `SELECT * FROM ${selectedTable.qualifiedName} LIMIT 100`,
                      'line1',
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] text-text-primary hover:bg-bg-secondary"
                >
                  <i className="ti ti-code text-xs"></i>
                  SELECT *
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!selectedTable ? (
          <p className="py-6 text-center text-xs text-text-secondary">
            Select a table to preview columns and types.
          </p>
        ) : columnsLoading ? (
          <p className="py-6 text-center text-xs text-text-secondary">Loading columns…</p>
        ) : columnsError ? (
          <p className="py-4 text-center text-xs text-semantic-red">{columnsError}</p>
        ) : columns.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-secondary">No columns found.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-text-secondary">
                <th className="py-1.5 pr-2 font-medium">Column</th>
                <th className="py-1.5 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {columns.map((col) => (
                <tr
                  key={col.name}
                  className="group cursor-pointer hover:bg-bg-secondary"
                  onClick={() => onInsertFragment(col.name)}
                  title="Click to insert column name"
                >
                  <td className="py-1.5 pr-2 font-mono text-text-primary">
                    {col.name}
                    {!col.nullable && (
                      <span className="ml-1 text-[9px] text-text-secondary">*</span>
                    )}
                  </td>
                  <td className="py-1.5 font-mono text-[11px] text-text-secondary">
                    {col.dataType}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
