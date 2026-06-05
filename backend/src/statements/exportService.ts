import {
  buildReportExportAttachments,
  queryResultToCsv,
  queryResultToPdf,
  sanitizeExportFilename,
  type ReportExportMeta,
} from '../reports/exportFiles.js'
import { statementToExportResult } from './exportData.js'
import { runStatementData } from './runData.js'

export async function buildStatementExportAttachments(
  statementId: string,
  filters: Record<string, string>,
  filterLabel?: string,
) {
  const bundle = await runStatementData(statementId, filters)
  const exportResult = statementToExportResult(
    bundle.type,
    bundle.config,
    bundle.data,
    bundle.headerData,
  )

  const meta: Omit<ReportExportMeta, 'reportName'> = {
    reportDescription: bundle.description,
    filterLabel,
    generatedAt: new Date(),
  }

  return buildReportExportAttachments(exportResult, bundle.name, meta)
}

export async function exportStatementFile(
  statementId: string,
  format: 'pdf' | 'csv',
  filters: Record<string, string>,
  filterLabel?: string,
): Promise<{ filename: string; content: Buffer; contentType: string }> {
  const bundle = await runStatementData(statementId, filters)
  const exportResult = statementToExportResult(
    bundle.type,
    bundle.config,
    bundle.data,
    bundle.headerData,
  )

  const base = sanitizeExportFilename(bundle.name)
  const meta: ReportExportMeta = {
    reportName: bundle.config.headerTitle ?? bundle.name,
    reportDescription: bundle.description ?? bundle.config.headerSubtitle,
    filterLabel,
    generatedAt: new Date(),
  }

  if (format === 'csv') {
    return {
      filename: `${base}.csv`,
      content: Buffer.from(queryResultToCsv(exportResult), 'utf-8'),
      contentType: 'text/csv; charset=utf-8',
    }
  }

  const pdf = await queryResultToPdf(exportResult, meta)
  return {
    filename: `${base}.pdf`,
    content: pdf,
    contentType: 'application/pdf',
  }
}
