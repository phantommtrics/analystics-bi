import 'dotenv/config'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'
import { applySqlFilters } from '../src/reports/sqlFilters.ts'
import { ENTITY_BALANCE_SUMMARY, USER_BALANCE_DETAIL_AS_AT, PERIOD_BALANCE_CTES } from './validate-balance-reports.ts'

function stripOptionalBlocks(sql: string): string {
  return sql.replace(/\[\[[\s\S]*?\]\]/g, '')
}

async function run() {
  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) throw new Error('No datasource')

  const dateFilters = { dateFrom: '2026-05-01', dateTo: '2026-05-31' }
  const summarySql = applySqlFilters(stripOptionalBlocks(ENTITY_BALANCE_SUMMARY), dateFilters)

  const cutoffMatch = summarySql.match(
    /latest_balances_current[\s\S]*?created_at < CAST\(([^)]+)\)[\s\S]*?latest_balances_previous[\s\S]*?created_at < CAST\(([^)]+)\)/,
  )
  console.log('Substituted cutoffs:')
  console.log('  current:  created_at <', cutoffMatch?.[1])
  console.log('  previous: created_at <', cutoffMatch?.[2])

  const summary = await executeDataSourceQuery(ds.id, summarySql)
  let same = 0
  let diff = 0
  for (const row of summary.rows) {
    const prev = Number(row.total_previous_balance)
    const cur = Number(row.total_current_balance)
    if (prev === cur) same++
    else diff++
  }
  console.log('\nSummary groups: same prev/current =', same, ', different =', diff)
  const changed = summary.rows.filter(
    (r) => Number(r.total_previous_balance) !== Number(r.total_current_balance),
  )
  console.log('Sample groups with change:', changed.slice(0, 3))

  const detailSql = applySqlFilters(stripOptionalBlocks(USER_BALANCE_DETAIL_AS_AT), dateFilters)
  const stats = await executeDataSourceQuery(
    ds.id,
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE previous_balance = current_balance)::int AS same,
      COUNT(*) FILTER (WHERE previous_balance <> current_balance)::int AS different,
      COUNT(*) FILTER (WHERE previous_balance_as_of IS DISTINCT FROM current_balance_as_of)::int AS different_as_of
    FROM (${detailSql}) q`,
  )
  console.log('\nDetail row stats:', stats.rows[0])

  const sample = await executeDataSourceQuery(
    ds.id,
    `SELECT mobile, entity_name, pouch_name, previous_balance, current_balance, balance_change,
            previous_balance_as_of, current_balance_as_of
     FROM (${detailSql}) q
     WHERE previous_balance <> current_balance
     LIMIT 5`,
  )
  console.log('\nSample rows where balances differ:')
  console.log(JSON.stringify(sample.rows, null, 2))

  // Probe: users with txns strictly between the two cutoffs
  const between = await executeDataSourceQuery(
    ds.id,
    `SELECT COUNT(DISTINCT (user_identifier, entity_id, pouch_id))::int AS combos
     FROM transactions
     WHERE deleted_at IS NULL
       AND after_balance IS NOT NULL
       AND user_identifier IS NOT NULL
       AND created_at >= CAST('2026-05-01' AS timestamp)
       AND created_at < CAST('2026-06-01' AS timestamp)`,
  )
  console.log('\nUser/entity/pouch combos with txns in May 2026:', between.rows[0])

  // Same-day range: previous and current cutoffs collapse?
  for (const range of [
    { dateFrom: '2026-06-06', dateTo: '2026-06-06', label: 'same day Jun 6' },
    { dateFrom: '2026-05-01', dateTo: '2026-05-01', label: 'same day May 1' },
  ]) {
    const sql = applySqlFilters(stripOptionalBlocks(ENTITY_BALANCE_SUMMARY), range)
    const cut = sql.match(
      /latest_balances_current[\s\S]*?created_at < CAST\(([^)]+)\)[\s\S]*?latest_balances_previous[\s\S]*?created_at < CAST\(([^)]+)\)/,
    )
    const stats = await executeDataSourceQuery(
      ds.id,
      `SELECT COUNT(*) FILTER (WHERE total_previous_balance = total_current_balance)::int AS same_groups,
              COUNT(*) FILTER (WHERE total_previous_balance <> total_current_balance)::int AS diff_groups
       FROM (${sql}) q`,
    )
    console.log(`\n${range.label} cutoffs: current=${cut?.[1]}, previous=${cut?.[2]}`)
    console.log('  summary groups:', stats.rows[0])
  }

  // Wrong pattern: :dateTo instead of :dateToExclusive for current
  const wrongCtes = PERIOD_BALANCE_CTES.replace(
    'CAST(:dateToExclusive AS timestamp)',
    'CAST(:dateTo AS timestamp)',
  )
  const wrongSummary = applySqlFilters(
    stripOptionalBlocks(ENTITY_BALANCE_SUMMARY).replace(PERIOD_BALANCE_CTES, wrongCtes),
    { dateFrom: '2026-06-06', dateTo: '2026-06-06' },
  )
  const wrongCut = wrongSummary.match(
    /latest_balances_current[\s\S]*?created_at < CAST\(([^)]+)\)[\s\S]*?latest_balances_previous[\s\S]*?created_at < CAST\(([^)]+)\)/,
  )
  console.log('\nSame day + :dateTo for current cutoffs:', wrongCut?.[1], wrongCut?.[2])

  for (const range of [
    { dateFrom: '2026-06-01', dateTo: '2026-06-06', label: 'Jun 1-6 (this month to today)' },
  ]) {
    const sql = applySqlFilters(stripOptionalBlocks(ENTITY_BALANCE_SUMMARY), range)
    const stats = await executeDataSourceQuery(
      ds.id,
      `SELECT COUNT(*) FILTER (WHERE total_previous_balance = total_current_balance)::int AS same,
              COUNT(*) FILTER (WHERE total_previous_balance <> total_current_balance)::int AS diff
       FROM (${sql}) q`,
    )
    console.log(`\n${range.label}:`, stats.rows[0])
  }

  const juneTxns = await executeDataSourceQuery(
    ds.id,
    `SELECT COUNT(*)::int AS cnt FROM transactions
     WHERE deleted_at IS NULL AND created_at >= '2026-06-01' AND created_at < '2026-06-07'`,
  )
  console.log('Transactions in Jun 1-6 2026:', juneTxns.rows[0])

  await prisma.$disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
