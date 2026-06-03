import { executeDataSourceQuery } from '../datasources/service.js'
import type { ExecuteQueryResult } from '../datasources/postgres.js'
import {
  buildReportExportAttachments,
  type ReportFileAttachment,
} from '../reports/exportFiles.js'
import { applySqlFilters } from '../reports/sqlFilters.js'
import { getSavedReportById } from '../reports/service.js'
import {
  buildScheduleExecuteFilters,
  formatScheduleFilterLabel,
  scheduleDateRange,
  type ScheduleFilterContext,
} from './reportFilters.js'

export type ScheduledReportBundle = {
  result: ExecuteQueryResult
  filterLabel: string
  attachments: ReportFileAttachment[]
}

export async function runScheduledReport(
  reportId: string,
  ctx: ScheduleFilterContext,
): Promise<ScheduledReportBundle> {
  const report = await getSavedReportById(reportId)
  if (!report) {
    throw new Error('Report not found')
  }
  if (!report.dataSourceActive) {
    throw new Error('Data source is inactive')
  }

  const filters = buildScheduleExecuteFilters(report.sql, ctx)
  const sql = applySqlFilters(report.sql, filters)
  const result = await executeDataSourceQuery(report.dataSourceId, sql)

  const range = scheduleDateRange(ctx)
  const filterLabel = formatScheduleFilterLabel(range)
  const attachments = await buildReportExportAttachments(result, report.name, {
    reportDescription: report.description,
    filterLabel,
    generatedAt: ctx.scheduledAt,
  })

  return { result, filterLabel, attachments }
}
