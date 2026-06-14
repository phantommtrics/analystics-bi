import { getSavedReportById } from '../reports/service.js'
import { parseStatementConfig } from '../statements/config.js'
import { buildStatementExportAttachments } from '../statements/exportService.js'
import { getStatementById } from '../statements/service.js'
import { log } from '../utils/logger.js'
import type { ReportFileAttachment } from '../reports/exportFiles.js'
import {
  buildScheduleExecuteFilters,
  formatScheduleFilterLabel,
  scheduleDateRange,
  type ScheduleFilterContext,
} from './reportFilters.js'

export type ScheduledStatementBundle = {
  filterLabel: string
  attachments: ReportFileAttachment[]
}

export async function runScheduledStatement(
  statementId: string,
  ctx: ScheduleFilterContext,
): Promise<ScheduledStatementBundle> {
  const statement = await getStatementById(statementId)
  if (!statement) {
    throw new Error('Statement not found')
  }

  const config = parseStatementConfig(statement.type, statement.config)
  const report = await getSavedReportById(config.dataReportId)
  if (!report) {
    throw new Error('Data report not found')
  }
  if (!report.dataSourceActive) {
    throw new Error('Data source is inactive')
  }

  const filters = buildScheduleExecuteFilters(report.sql, ctx)
  const range = scheduleDateRange(ctx)
  const filterLabel = formatScheduleFilterLabel(range)
  log('statement-schedule', `Running scheduled statement="${statement.name}" id=${statementId}`)
  const attachments = await buildStatementExportAttachments(
    statementId,
    filters,
    filterLabel,
  )

  return { filterLabel, attachments }
}
