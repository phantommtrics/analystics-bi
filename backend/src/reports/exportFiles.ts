import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { ExecuteQueryResult } from '../datasources/postgres.js'

export type ReportExportMeta = {
  reportName: string
  reportDescription?: string | null
  filterLabel?: string
  generatedAt?: Date
}

export function sanitizeExportFilename(name: string): string {
  const cleaned = name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return cleaned || 'export'
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

export function queryResultToCsv(result: ExecuteQueryResult): string {
  const lines = [
    result.columns.map(escapeCsvCell).join(','),
    ...result.rows.map((row) =>
      result.columns.map((col) => escapeCsvCell(cellValue(row[col]))).join(','),
    ),
  ]
  return lines.join('\n')
}

export async function queryResultToPdf(
  result: ExecuteQueryResult,
  meta: ReportExportMeta,
): Promise<Buffer> {
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
  if (meta.reportDescription?.trim()) {
    summaryLines.push(meta.reportDescription.trim())
  }
  if (meta.filterLabel) {
    summaryLines.push(`Date range: ${meta.filterLabel}.`)
  }
  const generatedAt = meta.generatedAt ?? new Date()
  summaryLines.push(
    `Generated on ${generatedAt.toLocaleString('en-GB')} · ${result.rowCount} row${result.rowCount === 1 ? '' : 's'}${result.truncated ? ` (truncated at ${result.maxRows})` : ''}.`,
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

  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

export type ReportFileAttachment = {
  filename: string
  content: Buffer
}

export async function buildReportExportAttachments(
  result: ExecuteQueryResult,
  reportName: string,
  meta: Omit<ReportExportMeta, 'reportName'>,
): Promise<ReportFileAttachment[]> {
  const base = sanitizeExportFilename(reportName)
  const exportMeta: ReportExportMeta = { reportName, ...meta }
  const [csv, pdf] = await Promise.all([
    Promise.resolve(queryResultToCsv(result)),
    queryResultToPdf(result, exportMeta),
  ])
  return [
    { filename: `${base}.csv`, content: Buffer.from(csv, 'utf-8') },
    { filename: `${base}.pdf`, content: pdf },
  ]
}
