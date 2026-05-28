import React from 'react'

export interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
  isNumeric?: boolean
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (row: T) => string
  className?: string
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-bg-secondary">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`whitespace-nowrap px-4 py-3 text-xs font-medium uppercase text-text-secondary ${col.isNumeric ? 'text-right' : ''} ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-sm text-text-secondary"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <i className="ti ti-chart-bar-off text-2xl"></i>
                  <p>No data for this period</p>
                  <p className="text-xs">Try adjusting filters</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`
                  border-b border-border transition-colors last:border-0
                  ${rowIndex % 2 === 0 ? 'bg-bg-primary' : 'bg-bg-tertiary'}
                  ${onRowClick ? 'cursor-pointer hover:bg-[#EAF0FB] dark:hover:bg-brand-blue/10' : ''}
                `}
              >
                {columns.map((col, colIndex) => {
                  const content =
                    typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : (row[col.accessor] as React.ReactNode)

                  return (
                    <td
                      key={colIndex}
                      className={`px-4 py-3 text-sm text-text-primary ${col.isNumeric ? 'text-right font-mono' : ''} ${col.className || ''}`}
                    >
                      {content}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
