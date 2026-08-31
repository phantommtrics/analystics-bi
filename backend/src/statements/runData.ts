import { StatementType } from '@prisma/client'
import { executeDataSourceQuery } from '../datasources/service.js'
import { REPORT_MAX_ROWS, type ExecuteQueryResult } from '../datasources/postgres.js'
import { applySqlFilters } from '../reports/sqlFilters.js'
import { getSavedReportById } from '../reports/service.js'
import { parseStatementConfig } from './config.js'
import { getStatementById } from './service.js'

export type StatementDataBundle = {
  type: StatementType
  name: string
  description: string | null
  config: ReturnType<typeof parseStatementConfig>
  data: ExecuteQueryResult
  headerData: ExecuteQueryResult | null
}

async function executeReport(
  reportId: string,
  filters: Record<string, string>,
): Promise<ExecuteQueryResult> {
  const report = await getSavedReportById(reportId)
  if (!report) {
    throw new Error('Report not found')
  }
  if (!report.dataSourceActive) {
    throw new Error('Data source is inactive')
  }
  const sql = applySqlFilters(report.sql, filters)
  return executeDataSourceQuery(report.dataSourceId, sql, REPORT_MAX_ROWS)
}

export async function runStatementData(
  statementId: string,
  filters: Record<string, string> = {},
): Promise<StatementDataBundle> {
  const statement = await getStatementById(statementId)
  if (!statement) {
    throw new Error('Statement not found')
  }

  const config = parseStatementConfig(statement.type, statement.config)
  const data = await executeReport(config.dataReportId, filters)

  let headerData: ExecuteQueryResult | null = null
  if (config.headerReportId) {
    headerData = await executeReport(config.headerReportId, filters)
  }

  return {
    type: statement.type,
    name: statement.name,
    description: statement.description,
    config,
    data,
    headerData,
  }
}
