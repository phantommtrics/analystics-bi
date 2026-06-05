import type { QueryExecuteResult } from '../../api/reportBuilder'
import type {
  BankStatementConfig,
  FinancialPlConfig,
  LedgerBalanceConfig,
  StatementConfig,
  StatementType,
} from '../../lib/statementConfig'
import { BankStatementRenderer } from './BankStatementRenderer'
import { FinancialPlRenderer } from './FinancialPlRenderer'
import { LedgerBalanceRenderer } from './LedgerBalanceRenderer'

interface StatementPreviewProps {
  type: StatementType
  config: StatementConfig
  data: QueryExecuteResult | null
  headerData?: QueryExecuteResult | null
  title?: string
  subtitle?: string
  loading?: boolean
  error?: string
  showExport?: boolean
  exportPermissions?: { csv: boolean; pdf: boolean; xlsx: boolean }
  onExport?: (format: 'csv' | 'pdf' | 'xlsx') => void | Promise<void>
}

export function StatementPreview({
  type,
  config,
  data,
  headerData = null,
  title,
  subtitle,
  loading,
  error,
  showExport,
  exportPermissions,
  onExport,
}: StatementPreviewProps) {
  const exportProps = { showExport, exportPermissions, onExport }
  switch (type) {
    case 'FINANCIAL_PL':
      return (
        <FinancialPlRenderer
          config={config as FinancialPlConfig}
          data={data}
          title={title}
          subtitle={subtitle}
          loading={loading}
          error={error}
          {...exportProps}
        />
      )
    case 'BANK_STATEMENT':
      return (
        <BankStatementRenderer
          config={config as BankStatementConfig}
          data={data}
          headerData={headerData}
          title={title}
          subtitle={subtitle}
          loading={loading}
          error={error}
          {...exportProps}
        />
      )
    case 'LEDGER_BALANCE':
      return (
        <LedgerBalanceRenderer
          config={config as LedgerBalanceConfig}
          data={data}
          title={title}
          subtitle={subtitle}
          loading={loading}
          error={error}
          {...exportProps}
        />
      )
  }
}
