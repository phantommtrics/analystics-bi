import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  ENTITY_BALANCE_SUMMARY,
  USER_BALANCE_DETAIL_AS_AT,
} from './validate-balance-reports.ts'
import {
  DAILY_COMMISSION_DETAIL,
  DAILY_COMMISSION_ROLLUP,
  DAILY_COMMISSION_USER,
  MONTHLY_COMMISSION_DETAIL,
  MONTHLY_COMMISSION_ROLLUP,
  MONTHLY_COMMISSION_USER,
} from './validate-commission-reports.ts'
import {
  HIERARCHY_PRODUCT_ROLLUP_PERIOD_COMPARISON,
} from './validate-hierarchy-rollup-reports.ts'
import {
  INACTIVE_ENTITY_USERS_PERIOD_COMPARISON,
  PRODUCT_ENTITY_PERIOD_COMPARISON,
  PRODUCT_HIERARCHY_PERIOD_COMPARISON,
  PRODUCT_SUMMARY_PERIOD_COMPARISON,
} from './validate-product-analysis-reports.ts'
import {
  REVENUE_DETAIL,
  REVENUE_SUMMARY,
  REVENUE_SUMMARY_PERIOD_COMPARISON,
} from './validate-revenue-reports.ts'
import {
  TRANSACTION_DETAIL_BY_ENTITY_PRODUCT,
  TRANSACTION_DETAIL_BY_PRODUCT,
  TRANSACTION_SUMMARY,
} from './validate-transaction-reports.ts'
import { BANK_STATEMENT_ANY_ENTITY } from './validate-bank-statement-reports.ts'

const prisma = new PrismaClient()

type ReportExport = {
  name: string
  source: string
  description?: string
  sql: string
}

const SCRIPT_REPORTS: ReportExport[] = [
  {
    name: '[Revenue] - Summary by stream',
    source: 'validate-revenue-reports.ts',
    description: 'Wallet revenue by stream with recorded and calculated fees.',
    sql: REVENUE_SUMMARY.trim(),
  },
  {
    name: '[Revenue] - Summary by stream — period comparison',
    source: 'validate-revenue-reports.ts',
    description: 'Revenue streams with previous vs current period comparison.',
    sql: REVENUE_SUMMARY_PERIOD_COMPARISON.trim(),
  },
  {
    name: '[Revenue] - Transaction detail',
    source: 'validate-revenue-reports.ts',
    description: 'Line-level wallet revenue with calculation method.',
    sql: REVENUE_DETAIL.trim(),
  },
  {
    name: '[Transaction] - Summary by scope',
    source: 'validate-transaction-reports.ts',
    sql: TRANSACTION_SUMMARY.trim(),
  },
  {
    name: '[Transaction] - Detail by product',
    source: 'validate-transaction-reports.ts',
    sql: TRANSACTION_DETAIL_BY_PRODUCT.trim(),
  },
  {
    name: '[Transaction] - Detail by entity and product',
    source: 'validate-transaction-reports.ts',
    sql: TRANSACTION_DETAIL_BY_ENTITY_PRODUCT.trim(),
  },
  {
    name: '[Product] - Summary by product — period comparison',
    source: 'validate-product-analysis-reports.ts',
    sql: PRODUCT_SUMMARY_PERIOD_COMPARISON.trim(),
  },
  {
    name: '[Product] - Summary by entity — period comparison',
    source: 'validate-product-analysis-reports.ts',
    sql: PRODUCT_ENTITY_PERIOD_COMPARISON.trim(),
  },
  {
    name: '[Product] - Summary by hierarchy — period comparison',
    source: 'validate-product-analysis-reports.ts',
    sql: PRODUCT_HIERARCHY_PERIOD_COMPARISON.trim(),
  },
  {
    name: '[Product] - Inactive entity users — period comparison',
    source: 'validate-product-analysis-reports.ts',
    sql: INACTIVE_ENTITY_USERS_PERIOD_COMPARISON.trim(),
  },
  {
    name: '[Hierarchy] - Products by hierarchy — period comparison',
    source: 'validate-hierarchy-rollup-reports.ts',
    description:
      'Full product list organized by business hierarchy with txn count, volume, and revenue for current vs previous period.',
    sql: HIERARCHY_PRODUCT_ROLLUP_PERIOD_COMPARISON.trim(),
  },
  {
    name: 'Entity Balance Summary',
    source: 'validate-balance-reports.ts',
    sql: ENTITY_BALANCE_SUMMARY.trim(),
  },
  {
    name: 'User Balance Detail As At',
    source: 'validate-balance-reports.ts',
    sql: USER_BALANCE_DETAIL_AS_AT.trim(),
  },
  {
    name: 'Monthly Commission — by user',
    source: 'validate-commission-reports.ts',
    sql: MONTHLY_COMMISSION_USER.trim(),
  },
  {
    name: 'Monthly Commission — rollup',
    source: 'validate-commission-reports.ts',
    sql: MONTHLY_COMMISSION_ROLLUP.trim(),
  },
  {
    name: 'Daily Commission — by user',
    source: 'validate-commission-reports.ts',
    sql: DAILY_COMMISSION_USER.trim(),
  },
  {
    name: 'Daily Commission — rollup',
    source: 'validate-commission-reports.ts',
    sql: DAILY_COMMISSION_ROLLUP.trim(),
  },
  {
    name: 'Monthly Commission — detail',
    source: 'validate-commission-reports.ts',
    sql: MONTHLY_COMMISSION_DETAIL.trim(),
  },
  {
    name: 'Daily Commission — detail',
    source: 'validate-commission-reports.ts',
    sql: DAILY_COMMISSION_DETAIL.trim(),
  },
  {
    name: 'Bank Statement — Any Entity (Dual Leg, DR / CR columns)',
    source: 'validate-bank-statement-reports.ts',
    description:
      'Account statement with DR/CR columns. Mobile filter scopes transactions but output legs are restricted to the filtered account so balances stay on the correct ledger.',
    sql: BANK_STATEMENT_ANY_ENTITY.trim(),
  },
]

