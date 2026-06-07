import { StatementType } from '@prisma/client'
import { z } from 'zod'

const emptyToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val

const optionalNonEmptyString = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
)

const columnMappingSchema = z.record(z.string(), z.string())

const customColumnSchema = z.object({
  id: z.string().min(1),
  header: z.string().max(200),
  sourceColumn: z.string().max(200),
})

const baseConfigSchema = z.object({
  headerTitle: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
  headerSubtitle: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
  dataReportId: z.string().max(100),
  headerReportId: optionalNonEmptyString,
  customColumns: z.array(customColumnSchema).optional(),
})

const financialPlConfigSchema = baseConfigSchema.extend({
  columnMapping: columnMappingSchema,
})

const bankStatementConfigSchema = baseConfigSchema.extend({
  showOpeningBalance: z.boolean().optional(),
  columnMapping: columnMappingSchema,
})

const ledgerBalanceConfigSchema = baseConfigSchema.extend({
  groupByColumn: optionalNonEmptyString,
  columnMapping: columnMappingSchema,
})

const customStatementColumnSchema = z.object({
  id: z.string().min(1),
  header: z.string().max(200),
  sourceColumn: z.string().max(200),
  dataType: z.enum(['text', 'number', 'currency', 'date', 'datetime', 'percent', 'boolean']),
  currency: z.preprocess(emptyToUndefined, z.string().max(10).optional()),
  decimals: z.coerce.number().int().min(0).max(4).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  highlightNegative: z.boolean().optional(),
  monospace: z.boolean().optional(),
})

const customStatementConfigSchema = baseConfigSchema
  .omit({ customColumns: true })
  .extend({
    columns: z.array(customStatementColumnSchema).default([]),
    groupByColumn: optionalNonEmptyString,
  })

export type FinancialPlConfig = z.infer<typeof financialPlConfigSchema>
export type BankStatementConfig = z.infer<typeof bankStatementConfigSchema>
export type LedgerBalanceConfig = z.infer<typeof ledgerBalanceConfigSchema>
export type CustomStatementConfig = z.infer<typeof customStatementConfigSchema>
export type StatementConfig =
  | FinancialPlConfig
  | BankStatementConfig
  | LedgerBalanceConfig
  | CustomStatementConfig

function normalizeConfigInput(config: unknown): unknown {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config
  }

  const input = { ...(config as Record<string, unknown>) }

  if (Array.isArray(input.customColumns)) {
    input.customColumns = input.customColumns.filter(
      (column) =>
        column &&
        typeof column === 'object' &&
        typeof (column as { header?: unknown }).header === 'string' &&
        typeof (column as { sourceColumn?: unknown }).sourceColumn === 'string' &&
        ((column as { header: string }).header.trim().length > 0 ||
          (column as { sourceColumn: string }).sourceColumn.trim().length > 0),
    )
    if ((input.customColumns as unknown[]).length === 0) {
      delete input.customColumns
    }
  }

  return input
}

export function parseStatementConfig(
  type: StatementType,
  config: unknown,
): StatementConfig {
  const normalized = normalizeConfigInput(config)

  switch (type) {
    case StatementType.FINANCIAL_PL:
      return financialPlConfigSchema.parse(normalized)
    case StatementType.BANK_STATEMENT:
      return bankStatementConfigSchema.parse(normalized)
    case StatementType.LEDGER_BALANCE:
      return ledgerBalanceConfigSchema.parse(normalized)
    case StatementType.CUSTOM:
      return customStatementConfigSchema.parse(normalized)
    default:
      throw new Error('INVALID_TYPE')
  }
}

export function extractReportIdsFromConfig(config: StatementConfig): string[] {
  const ids: string[] = []
  if (config.dataReportId.trim().length > 0) {
    ids.push(config.dataReportId)
  }
  if (config.headerReportId && config.headerReportId.trim().length > 0) {
    ids.push(config.headerReportId)
  }
  return [...new Set(ids)]
}

export const statementConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(StatementType.FINANCIAL_PL), config: financialPlConfigSchema }),
  z.object({ type: z.literal(StatementType.BANK_STATEMENT), config: bankStatementConfigSchema }),
  z.object({ type: z.literal(StatementType.LEDGER_BALANCE), config: ledgerBalanceConfigSchema }),
  z.object({ type: z.literal(StatementType.CUSTOM), config: customStatementConfigSchema }),
])
