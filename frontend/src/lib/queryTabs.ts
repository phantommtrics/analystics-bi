import type { SavedReportDetail } from '../api/reports'
import type { QueryExecuteResult } from '../api/reportBuilder'
import type { ReportCategory, ReportVisualization } from './reportConstants'

export type QueryEditorSnapshot = {
  name: string
  description: string
  category: ReportCategory
  sql: string
  visualization: ReportVisualization
  dataSourceId: string
}

export type QueryTab = {
  id: string
  title: string
  savedReportId: string | null
  name: string
  description: string
  category: ReportCategory
  dataSourceId: string
  isPublished: boolean
  savedSnapshot: QueryEditorSnapshot | null
  sql: string
  visualization: ReportVisualization
  queryResult: QueryExecuteResult | null
  queryError: string | null
  /** When true, editor is split to show preview below. */
  previewOpen: boolean
}

let tabSeq = 0

export function createQueryTab(
  opts?: Partial<
    Pick<
      QueryTab,
      | 'title'
      | 'name'
      | 'description'
      | 'category'
      | 'dataSourceId'
      | 'savedReportId'
      | 'isPublished'
      | 'savedSnapshot'
      | 'sql'
      | 'visualization'
    >
  >,
): QueryTab {
  tabSeq += 1
  const n = tabSeq
  const sql = opts?.sql ?? ''
  return {
    id: `query-tab-${n}-${Date.now()}`,
    title: opts?.title ?? `Query ${n}`,
    savedReportId: opts?.savedReportId ?? null,
    name: opts?.name ?? 'Untitled report',
    description: opts?.description ?? '',
    category: opts?.category ?? 'GENERAL',
    dataSourceId: opts?.dataSourceId ?? '',
    isPublished: opts?.isPublished ?? false,
    savedSnapshot: opts?.savedSnapshot ?? null,
    sql,
    visualization: opts?.visualization ?? 'BAR_CHART',
    queryResult: null,
    queryError: null,
    previewOpen: false,
  }
}

export function queryTabFromDetail(report: SavedReportDetail): QueryTab {
  const description = report.description ?? ''
  const snapshot: QueryEditorSnapshot = {
    name: report.name,
    description,
    category: report.category,
    sql: report.sql,
    visualization: report.visualization,
    dataSourceId: report.dataSourceId,
  }
  return createQueryTab({
    title: report.name,
    savedReportId: report.id,
    name: report.name,
    description,
    category: report.category,
    dataSourceId: report.dataSourceId,
    isPublished: report.isPublished,
    savedSnapshot: snapshot,
    sql: report.sql,
    visualization: report.visualization,
  })
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

export function isQueryTabDirty(tab: QueryTab): boolean {
  if (!tab.savedSnapshot) return true
  const s = tab.savedSnapshot
  return (
    tab.name !== s.name ||
    tab.description !== s.description ||
    tab.category !== s.category ||
    tab.sql !== s.sql ||
    tab.visualization !== s.visualization ||
    tab.dataSourceId !== s.dataSourceId
  )
}
