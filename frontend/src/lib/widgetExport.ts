import type { QueryExecuteResult } from '../api/reportBuilder'
import { dashboardModuleKey } from './dashboardFilters'
import { reportModuleKey } from './reportFilters'
import { statementModuleKey } from './statementFilters'
import type { ReportVisualization } from './reportConstants'

export type WidgetExportFormat = 'png' | 'csv' | 'pdf' | 'xlsx'

export type WidgetExportContext = {
  dashboardName?: string
  dashboardDescription?: string
  reportDescription?: string
  filterLabel?: string
}

export type WidgetExportPermissions = {
  png: boolean
  csv: boolean
  pdf: boolean
  xlsx: boolean
}

export function isChartVisualization(visualization: ReportVisualization): boolean {
  return visualization !== 'TABLE_ONLY'
}

export function sanitizeExportFilename(name: string): string {
  const cleaned = name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return cleaned || 'export'
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportQueryResultToCsv(result: QueryExecuteResult, filename: string) {
  const lines = [
    result.columns.map(escapeCsvCell).join(','),
    ...result.rows.map((row) =>
      result.columns.map((col) => escapeCsvCell(cellValue(row[col]))).join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

export async function exportQueryResultToXlsx(result: QueryExecuteResult, filename: string) {
  const XLSX = await import('xlsx')
  const rows = result.rows.map((row) => result.columns.map((col) => row[col] ?? ''))
  const worksheet = XLSX.utils.aoa_to_sheet([result.columns, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export type WidgetPdfMeta = WidgetExportContext & {
  reportName: string
}

export async function exportQueryResultToPdf(
  result: QueryExecuteResult,
  filename: string,
  meta: WidgetPdfMeta,
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const autoTable = autoTableModule.default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  const columnCount = result.columns.length
  const tableFontSize =
    columnCount > 14 ? 5 : columnCount > 10 ? 6 : columnCount > 6 ? 7 : 8

  let y = 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(meta.reportName, margin, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const summaryLines: string[] = []
  if (meta.dashboardName) {
    summaryLines.push(`This export is from the "${meta.dashboardName}" dashboard.`)
  }
  if (meta.dashboardDescription?.trim()) {
    summaryLines.push(meta.dashboardDescription.trim())
  }
  if (meta.reportDescription?.trim()) {
    summaryLines.push(meta.reportDescription.trim())
  }
  if (meta.filterLabel) {
    summaryLines.push(`Date range: ${meta.filterLabel}.`)
  }
  summaryLines.push(
    `Generated on ${new Date().toLocaleString()} · ${result.rowCount} row${result.rowCount === 1 ? '' : 's'}${result.truncated ? ` (truncated at ${result.maxRows ?? 500})` : ''}.`,
  )

  for (const line of summaryLines) {
    const wrapped = doc.splitTextToSize(line, contentWidth)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 5 + 2
  }

  autoTable(doc, {
    head: [result.columns],
    body: result.rows.map((row) => result.columns.map((col) => cellValue(row[col]))),
    startY: y + 2,
    margin: { left: margin, right: margin },
    styles: { fontSize: tableFontSize, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [46, 109, 180], textColor: 255, fontSize: tableFontSize },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    horizontalPageBreak: true,
  })

  doc.save(`${filename}.pdf`)
}

export function exportChartToPng(getDataUrl: () => string | null, filename: string) {
  const dataUrl = getDataUrl()
  if (!dataUrl) {
    throw new Error('Chart is not ready for export yet')
  }
  downloadDataUrl(dataUrl, `${filename}.png`)
}

const NO_EXPORT: WidgetExportPermissions = {
  png: false,
  csv: false,
  pdf: false,
  xlsx: false,
}

function toExportPermissions(canPdf: boolean, canCsv: boolean): WidgetExportPermissions {
  return {
    png: canPdf,
    csv: canCsv,
    pdf: canPdf,
    xlsx: canCsv,
  }
}

/** Parent Reports + per-report RolePermission (export_pdf / export_csv). */
export function canExportReport(
  hasPermission: (module: string, action: string) => boolean,
  reportId: string,
): WidgetExportPermissions {
  const canPdf =
    hasPermission('reports', 'export_pdf') &&
    hasPermission(reportModuleKey(reportId), 'export_pdf')
  const canCsv =
    hasPermission('reports', 'export_csv') &&
    hasPermission(reportModuleKey(reportId), 'export_csv')
  return toExportPermissions(canPdf, canCsv)
}

/** Parent Dashboard + per-dashboard RolePermission (export_pdf / export_csv). */
export function canExportDashboard(
  hasPermission: (module: string, action: string) => boolean,
  dashboardId: string,
): WidgetExportPermissions {
  const moduleKey = dashboardModuleKey(dashboardId)
  const canPdf =
    hasPermission('dashboard', 'export_pdf') && hasPermission(moduleKey, 'export_pdf')
  const canCsv =
    hasPermission('dashboard', 'export_csv') && hasPermission(moduleKey, 'export_csv')
  return toExportPermissions(canPdf, canCsv)
}

/** Dashboard widget: requires both dashboard and embedded report export permissions. */
export function buildDashboardWidgetExportPermissions(
  hasPermission: (module: string, action: string) => boolean,
  dashboardId: string | undefined,
  reportId: string,
): WidgetExportPermissions {
  const report = canExportReport(hasPermission, reportId)
  if (!dashboardId) {
    return report
  }

  const dashboard = canExportDashboard(hasPermission, dashboardId)
  return {
    png: dashboard.png && report.png,
    csv: dashboard.csv && report.csv,
    pdf: dashboard.pdf && report.pdf,
    xlsx: dashboard.xlsx && report.xlsx,
  }
}

export function buildReportExportPermissions(
  hasPermission: (module: string, action: string) => boolean,
  reportId: string | undefined,
): WidgetExportPermissions {
  if (!reportId) return NO_EXPORT
  return canExportReport(hasPermission, reportId)
}

/** Report builder preview: module-level export_csv / export_pdf on report-builder. */
export function buildReportBuilderExportPermissions(
  hasPermission: (module: string, action: string) => boolean,
): WidgetExportPermissions {
  const canCsv = hasPermission('report-builder', 'export_csv')
  const canPdf = hasPermission('report-builder', 'export_pdf')
  return toExportPermissions(canPdf, canCsv)
}

/** Parent Statements + per-statement RolePermission (export_pdf / export_csv). */
export function canExportStatement(
  hasPermission: (module: string, action: string) => boolean,
  statementId: string,
): WidgetExportPermissions {
  const moduleKey = statementModuleKey(statementId)
  const canPdf =
    hasPermission('statements', 'export_pdf') &&
    hasPermission(moduleKey, 'export_pdf')
  const canCsv =
    hasPermission('statements', 'export_csv') &&
    hasPermission(moduleKey, 'export_csv')
  return toExportPermissions(canPdf, canCsv)
}

export function buildStatementExportPermissions(
  hasPermission: (module: string, action: string) => boolean,
  statementId: string | undefined,
): WidgetExportPermissions {
  if (!statementId) return NO_EXPORT
  return canExportStatement(hasPermission, statementId)
}

export function assertExportAllowed(
  format: WidgetExportFormat,
  permissions: WidgetExportPermissions,
): void {
  const allowed =
    format === 'png'
      ? permissions.png
      : format === 'csv'
        ? permissions.csv
        : format === 'pdf'
          ? permissions.pdf
          : permissions.xlsx

  if (!allowed) {
    throw new Error('You do not have permission to export in this format')
  }
}

/** @deprecated Use buildDashboardWidgetExportPermissions per widget */
export function buildModuleExportPermissions(
  hasPermission: (module: string, action: string) => boolean,
  moduleKey: string | undefined,
): WidgetExportPermissions {
  if (!moduleKey) return NO_EXPORT

  const canPdf = hasPermission(moduleKey, 'export_pdf')
  const canCsv = hasPermission(moduleKey, 'export_csv')
  return toExportPermissions(canPdf, canCsv)
}

/** @deprecated Use buildDashboardWidgetExportPermissions per widget */
export function buildDashboardExportPermissions(
  hasPermission: (module: string, action: string) => boolean,
  dashboardId: string | undefined,
): WidgetExportPermissions {
  if (!dashboardId) return NO_EXPORT
  return canExportDashboard(hasPermission, dashboardId)
}

export async function runWidgetExport(
  format: WidgetExportFormat,
  permissions: WidgetExportPermissions,
  args: {
    result: QueryExecuteResult
    reportName: string
    exportContext?: WidgetExportContext
    getChartDataUrl?: () => string | null
  },
): Promise<void> {
  assertExportAllowed(format, permissions)

  const filename = sanitizeExportFilename(args.reportName)

  switch (format) {
    case 'png':
      if (!args.getChartDataUrl) {
        throw new Error('Chart export is not available')
      }
      exportChartToPng(args.getChartDataUrl, filename)
      break
    case 'csv':
      exportQueryResultToCsv(args.result, filename)
      break
    case 'xlsx':
      await exportQueryResultToXlsx(args.result, filename)
      break
    case 'pdf':
      await exportQueryResultToPdf(args.result, filename, {
        reportName: args.reportName,
        ...args.exportContext,
      })
      break
  }
}

export function hasAnyExportPermission(permissions: WidgetExportPermissions): boolean {
  return permissions.png || permissions.csv || permissions.pdf || permissions.xlsx
}
