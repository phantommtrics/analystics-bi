import 'dotenv/config'
import { ReportCategory, ReportVisualization } from '@prisma/client'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'
import { applySqlFilters } from '../src/reports/sqlFilters.ts'
import { publishSavedReport } from '../src/reports/service.ts'

const SHARED_DIM_CTES = `
entities_deduped AS (
  SELECT DISTINCT ON (e.id) e.id, e.name
  FROM entities e
  WHERE e.deleted_at IS NULL
  ORDER BY e.id
),
services_deduped AS (
  SELECT DISTINCT ON (s.id) s.id, s.name, s.display_name, s.service_type
  FROM services s
  WHERE s.deleted_at IS NULL
  ORDER BY s.id
),
products_deduped AS (
  SELECT DISTINCT ON (p.id) p.id, p.name, p.display_name
  FROM products p
  WHERE p.deleted_at IS NULL
  ORDER BY p.id
),
global_fees_entity AS (
  SELECT id FROM entities_deduped WHERE name = 'Global Fees Income' LIMIT 1
)`

const PERIOD_BOUNDS_SINGLE = `
period_bounds AS (
  SELECT
    CAST(:dateFrom AS date) AS period_start,
    CAST(:dateTo AS date) AS period_end
)`

const PERIOD_BOUNDS_COMPARISON = `
period_bounds AS (
  SELECT
    CAST(:dateFrom AS date) AS period_start,
    CAST(:dateTo AS date) AS period_end,
    (
      CAST(:dateFrom AS date)
      - ((CAST(:dateTo AS date) - CAST(:dateFrom AS date)) + 1) * interval '1 day'
    )::date AS previous_period_start,
    (CAST(:dateFrom AS date) - interval '1 day')::date AS previous_period_end
)`

function intouchMoovRecordedProductsCte(
  suffix: string,
  startExpr: string,
  endExclusiveExpr: string,
): string {
  return `
intouch_moov_recorded_products${suffix} AS (
  SELECT DISTINCT TRIM(
    regexp_replace(t.remarks, '^You have received (.+) FEE of .*', '\\1')
  ) AS product_name
  FROM transactions t
  CROSS JOIN global_fees_entity gfe
  WHERE t.deleted_at IS NULL
    AND t.entity_id = gfe.id
    AND t.status = 'SUCCESS'
    AND t.transaction_type = 'CR'
    AND t.remarks ILIKE 'You have received%FEE of%'
    AND (
      t.remarks ILIKE '%INTOUCH%'
      OR t.remarks ILIKE '%Moov%'
      OR t.remarks ILIKE '%MOOV%'
    )
    AND t.created_at >= ${startExpr}
    AND t.created_at < ${endExclusiveExpr}
)`
}

function recordedFeeLinesCte(suffix: string, startExpr: string, endExclusiveExpr: string): string {
  return `
recorded_fee_lines${suffix} AS (
  SELECT
    CASE
      WHEN t.remarks ILIKE '%Internal Wallet Transfer FEE%' THEN 'Internal Wallet Transfer Fee'
      WHEN t.remarks ILIKE '%International Remittance COMMISSION%' THEN 'International Remittance Commission'
      WHEN t.remarks ILIKE '%BANK_TO_WALLET_TRANSFER FEE%' THEN 'Bank to Wallet Fee'
      WHEN t.remarks ILIKE '%WALLET_TO_BANK_TRANSFER FEE%' THEN 'Wallet to Bank Fee'
      WHEN t.remarks ILIKE '%INTOUCH%FEE%'
        OR t.remarks ILIKE '%Moov%FEE%'
        OR t.remarks ILIKE '%MOOV%FEE%'
        THEN TRIM(regexp_replace(t.remarks, '^You have received (.+) FEE of .*', '\\1')) || ' Fee'
      WHEN t.remarks ~* '^You have received .+ FEE of '
        THEN TRIM(regexp_replace(t.remarks, '^You have received (.+) FEE of .*', '\\1')) || ' Fee'
    END AS revenue_category,
    'recorded'::text AS calculation_method,
    NULL::numeric AS rate_pct,
    t.id AS transaction_row_id,
    t.transaction_id,
    t.created_at::date AS transaction_date,
    t.created_at AS transaction_timestamp,
    COALESCE(s.display_name, s.name) AS service_name,
    COALESCE(p.display_name, p.name) AS product_name,
    t.transaction_amount::numeric AS transaction_volume,
    t.transaction_amount::numeric AS revenue_amount,
    t.remarks
  FROM transactions t
  CROSS JOIN global_fees_entity gfe
  LEFT JOIN services_deduped s ON s.id = t.service_id
  LEFT JOIN products_deduped p ON p.id = t.product_id
  WHERE t.deleted_at IS NULL
    AND t.entity_id = gfe.id
    AND t.status = 'SUCCESS'
    AND t.transaction_type = 'CR'
    AND t.remarks ILIKE 'You have received%'
    AND (
      t.remarks ILIKE '%Internal Wallet Transfer FEE%'
      OR t.remarks ILIKE '%International Remittance COMMISSION%'
      OR t.remarks ILIKE '%BANK_TO_WALLET_TRANSFER FEE%'
      OR t.remarks ILIKE '%WALLET_TO_BANK_TRANSFER FEE%'
      OR t.remarks ILIKE '%INTOUCH%FEE%'
      OR t.remarks ILIKE '%Moov%FEE%'
      OR t.remarks ILIKE '%MOOV%FEE%'
      OR t.remarks ~* '^You have received .+ FEE of '
    )
    AND t.created_at >= ${startExpr}
    AND t.created_at < ${endExclusiveExpr}
)`
}

