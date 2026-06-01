export type ReportCategory =
  | 'FINANCIAL'
  | 'OPERATIONAL'
  | 'COMPLIANCE'
  | 'AGENT'
  | 'GENERAL'
  | 'AGENTS'
  | 'BALANCE'
  | 'CUSTOMERS'
  | 'BANKS'
  | 'REMITTANCE'
  | 'AML'
  | 'RECONCILIATION'

export type SidebarReportCategory = Extract<
  ReportCategory,
  | 'AGENTS'
  | 'BALANCE'
  | 'CUSTOMERS'
  | 'BANKS'
  | 'REMITTANCE'
  | 'AML'
  | 'RECONCILIATION'
>

export type ReportVisualization =
  | 'BAR_CHART'
  | 'LINE_CHART'
  | 'PIE_CHART'
  | 'TABLE_ONLY'

export const SIDEBAR_REPORT_CATEGORIES: SidebarReportCategory[] = [
  'AGENTS',
  'BALANCE',
  'CUSTOMERS',
  'BANKS',
  'REMITTANCE',
  'AML',
  'RECONCILIATION',
]

export function isSidebarReportCategory(
  category: ReportCategory,
): category is SidebarReportCategory {
  return (SIDEBAR_REPORT_CATEGORIES as ReportCategory[]).includes(category)
}

export const REPORT_CATEGORIES: {
  value: ReportCategory
  label: string
}[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'AGENTS', label: 'Agents' },
  { value: 'BALANCE', label: 'Balance' },
  { value: 'CUSTOMERS', label: 'Customers' },
  { value: 'BANKS', label: 'Banks' },
  { value: 'REMITTANCE', label: 'Remittance' },
  { value: 'AML', label: 'AML' },
  { value: 'RECONCILIATION', label: 'Reconciliation' },
]

export const SIDEBAR_MENU_REPORT_CATEGORIES = REPORT_CATEGORIES.filter((c) =>
  isSidebarReportCategory(c.value),
)

export const REPORT_VISUALIZATIONS: {
  value: ReportVisualization
  label: string
  icon: string
}[] = [
  { value: 'BAR_CHART', label: 'Bar chart', icon: 'ti-chart-bar' },
  { value: 'LINE_CHART', label: 'Line chart', icon: 'ti-chart-line' },
  { value: 'PIE_CHART', label: 'Pie chart', icon: 'ti-chart-pie' },
  { value: 'TABLE_ONLY', label: 'Table only', icon: 'ti-table' },
]

export const categoryMeta: Record<
  ReportCategory,
  { label: string; icon: string; badgeVariant: 'blue' | 'gold' | 'green' | 'purple' | 'gray' }
> = {
  FINANCIAL: { label: 'Financial', icon: 'ti-receipt', badgeVariant: 'blue' },
  OPERATIONAL: { label: 'Operational', icon: 'ti-activity', badgeVariant: 'gold' },
  COMPLIANCE: { label: 'Compliance', icon: 'ti-shield-check', badgeVariant: 'green' },
  AGENT: { label: 'Agent', icon: 'ti-users', badgeVariant: 'purple' },
  GENERAL: { label: 'General', icon: 'ti-report', badgeVariant: 'gray' },
  AGENTS: { label: 'Agents', icon: 'ti-users', badgeVariant: 'purple' },
  BALANCE: { label: 'Balance', icon: 'ti-scale', badgeVariant: 'blue' },
  CUSTOMERS: { label: 'Customers', icon: 'ti-user', badgeVariant: 'gold' },
  BANKS: { label: 'Banks', icon: 'ti-building-bank', badgeVariant: 'blue' },
  REMITTANCE: { label: 'Remittance', icon: 'ti-world', badgeVariant: 'gold' },
  AML: { label: 'AML', icon: 'ti-alert-circle', badgeVariant: 'green' },
  RECONCILIATION: { label: 'Reconciliation', icon: 'ti-shield-check', badgeVariant: 'green' },
}

/** Maps sidebar report category to nav module permission key. */
export const sidebarCategoryModuleKey: Record<SidebarReportCategory, string> = {
  AGENTS: 'agents',
  BALANCE: 'balance',
  CUSTOMERS: 'customers',
  BANKS: 'banks',
  REMITTANCE: 'remittance',
  AML: 'aml',
  RECONCILIATION: 'reconciliation',
}

export function formatReportDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
