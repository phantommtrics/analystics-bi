import { StatementType } from '@prisma/client'
import { z } from 'zod'

const columnMappingSchema = z.record(z.string(), z.string())

const customColumnSchema = z.object({
  id: z.string().min(1),
  header: z.string().min(1).max(200),
  sourceColumn: z.string().min(1),
})

const baseConfigSchema = z.object({
  headerTitle: z.string().max(500).optional(),
  headerSubtitle: z.string().max(500).optional(),
  dataReportId: z.string().min(1),
  headerReportId: z.string().min(1).optional(),
  customColumns: z.array(customColumnSchema).optional(),
})

const financialPlConfigSchema = baseConfigSchema.extend({
  columnMapping: columnMappingSchema.refine(
    (m) => typeof m.label === 'string' && m.label.length > 0,
    { message: 'label column mapping is required' },
  ),
})

const bankStatementConfigSchema = baseConfigSchema.extend({
  showOpeningBalance: z.boolean().optional(),
  columnMapping: columnMappingSchema
    .refine((m) => typeof m.date === 'string' && m.date.length > 0, {
      message: 'date column mapping is required',
    })
    .refine((m) => typeof m.description === 'string' && m.description.length > 0, {
      message: 'description column mapping is required',
    }),
})

const ledgerBalanceConfigSchema = baseConfigSchema.extend({
  groupByColumn: z.string().optional(),
  columnMapping: columnMappingSchema.refine(
    (m) => typeof m.account === 'string' && m.account.length > 0,
    { message: 'account column mapping is required' },
  ),
})

export type FinancialPlConfig = z.infer<typeof financialPlConfigSchema>
export type BankStatementConfig = z.infer<typeof bankStatementConfigSchema>
export type LedgerBalanceConfig = z.infer<typeof ledgerBalanceConfigSchema>
export type StatementConfig = FinancialPlConfig | BankStatementConfig | LedgerBalanceConfig

export function parseStatementConfig(
  type: StatementType,
  config: unknown,
): StatementConfig {
  switch (type) {
    case StatementType.FINANCIAL_PL:
      return financialPlConfigSchema.parse(config)
    case StatementType.BANK_STATEMENT:
      return bankStatementConfigSchema.parse(config)
    case StatementType.LEDGER_BALANCE:
      return ledgerBalanceConfigSchema.parse(config)
    default:
      throw new Error('INVALID_TYPE')
  }
}

export function extractReportIdsFromConfig(config: StatementConfig): string[] {
  const ids = [config.dataReportId]
  if (config.headerReportId) {
    ids.push(config.headerReportId)
  }
  return [...new Set(ids)]
}

export const statementConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(StatementType.FINANCIAL_PL), config: financialPlConfigSchema }),
  z.object({ type: z.literal(StatementType.BANK_STATEMENT), config: bankStatementConfigSchema }),
  z.object({ type: z.literal(StatementType.LEDGER_BALANCE), config: ledgerBalanceConfigSchema }),
])