function calculatedFeeLinesCte(
  suffix: string,
  startExpr: string,
  endExclusiveExpr: string,
  intouchProductsCte: string,
): string {
  return `
calculated_fee_lines${suffix} AS (
  SELECT
    CASE
      WHEN p.name = 'Disbursement' THEN 'Disbursement (0.9%)'
      WHEN s.name = 'Airtime Topup' THEN 'Airtime (5%)'
      WHEN p.name ILIKE '%intouch%' OR p.name ILIKE '%moov%' THEN p.name || ' (1%)'
      WHEN p.name = 'APS PAY' THEN 'APS PAY (0.8%)'
    END AS revenue_category,
    'calculated'::text AS calculation_method,
    CASE
      WHEN p.name = 'Disbursement' THEN 0.9
      WHEN s.name = 'Airtime Topup' THEN 5.0
      WHEN p.name ILIKE '%intouch%' OR p.name ILIKE '%moov%' THEN 1.0
      WHEN p.name = 'APS PAY' THEN 0.8
    END AS rate_pct,
    t.id AS transaction_row_id,
    t.transaction_id,
    t.created_at::date AS transaction_date,
    t.created_at AS transaction_timestamp,
    COALESCE(s.display_name, s.name) AS service_name,
    COALESCE(p.display_name, p.name) AS product_name,
    t.transaction_amount::numeric AS transaction_volume,
    ROUND(
      t.transaction_amount::numeric * CASE
        WHEN p.name = 'Disbursement' THEN 0.009
        WHEN s.name = 'Airtime Topup' THEN 0.05
        WHEN p.name ILIKE '%intouch%' OR p.name ILIKE '%moov%' THEN 0.01
        WHEN p.name = 'APS PAY' THEN 0.008
      END,
      2
    ) AS revenue_amount,
    t.remarks
  FROM transactions t
  JOIN products_deduped p ON p.id = t.product_id
  LEFT JOIN services_deduped s ON s.id = t.service_id
  WHERE t.deleted_at IS NULL
    AND t.status = 'SUCCESS'
    AND t.transaction_type = 'DR'
    AND (
      p.name = 'Disbursement'
      OR s.name = 'Airtime Topup'
      OR p.name ILIKE '%intouch%'
      OR p.name ILIKE '%moov%'
      OR p.name = 'APS PAY'
    )
    AND NOT (
      (p.name ILIKE '%intouch%' OR p.name ILIKE '%moov%')
      AND EXISTS (
        SELECT 1
        FROM ${intouchProductsCte} rp
        WHERE rp.product_name = p.name
      )
    )
    AND t.created_at >= ${startExpr}
    AND t.created_at < ${endExclusiveExpr}
)`
}

function revenueLinesCte(suffix: string): string {
  return `
revenue_lines${suffix} AS (
  SELECT * FROM recorded_fee_lines${suffix}
  UNION ALL
  SELECT * FROM calculated_fee_lines${suffix}
)`
}

