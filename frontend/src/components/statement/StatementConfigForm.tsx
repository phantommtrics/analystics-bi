import type { SavedReportSummary } from '../../api/reports'
import type {
  BankStatementConfig,
  FinancialPlConfig,
  LedgerBalanceConfig,
  StatementConfig,
  StatementType,
} from '../../lib/statementConfig'
import { ColumnMappingSelect, ReportSelect } from './ColumnMappingSelect'
import { CustomColumnsSection } from './CustomColumnsSection'

interface StatementConfigFormProps {
  type: StatementType
  config: StatementConfig
  reports: SavedReportSummary[]
  columns: string[]
  sampleRow?: Record<string, unknown> | null
  onChange: (config: StatementConfig) => void
}

function CustomColumnsBlock<T extends StatementConfig>({
  config,
  columns,
  sampleRow,
  onChange,
}: {
  config: T
  columns: string[]
  sampleRow?: Record<string, unknown> | null
  onChange: (config: T) => void
}) {
  return (
    <CustomColumnsSection
      columns={columns}
      sampleRow={sampleRow}
      customColumns={config.customColumns ?? []}
      onChange={(customColumns) =>
        onChange({
          ...config,
          customColumns: customColumns.length > 0 ? customColumns : undefined,
        })
      }
    />
  )
}

function HeaderFields({
  config,
  onChange,
}: {
  config: StatementConfig
  onChange: (patch: { headerTitle?: string; headerSubtitle?: string }) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1 block text-text-secondary">Header title</span>
        <input
          type="text"
          value={config.headerTitle ?? ''}
          onChange={(e) => onChange({ headerTitle: e.target.value })}
          className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
          placeholder="Statement title shown to users"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-text-secondary">Header subtitle</span>
        <input
          type="text"
          value={config.headerSubtitle ?? ''}
          onChange={(e) => onChange({ headerSubtitle: e.target.value })}
          className="w-full rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue"
          placeholder="Period or entity label"
        />
      </label>
    </div>
  )
}

