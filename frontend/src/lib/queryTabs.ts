import type { QueryExecuteResult } from '../api/reportBuilder'
import type { ReportVisualization } from './reportConstants'

export type QueryTab = {
  id: string
  title: string
  sql: string
  visualization: ReportVisualization
  queryResult: QueryExecuteResult | null
  queryError: string | null
  /** When true, editor is split to show preview below. */
  previewOpen: boolean
  /** Links tab to a saved report so it can be reopened from the sidebar. */
  savedReportId: string | null
}

let tabSeq = 0

export function createQueryTab(
  sql: string,
  title?: string,
  visualization: ReportVisualization = 'BAR_CHART',
  savedReportId: string | null = null,
): QueryTab {
  tabSeq += 1
  const n = tabSeq
  return {
    id: `query-tab-${n}-${Date.now()}`,
    title: title ?? `Query ${n}`,
    sql,
    visualization,
    queryResult: null,
    queryError: null,
    previewOpen: false,
    savedReportId,
  }
}

export function duplicateTabTitle(existing: string[], base: string) {
  let title = `${base} (copy)`
  let i = 2
  while (existing.includes(title)) {
    title = `${base} (copy ${i})`
    i += 1
  }
  return title
}
