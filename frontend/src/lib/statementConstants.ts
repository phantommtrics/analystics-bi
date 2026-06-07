import type { StatementType } from './statementConfig'

export const STATEMENT_TYPES: Array<{
  value: StatementType
  label: string
  description: string
  icon: string
}> = [
  {
    value: 'FINANCIAL_PL',
    label: 'Financial P&L',
    description: 'Profit & loss with current, previous, and variance columns',
    icon: 'ti-chart-bar',
  },
  {
    value: 'BANK_STATEMENT',
    label: 'Bank Statement',
    description: 'Customer transaction ledger with debits, credits, and balance',
    icon: 'ti-building-bank',
  },
  {
    value: 'LEDGER_BALANCE',
    label: 'Ledger Balance',
    description: 'Account balance grid with debit, credit, and net columns',
    icon: 'ti-scale',
  },
  {
    value: 'CUSTOM',
    label: 'Custom Table',
    description: 'Define your own columns with data types, currency, and formatting',
    icon: 'ti-table',
  },
]

export function statementTypeMeta(type: StatementType) {
  return STATEMENT_TYPES.find((t) => t.value === type) ?? STATEMENT_TYPES[0]
}
