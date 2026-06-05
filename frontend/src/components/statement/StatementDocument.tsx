import type { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { StatementExportMenu } from './StatementExportMenu'

interface StatementDocumentProps {
  title: string
  subtitle?: string
  headerContent?: ReactNode
  children: ReactNode
  loading?: boolean
  error?: string
  showExport?: boolean
  exportPermissions?: { csv: boolean; pdf: boolean; xlsx: boolean }
  onExport?: (format: 'csv' | 'pdf' | 'xlsx') => void | Promise<void>
}

export function StatementDocument({
  title,
  subtitle,
  headerContent,
  children,
  loading,
  error,
  showExport,
  exportPermissions,
  onExport,
}: StatementDocumentProps) {
  return (
    <Card noPadding className="overflow-hidden">
      <div className="border-b border-border bg-bg-secondary p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium text-text-primary">{title}</h2>
            {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
          </div>
          {showExport && exportPermissions && onExport && (
            <StatementExportMenu
              disabled={loading || Boolean(error)}
              permissions={exportPermissions}
              onExport={onExport}
            />
          )}
        </div>
        {headerContent}
      </div>

      {error && (
        <div className="border-b border-semantic-red/20 bg-semantic-red/10 px-5 py-3 text-sm text-semantic-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-text-secondary">Loading statement...</div>
      ) : (
        children
      )}
    </Card>
  )
}
