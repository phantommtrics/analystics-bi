import { SkeletonShimmer } from './SkeletonShimmer'

interface DataTableSkeletonProps {
  columnHeaders?: string[]
  columnCount?: number
  rowCount?: number
  compact?: boolean
  className?: string
}

export function DataTableSkeleton({
  columnHeaders,
  columnCount = 5,
  rowCount = 10,
  compact = false,
  className = '',
}: DataTableSkeletonProps) {
  const headers =
    columnHeaders && columnHeaders.length > 0
      ? columnHeaders
      : Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`)

  const cellPad = compact ? 'px-2 py-2' : 'px-4 py-3'
  const headerPad = compact ? 'px-2 py-2' : 'px-4 py-3'

  return (
    <div className={`w-full overflow-x-auto ${className}`} aria-busy="true" aria-label="Loading data">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-bg-secondary">
            {headers.map((header, i) => (
              <th
                key={i}
                className={`whitespace-nowrap ${headerPad} text-xs font-medium uppercase text-text-secondary`}
              >
                {columnHeaders ? header : <SkeletonShimmer className="h-3 w-16" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-b border-border last:border-0 ${rowIndex % 2 === 0 ? 'bg-bg-primary' : 'bg-bg-tertiary'}`}
            >
              {headers.map((_, colIndex) => (
                <td key={colIndex} className={cellPad}>
                  <SkeletonShimmer
                    className={`h-3.5 ${colIndex === 0 ? 'w-[85%]' : colIndex % 2 === 0 ? 'w-[70%]' : 'w-[55%]'}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