function formatReportBlock(report: ReportExport, index: number): string {
  const lines = [
    `${'='.repeat(80)}`,
    `REPORT ${index + 1}: ${report.name}`,
    `Source: ${report.source}`,
  ]
  if (report.description) {
    lines.push(`Description: ${report.description}`)
  }
  lines.push('', 'SQL:', report.sql, '')
  return lines.join('\n')
}

async function collectAuditReportIds(): Promise<string[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: 'CREATE_REPORT' },
        { action: 'UPDATE_REPORT' },
        { action: 'PUBLISH_REPORT' },
        { action: 'RUN_REPORT' },
        { action: 'DELETE_REPORT' },
      ],
    },
    select: { action: true, resource: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const seen = new Set<string>()
  const ordered: string[] = []
  for (const log of logs) {
    const match = log.resource?.match(/Report: ([a-z0-9]+)/i)
    if (!match || seen.has(match[1])) continue
    seen.add(match[1])
    ordered.push(match[1])
  }
  return ordered
}

async function run() {
  const outputPath = resolve(process.cwd(), 'recovered-reports.txt')
  const reportIds = await collectAuditReportIds()
  const reportCount = await prisma.savedReport.count()

  const header = [
    'BI Reports — Recovered Report SQL Export',
    `Generated: ${new Date().toISOString()}`,
    '',
    'INCIDENT SUMMARY',
    '- SavedReport rows in database now: ' + reportCount,
    '- Unique report IDs found in audit logs: ' + reportIds.length,
    '- SQL recovered from validation scripts: ' + SCRIPT_REPORTS.length,
    '',
    'ROOT CAUSE',
    'Migration 20260613140000_remove_default_org deleted Organization "default-org".',
    'SavedReport, DataSource, Dashboard, and Statement rows were CASCADE-deleted because',
    'they referenced that organization. Audit logs record report IDs and actions but not SQL.',
    '',
    'RECOVERY NOTES',
    '- The SQL below comes from backend/scripts/validate-*.ts (known report definitions).',
    '- Up to ' +
      (reportIds.length - SCRIPT_REPORTS.length) +
      ' additional custom reports existed in the app but their SQL was not logged.',
    '- To fully restore, re-create the data source, assign users to the organization,',
    '  then re-seed with: npx tsx scripts/validate-*-reports.ts --seed (where supported).',
    '',
    'LOST REPORT IDS (from audit log, SQL not recoverable from DB)',
    ...reportIds.map((id) => `- ${id}`),
    '',
  ].join('\n')

  const body = SCRIPT_REPORTS.map((report, index) => formatReportBlock(report, index)).join('\n')
  const content = `${header}\n${body}`
  writeFileSync(outputPath, content, 'utf8')

  console.log(`Wrote ${SCRIPT_REPORTS.length} reports to ${outputPath}`)
  console.log(`Database SavedReport count: ${reportCount}`)
  console.log(`Audit log report IDs: ${reportIds.length}`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