function buildRevenuePeriodCtes(
  suffix: '' | '_current' | '_previous',
  startExpr: string,
  endExclusiveExpr: string,
): string {
  const intouchCte = `intouch_moov_recorded_products${suffix}`
  return [
    intouchMoovRecordedProductsCte(suffix, startExpr, endExclusiveExpr),
    recordedFeeLinesCte(suffix, startExpr, endExclusiveExpr),
    calculatedFeeLinesCte(suffix, startExpr, endExclusiveExpr, intouchCte),
    revenueLinesCte(suffix),
  ].join(',\n')
}

const REVENUE_LINE_CTES_SINGLE = buildRevenuePeriodCtes(
  '',
  'CAST(:dateFrom AS timestamp)',
  'CAST(:dateToExclusive AS timestamp)',
)

const REVENUE_LINE_CTES_COMPARISON = [
  buildRevenuePeriodCtes(
    '_current',
    'CAST(:dateFrom AS timestamp)',
    'CAST(:dateToExclusive AS timestamp)',
  ),
  buildRevenuePeriodCtes(
    '_previous',
    '(SELECT previous_period_start FROM period_bounds)::timestamp',
    'CAST(:dateFrom AS timestamp)',
  ),
].join(',\n')

/** Summary by revenue stream — recorded fees plus manually calculated percentages. */
export const REVENUE_SUMMARY = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS_SINGLE},
${REVENUE_LINE_CTES_SINGLE},
stream_summary AS (
  SELECT
    rl.revenue_category,
    rl.calculation_method,
    rl.rate_pct,
    COUNT(*)::int AS txn_count,
    SUM(rl.transaction_volume) AS transaction_volume,
    SUM(rl.revenue_amount) AS revenue_amount
  FROM revenue_lines rl
  GROUP BY
    rl.revenue_category,
    rl.calculation_method,
    rl.rate_pct
),
section_subtotals AS (
  SELECT
    CASE
      WHEN ss.calculation_method = 'calculated' THEN 'Subtotal — Manual calculations'
      ELSE 'Subtotal — Recorded fee credits'
    END AS revenue_category,
    ss.calculation_method,
    NULL::numeric AS rate_pct,
    SUM(ss.txn_count)::int AS txn_count,
    SUM(ss.transaction_volume) AS transaction_volume,
    SUM(ss.revenue_amount) AS revenue_amount,
    true AS is_subtotal
  FROM stream_summary ss
  GROUP BY ss.calculation_method
)
SELECT
  pb.period_start,
  pb.period_end,
  ss.revenue_category,
  ss.calculation_method,
  ss.rate_pct,
  ss.txn_count,
  ss.transaction_volume,
  ss.revenue_amount,
  false AS is_subtotal
FROM stream_summary ss
CROSS JOIN period_bounds pb
UNION ALL
SELECT
  pb.period_start,
  pb.period_end,
  st.revenue_category,
  st.calculation_method,
  st.rate_pct,
  st.txn_count,
  st.transaction_volume,
  st.revenue_amount,
  st.is_subtotal
FROM section_subtotals st
CROSS JOIN period_bounds pb
ORDER BY
  is_subtotal,
  revenue_amount DESC NULLS LAST,
  revenue_category