function FinancialPlForm({
  config,
  reports,
  columns,
  sampleRow,
  onChange,
}: {
  config: FinancialPlConfig
  reports: SavedReportSummary[]
  columns: string[]
  sampleRow?: Record<string, unknown> | null
  onChange: (config: FinancialPlConfig) => void
}) {
  const update = (patch: Partial<FinancialPlConfig>) => onChange({ ...config, ...patch })
  const updateMapping = (patch: Partial<FinancialPlConfig['columnMapping']>) =>
    onChange({ ...config, columnMapping: { ...config.columnMapping, ...patch } })

  return (
    <div className="space-y-4">
      <HeaderFields config={config} onChange={update} />
      <ReportSelect
        label="Data report"
        value={config.dataReportId}
        reports={reports}
        required
        onChange={(dataReportId) => update({ dataReportId })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ColumnMappingSelect
          label="Line item column"
          value={config.columnMapping.label}
          columns={columns}
          sampleRow={sampleRow}
          required
          onChange={(label) => updateMapping({ label })}
        />
        <ColumnMappingSelect
          label="Row type column"
          value={config.columnMapping.rowType ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(rowType) => updateMapping({ rowType: rowType || undefined })}
        />
        <ColumnMappingSelect
          label="Current period column"
          value={config.columnMapping.current ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(current) => updateMapping({ current: current || undefined })}
        />
        <ColumnMappingSelect
          label="Previous period column"
          value={config.columnMapping.previous ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(previous) => updateMapping({ previous: previous || undefined })}
        />
        <ColumnMappingSelect
          label="Variance column"
          value={config.columnMapping.variance ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(variance) => updateMapping({ variance: variance || undefined })}
        />
      </div>
      <CustomColumnsBlock
        config={config}
        columns={columns}
        sampleRow={sampleRow}
        onChange={onChange}
      />
    </div>
  )
}

function BankStatementForm({
  config,
  reports,
  columns,
  sampleRow,
  onChange,
}: {
  config: BankStatementConfig
  reports: SavedReportSummary[]
  columns: string[]
  sampleRow?: Record<string, unknown> | null
  onChange: (config: BankStatementConfig) => void
}) {
  const update = (patch: Partial<BankStatementConfig>) => onChange({ ...config, ...patch })
  const updateMapping = (patch: Partial<BankStatementConfig['columnMapping']>) =>
    onChange({ ...config, columnMapping: { ...config.columnMapping, ...patch } })

  return (
    <div className="space-y-4">
      <HeaderFields config={config} onChange={update} />
      <ReportSelect
        label="Transaction data report"
        value={config.dataReportId}
        reports={reports}
        required
        onChange={(dataReportId) => update({ dataReportId })}
      />
      <ReportSelect
        label="Header metadata report (optional)"
        value={config.headerReportId ?? ''}
        reports={reports}
        onChange={(headerReportId) =>
          update({ headerReportId: headerReportId || undefined })
        }
      />
      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={config.showOpeningBalance ?? true}
          onChange={(e) => update({ showOpeningBalance: e.target.checked })}
          className="rounded border-border"
        />
        Show opening balance row when available
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <ColumnMappingSelect
          label="Date column"
          value={config.columnMapping.date}
          columns={columns}
          sampleRow={sampleRow}
          required
          onChange={(date) => updateMapping({ date })}
        />
        <ColumnMappingSelect
          label="Description column"
          value={config.columnMapping.description}
          columns={columns}
          sampleRow={sampleRow}
          required
          onChange={(description) => updateMapping({ description })}
        />
        <ColumnMappingSelect
          label="Reference column"
          value={config.columnMapping.reference ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(reference) => updateMapping({ reference: reference || undefined })}
        />
        <ColumnMappingSelect
          label="Debit column"
          value={config.columnMapping.debit ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(debit) => updateMapping({ debit: debit || undefined })}
        />
        <ColumnMappingSelect
          label="Credit column"
          value={config.columnMapping.credit ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(credit) => updateMapping({ credit: credit || undefined })}
        />
        <ColumnMappingSelect
          label="Balance column"
          value={config.columnMapping.balance ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(balance) => updateMapping({ balance: balance || undefined })}
        />
      </div>
      <CustomColumnsBlock
        config={config}
        columns={columns}
        sampleRow={sampleRow}
        onChange={onChange}
      />
    </div>
  )
}

function LedgerBalanceForm({
  config,
  reports,
  columns,
  sampleRow,
  onChange,
}: {
  config: LedgerBalanceConfig
  reports: SavedReportSummary[]
  columns: string[]
  sampleRow?: Record<string, unknown> | null
  onChange: (config: LedgerBalanceConfig) => void
}) {
  const update = (patch: Partial<LedgerBalanceConfig>) => onChange({ ...config, ...patch })
  const updateMapping = (patch: Partial<LedgerBalanceConfig['columnMapping']>) =>
    onChange({ ...config, columnMapping: { ...config.columnMapping, ...patch } })

  return (
    <div className="space-y-4">
      <HeaderFields config={config} onChange={update} />
      <ReportSelect
        label="Balance data report"
        value={config.dataReportId}
        reports={reports}
        required
        onChange={(dataReportId) => update({ dataReportId })}
      />
      <ColumnMappingSelect
        label="Group by column (optional)"
        value={config.groupByColumn ?? ''}
        columns={columns}
        sampleRow={sampleRow}
        onChange={(groupByColumn) =>
          update({ groupByColumn: groupByColumn || undefined })
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ColumnMappingSelect
          label="Account column"
          value={config.columnMapping.account}
          columns={columns}
          sampleRow={sampleRow}
          required
          onChange={(account) => updateMapping({ account })}
        />
        <ColumnMappingSelect
          label="Description column"
          value={config.columnMapping.description ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(description) => updateMapping({ description: description || undefined })}
        />
        <ColumnMappingSelect
          label="Debit column"
          value={config.columnMapping.debit ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(debit) => updateMapping({ debit: debit || undefined })}
        />
        <ColumnMappingSelect
          label="Credit column"
          value={config.columnMapping.credit ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(credit) => updateMapping({ credit: credit || undefined })}
        />
        <ColumnMappingSelect
          label="Net balance column"
          value={config.columnMapping.net ?? ''}
          columns={columns}
          sampleRow={sampleRow}
          onChange={(net) => updateMapping({ net: net || undefined })}
        />
      </div>
      <CustomColumnsBlock
        config={config}
        columns={columns}
        sampleRow={sampleRow}
        onChange={onChange}
      />
    </div>
  )
}

export function StatementConfigForm({
  type,
  config,
  reports,
  columns,
  sampleRow,
  onChange,
}: StatementConfigFormProps) {
  switch (type) {
    case 'FINANCIAL_PL':
      return (
        <FinancialPlForm
          config={config as FinancialPlConfig}
          reports={reports}
          columns={columns}
          sampleRow={sampleRow}
          onChange={onChange}
        />
      )
    case 'BANK_STATEMENT':
      return (
        <BankStatementForm
          config={config as BankStatementConfig}
          reports={reports}
          columns={columns}
          sampleRow={sampleRow}
          onChange={onChange}
        />
      )
    case 'LEDGER_BALANCE':
      return (
        <LedgerBalanceForm
          config={config as LedgerBalanceConfig}
          reports={reports}
          columns={columns}
          sampleRow={sampleRow}
          onChange={onChange}
        />
      )
  }
}
