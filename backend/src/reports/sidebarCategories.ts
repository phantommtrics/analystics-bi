import { ReportCategory } from '@prisma/client'

/** Maps sidebar report category to parent module key in the roles matrix. */
export const SIDEBAR_CATEGORY_SECTION_MODULE: Partial<Record<ReportCategory, string>> = {
  [ReportCategory.AGENTS]: 'agents',
  [ReportCategory.BALANCE]: 'balance',
  [ReportCategory.CUSTOMERS]: 'customers',
  [ReportCategory.BANKS]: 'banks',
  [ReportCategory.REMITTANCE]: 'remittance',
  [ReportCategory.AML]: 'aml',
  [ReportCategory.RECONCILIATION]: 'reconciliation',
}

export const SIDEBAR_CATEGORY_LABELS: Partial<Record<ReportCategory, string>> = {
  [ReportCategory.AGENTS]: 'Agents',
  [ReportCategory.BALANCE]: 'Balance',
  [ReportCategory.CUSTOMERS]: 'Customers',
  [ReportCategory.BANKS]: 'Banks',
  [ReportCategory.REMITTANCE]: 'Remittance',
  [ReportCategory.AML]: 'AML',
  [ReportCategory.RECONCILIATION]: 'Reconciliation',
}

export const SIDEBAR_REPORT_CATEGORIES = new Set<ReportCategory>([
  ReportCategory.AGENTS,
  ReportCategory.BALANCE,
  ReportCategory.CUSTOMERS,
  ReportCategory.BANKS,
  ReportCategory.REMITTANCE,
  ReportCategory.AML,
  ReportCategory.RECONCILIATION,
])

export function normalizeShowInSidebarMenu(
  category: ReportCategory,
  showInSidebarMenu?: boolean,
): boolean {
  if (!showInSidebarMenu) return false
  return SIDEBAR_REPORT_CATEGORIES.has(category)
}