`

/** Same revenue streams with previous vs current period comparison. */
export const REVENUE_SUMMARY_PERIOD_COMPARISON = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS_COMPARISON},
${REVENUE_LINE_CTES_COMPARISON},
stream_summary_current AS (
  SELECT
    rl.revenue_category,
    rl.calculation_method,
    rl.rate_pct,
    COUNT(*)::int AS txn_count,
    SUM(rl.transaction_volume) AS transaction_volume,
    SUM(rl.revenue_amount) AS revenue_amount
  FROM revenue_lines_current rl
  GROUP BY
    rl.revenue_category,
    rl.calculation_method,
    rl.rate_pct
),
stream_summary_previous AS (
  SELECT
    rl.revenue_category,
    rl.calculation_method,
    rl.rate_pct,
    COUNT(*)::int AS txn_count,
    SUM(rl.transaction_volume) AS transaction_volume,
    SUM(rl.revenue_amount) AS revenue_amount
  FROM revenue_lines_previous rl
  GROUP BY
    rl.revenue_category,
    rl.calculation_method,
    rl.rate_pct
),
period_streams AS (
  SELECT
    COALESCE(c.revenue_category, p.revenue_category) AS revenue_category,
    COALESCE(c.calculation_method, p.calculation_method) AS calculation_method,
    COALESCE(c.rate_pct, p.rate_pct) AS rate_pct,
    COALESCE(p.txn_count, 0)::int AS previous_txn_count,
    COALESCE(c.txn_count, 0)::int AS current_txn_count,
    COALESCE(p.transaction_volume, 0) AS previous_transaction_volume,
    COALESCE(c.transaction_volume, 0) AS current_transaction_volume,
    COALESCE(p.revenue_amount, 0) AS previous_revenue_amount,
    COALESCE(c.revenue_amount, 0) AS current_revenue_amount,
    COALESCE(c.revenue_amount, 0) - COALESCE(p.revenue_amount, 0) AS revenue_change
  FROM stream_summary_current c
  FULL OUTER JOIN stream_summary_previous p
    ON c.revenue_category = p.revenue_category
    AND c.calculation_method = p.calculation_method
    AND c.rate_pct IS NOT DISTINCT FROM p.rate_pct
),
section_subtotals AS (
  SELECT
    CASE
      WHEN ps.calculation_method = 'calculated' THEN 'Subtotal — Manual calculations'
      ELSE 'Subtotal — Recorded fee credits'
    END AS revenue_category,
    ps.calculation_method,
    NULL::numeric AS rate_pct,
    SUM(ps.previous_txn_count)::int AS previous_txn_count,
    SUM(ps.current_txn_count)::int AS current_txn_count,
    SUM(ps.previous_transaction_volume) AS previous_transaction_volume,
    SUM(ps.current_transaction_volume) AS current_transaction_volume,
    SUM(ps.previous_revenue_amount) AS previous_revenue_amount,
    SUM(ps.current_revenue_amount) AS current_revenue_amount,
    SUM(ps.revenue_change) AS revenue_change,
    true AS is_subtotal
  FROM period_streams ps
  GROUP BY ps.calculation_method
)
SELECT
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  ps.revenue_category,
  ps.calculation_method,
  ps.rate_pct,
  ps.previous_txn_count,
  ps.current_txn_count,
  ps.previous_transaction_volume,
  ps.current_transaction_volume,
  ps.previous_revenue_amount,
  ps.current_revenue_amount,
  ps.revenue_change,
  false AS is_subtotal
FROM period_streams ps
CROSS JOIN period_bounds pb
UNION ALL
SELECT
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  st.revenue_category,
  st.calculation_method,
  st.rate_pct,
  st.previous_txn_count,
  st.current_txn_count,
  st.previous_transaction_volume,
  st.current_transaction_volume,
  st.previous_revenue_amount,
  st.current_revenue_amount,
  st.revenue_change,
  st.is_subtotal
FROM section_subtotals st
CROSS JOIN period_bounds pb
ORDER BY
  is_subtotal,
  current_revenue_amount DESC NULLS LAST,
  revenue_category
`

/** Line-level revenue detail for reconciliation. */
export const REVENUE_DETAIL = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS_SINGLE},
${REVENUE_LINE_CTES_SINGLE}
SELECT
  pb.period_start,
  pb.period_end,
  rl.revenue_category,
  rl.calculation_method,
  rl.rate_pct,
  rl.transaction_row_id,
  rl.transaction_id,
  rl.transaction_date,
  rl.transaction_timestamp,
  rl.service_name,
  rl.product_name,
  rl.transaction_volume,
  rl.revenue_amount,
  rl.remarks
FROM revenue_lines rl
CROSS JOIN period_bounds pb
ORDER BY
  rl.transaction_timestamp DESC,
  rl.revenue_amount DESC NULLS LAST,
  rl.transaction_row_id DESC
