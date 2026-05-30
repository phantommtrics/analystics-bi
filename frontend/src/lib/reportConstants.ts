export type ReportCategory =
  | 'FINANCIAL'
  | 'OPERATIONAL'
  | 'COMPLIANCE'
  | 'AGENT'
  | 'GENERAL'

export type ReportVisualization =
  | 'BAR_CHART'
  | 'LINE_CHART'
  | 'PIE_CHART'
  | 'TABLE_ONLY'

export const REPORT_CATEGORIES: {
  value: ReportCategory
  label: string
}[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'AGENT', label: 'Agent' },
]

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
}

export function formatReportDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
