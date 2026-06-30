import 'dotenv/config'
import { ReportCategory, ReportVisualization } from '@prisma/client'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'
import { applySqlFilters } from '../src/reports/sqlFilters.ts'
import { publishSavedReport } from '../src/reports/service.ts'
import { DASHBOARD_LAYOUT_BLUEPRINT, DASHBOARD_QUERIES } from './dashboard-queries.ts'

/** Reports that mirror the main dashboard mock layout (see DASHBOARD_LAYOUT_BLUEPRINT). */
export const MAIN_DASHBOARD_REPORT_NAMES = [
  'Dashboard KPI — Total System Float',
  'Dashboard KPI — Transaction Count',
  'Dashboard KPI — Fee Revenue',
  'Dashboard KPI — Agents with Commission Releases',
  'Dashboard Chart — Daily Transaction Trend',
  'Dashboard Chart — Fee Revenue by Stream',
  'Dashboard Table — Top Agents by Commission',
  'Dashboard Chart — System Float by Entity',
] as const

const CATEGORY_MAP: Record<string, ReportCategory> = {
  FINANCIAL: ReportCategory.FINANCIAL,
  OPERATIONAL: ReportCategory.OPERATIONAL,
  AGENT: ReportCategory.AGENT,
  BALANCE: ReportCategory.BALANCE,
}

const VISUALIZATION_MAP: Record<string, ReportVisualization> = {
  BAR_CHART: ReportVisualization.BAR_CHART,
  LINE_CHART: ReportVisualization.LINE_CHART,
  PIE_CHART: ReportVisualization.PIE_CHART,
  TABLE_ONLY: ReportVisualization.TABLE_ONLY,
}

function stripOptionalBlocks(sql: string): string {
  return sql.replace(/\[\[[\s\S]*?\]\]/g, '')
}

function resolveQueries(mainOnly: boolean) {
  if (!mainOnly) return DASHBOARD_QUERIES
  const names = new Set<string>(MAIN_DASHBOARD_REPORT_NAMES)
  return DASHBOARD_QUERIES.filter((q) => names.has(q.name))
}

async function validateQueries(
  dataSourceId: string,
  dateFilters: Record<string, string>,
  mainOnly: boolean,
) {
  const queries = resolveQueries(mainOnly)
  console.log(`Validating ${queries.length} dashboard report(s)…`)

  for (const query of queries) {
    const t0 = Date.now()
    const cleaned = applySqlFilters(stripOptionalBlocks(query.sql), dateFilters)
    const result = await executeDataSourceQuery(dataSourceId, cleaned)
    console.log(
      `  ✓ ${query.name} (${Date.now() - t0}ms, ${result.rows.length} row(s))`,
    )
  }
}

async function seedDashboardReports(dataSourceId: string, organizationId: string, mainOnly: boolean) {
  const owner = await prisma.user.findFirst({
    where: { userType: 'OWNER' },
    select: { id: true },
  })

  const queries = resolveQueries(mainOnly)
  console.log(`Seeding ${queries.length} dashboard report(s)…`)

  for (const query of queries) {
    const category = CATEGORY_MAP[query.category] ?? ReportCategory.GENERAL
    const visualization =
      VISUALIZATION_MAP[query.visualization] ?? ReportVisualization.TABLE_ONLY

    const existing = await prisma.savedReport.findFirst({
      where: { name: query.name, deletedAt: null },
      select: { id: true, isPublished: true },
    })

    if (existing) {
      await prisma.savedReport.update({
        where: { id: existing.id },
        data: {
          description: query.description,
          category,
          visualization,
          sql: query.sql,
          dataSourceId,
          updatedById: owner?.id,
        },
      })
      console.log(`  Updated: ${query.name}`)
      if (!existing.isPublished) {
        await publishSavedReport(existing.id, owner?.id)
        console.log(`  Published: ${query.name}`)
      }
      continue
    }

    const created = await prisma.savedReport.create({
      data: {
        name: query.name,
        description: query.description,
        category,
        visualization,
        sql: query.sql,
        dataSourceId,
        organizationId,
        createdById: owner?.id,
        updatedById: owner?.id,
      },
    })
    await publishSavedReport(created.id, owner?.id)
    console.log(`  Created and published: ${query.name}`)
  }
}

async function run() {
  const mainOnly = !process.argv.includes('--all')
  const validate = process.argv.includes('--validate') || process.argv.includes('--seed')
  const seed = process.argv.includes('--seed')

  const ds = await prisma.dataSource.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, organizationId: true },
  })
  if (!ds) {
    throw new Error('No active data source found. Configure a data source in System Config first.')
  }

  const dateFilters = {
    dateFrom: process.env.DASHBOARD_SEED_DATE_FROM ?? '2026-05-01',
    dateTo: process.env.DASHBOARD_SEED_DATE_TO ?? '2026-05-31',
  }

  console.log(`Data source: ${ds.name}`)
  console.log(`Date range: ${dateFilters.dateFrom} → ${dateFilters.dateTo}`)
  if (mainOnly) {
    console.log('\nMain dashboard layout reference:\n')
    console.log(DASHBOARD_LAYOUT_BLUEPRINT)
    console.log('')
  }

  if (validate) {
    await validateQueries(ds.id, dateFilters, mainOnly)
  }

  if (seed) {
    await seedDashboardReports(ds.id, ds.organizationId, mainOnly)
    console.log('\nDone. Open Dashboard Builder and drag these reports from the library.')
    if (mainOnly) {
      console.log('\nSuggested layout:')
      console.log('  Row 1: 4 KPI cards (bind valueColumn from each KPI report)')
      console.log('  Row 2: Daily Transaction Trend (bar/line) + Fee Revenue by Stream (pie)')
      console.log('  Row 3: Top Agents by Commission (table) + System Float by Entity (pie)')
    }
  } else if (!validate) {
    console.log('\nUsage:')
    console.log('  npx tsx scripts/seed-dashboard-reports.ts --validate   # test SQL only')
    console.log('  npx tsx scripts/seed-dashboard-reports.ts --seed       # seed main dashboard reports')
    console.log('  npx tsx scripts/seed-dashboard-reports.ts --seed --all # seed all dashboard queries')
  }

  await prisma.$disconnect()
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  run().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