`

function stripOptionalBlocks(sql: string): string {
  return sql.replace(/\[\[[\s\S]*?\]\]/g, '')
}

async function validateReports(dateFilters: Record<string, string>) {
  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) throw new Error('No active datasource')

  const reports = [
    ['Revenue Summary', REVENUE_SUMMARY],
    ['Revenue Summary — period comparison', REVENUE_SUMMARY_PERIOD_COMPARISON],
    ['Revenue Detail', REVENUE_DETAIL],
  ] as const

  for (const [name, sql] of reports) {
    const t0 = Date.now()
    const cleaned = applySqlFilters(stripOptionalBlocks(sql), dateFilters)
    const result = await executeDataSourceQuery(ds.id, cleaned)
    const detailRows = result.rows.filter((row) => !row.is_subtotal)
    const totalRevenue = detailRows.reduce(
      (sum, row) => sum + Number(row.revenue_amount ?? row.current_revenue_amount ?? 0),
      0,
    )
    const byMethod = detailRows.reduce(
      (acc, row) => {
        const method = String(row.calculation_method)
        acc[method] =
          (acc[method] ?? 0) + Number(row.revenue_amount ?? row.current_revenue_amount ?? 0)
        return acc
      },
      {} as Record<string, number>,
    )
    const withChange =
      name === 'Revenue Summary — period comparison'
        ? detailRows.filter((row) => Number(row.revenue_change) !== 0).length
        : undefined

    console.log(`\n=== ${name} (${Date.now() - t0}ms, ${result.rows.length} rows) ===`)
    if (name === 'Revenue Summary — period comparison') {
      console.log(
        'period:',
        result.rows[0]?.period_start,
        '→',
        result.rows[0]?.period_end,
        '| previous:',
        result.rows[0]?.previous_period_start,
        '→',
        result.rows[0]?.previous_period_end,
        '| current revenue:',
        totalRevenue.toFixed(2),
        '| rows with change:',
        withChange,
      )
    } else {
      console.log(
        'period:',
        result.rows[0]?.period_start,
        '→',
        result.rows[0]?.period_end,
        '| total revenue:',
        totalRevenue.toFixed(2),
        '| recorded:',
        (byMethod.recorded ?? 0).toFixed(2),
        '| calculated:',
        (byMethod.calculated ?? 0).toFixed(2),
      )
    }
    console.log(JSON.stringify(result.rows.slice(0, 6), null, 2))
  }

  return ds.id
}

async function seedReports(dataSourceId: string) {
  const owner = await prisma.user.findFirst({
    where: { userType: 'OWNER' },
    select: { id: true },
  })

  const definitions = [
    {
      name: '[Revenue] - Summary by stream',
      description:
        'Wallet revenue by stream: recorded fee credits on Global Fees Income (GovPay, INTOUCH/Moov, transfers, remittance) plus calculated percentages (Disbursement 0.9%, Airtime 5%, INTOUCH/Moov 1% when no fee posted, APS PAY 0.8%).',
      category: ReportCategory.FINANCIAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: REVENUE_SUMMARY.trim(),
    },
    {
      name: '[Revenue] - Summary by stream — period comparison',
      description:
        'Same revenue streams as the summary report with previous-period vs current-period txn counts, volumes, revenue, and change. Previous period matches the same length ending the day before dateFrom.',
      category: ReportCategory.FINANCIAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: REVENUE_SUMMARY_PERIOD_COMPARISON.trim(),
    },
    {
      name: '[Revenue] - Transaction detail',
      description:
        'Line-level wallet revenue with calculation method (recorded vs calculated) for reconciliation.',
      category: ReportCategory.FINANCIAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: REVENUE_DETAIL.trim(),
    },
  ] as const

  for (const def of definitions) {
    const existing = await prisma.savedReport.findFirst({
      where: { name: def.name, deletedAt: null },
      select: { id: true, isPublished: true },
    })

    if (existing) {
      await prisma.savedReport.update({
        where: { id: existing.id },
        data: {
          description: def.description,
          category: def.category,
          visualization: def.visualization,
          sql: def.sql,
          dataSourceId,
          updatedById: owner?.id,
        },
      })
      console.log(`Updated report: ${def.name}`)
      if (!existing.isPublished) {
        await publishSavedReport(existing.id, owner?.id)
        console.log(`Published report: ${def.name}`)
      }
      continue
    }

    const created = await prisma.savedReport.create({
      data: {
        name: def.name,
        description: def.description,
        category: def.category,
        visualization: def.visualization,
        sql: def.sql,
        dataSourceId,
        createdById: owner?.id,
        updatedById: owner?.id,
      },
    })
    await publishSavedReport(created.id, owner?.id)
    console.log(`Created and published report: ${def.name}`)
  }
}

async function run() {
  const dateFilters = {
    dateFrom: '2026-05-01',
    dateTo: '2026-05-31',
  }

  const dataSourceId = await validateReports(dateFilters)

  if (process.argv.includes('--seed')) {
    await seedReports(dataSourceId)
  }

  await prisma.$disconnect()
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (process.argv.includes('--print-sql')) {
    console.log('-- REVENUE_SUMMARY --')
    console.log(REVENUE_SUMMARY.trim())
    console.log('\n-- REVENUE_SUMMARY_PERIOD_COMPARISON --')
    console.log(REVENUE_SUMMARY_PERIOD_COMPARISON.trim())
    console.log('\n-- REVENUE_DETAIL --')
    console.log(REVENUE_DETAIL.trim())
  } else {
    run().catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
