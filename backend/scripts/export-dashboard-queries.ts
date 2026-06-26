import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DASHBOARD_LAYOUT_BLUEPRINT,
  DASHBOARD_QUERIES,
  EXCLUDED_DETAIL_REPORTS,
} from './dashboard-queries.ts'
import { EMONEY_POUCH_NAME } from './report-sql-constants.ts'

function formatQueryBlock(query: (typeof DASHBOARD_QUERIES)[number], index: number): string {
  const lines = [
    `${'='.repeat(80)}`,
    `QUERY ${index + 1}: ${query.name}`,
    `Based on: ${query.basedOn}`,
    `Description: ${query.description}`,
    `Widget: ${query.widgetKind}`,
    `Suggested visualization: ${query.visualization}`,
    `Category: ${query.category}`,
    `Layout: ${query.layoutHint}`,
  ]

  if (query.labelColumn) {
    lines.push(`Chart label column: ${query.labelColumn}`)
  }
  if (query.valueColumns?.length) {
    lines.push(`Chart value columns: ${query.valueColumns.join(', ')}`)
  }
  if (query.kpiColumn) {
    lines.push(`KPI valueColumn: ${query.kpiColumn}${query.kpiLabel ? ` (${query.kpiLabel})` : ''}`)
  }
  if (query.maxRows) {
    lines.push(`Max rows (dashboard table): ${query.maxRows}`)
  }
  if (query.drilldownReport) {
    lines.push(`Drilldown report (not on dashboard): ${query.drilldownReport}`)
  }

  lines.push('', 'SQL:', query.sql, '')
  return lines.join('\n')
}

function run() {
  const outputPath = resolve(process.cwd(), 'dashboard-query.txt')

  const excludedBlock = EXCLUDED_DETAIL_REPORTS.map(
    (r) => `- ${r.name}\n  ${r.reason}`,
  ).join('\n')

  const header = [
    'BI Reports — Dashboard Query Export',
    `Generated: ${new Date().toISOString()}`,
    '',
    'PURPOSE',
    'Summarized SQL for dashboard widgets (KPI cards, charts, compact tables).',
    'Derived from recovered summary reports in backend/recovered-reports.txt.',
    'Detail / line-level reports are excluded — use those in Report Catalog for drilldown.',
    '',
    'DASHBOARD BUILDER RULES',
    '- KPI widget: bind savedReportId + valueColumn (+ rowIndex 0) from a query returning one numeric cell.',
    '- Bar / line chart: first result column = category label; remaining columns = numeric series.',
    '- Pie chart: first column = slice name; first numeric column = slice value.',
    '- Table widget: aggregated rows only; SQL should use LIMIT (≤15 rows fit the compact canvas).',
    '- Do not attach detail reports (transaction lines, user balances, statements) as chart widgets.',
    `- Transaction volume and count metrics scope to the "${EMONEY_POUCH_NAME}" pouch only.`,
    '',
    'MAIN DASHBOARD LAYOUT REFERENCE',
    DASHBOARD_LAYOUT_BLUEPRINT,
    '',
    `EXCLUDED REPORTS (${EXCLUDED_DETAIL_REPORTS.length} — drilldown / detail only)`,
    excludedBlock,
    '',
    `DASHBOARD QUERIES (${DASHBOARD_QUERIES.length} — ready for Dashboard Builder)`,
    '',
  ].join('\n')

  const body = DASHBOARD_QUERIES.map((query, index) => formatQueryBlock(query, index)).join('\n')
  writeFileSync(outputPath, `${header}${body}`, 'utf8')

  console.log(`Wrote ${DASHBOARD_QUERIES.length} dashboard queries to ${outputPath}`)
  console.log(`Excluded ${EXCLUDED_DETAIL_REPORTS.length} detail reports (drilldown only)`)
}

run()
