import 'dotenv/config'
import { ReportCategory, ReportVisualization } from '@prisma/client'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'
import { applySqlFilters } from '../src/reports/sqlFilters.ts'
import { publishSavedReport } from '../src/reports/service.ts'

const TARGET_PRODUCTS = "('APS PAY', 'Disbursement', 'Ticket')" as const

const SHARED_DIM_CTES = `
entities_deduped AS (
  SELECT DISTINCT ON (e.id) e.id, e.name, e.entity_category
  FROM entities e
  WHERE e.deleted_at IS NULL
  ORDER BY e.id
),
products_deduped AS (
  SELECT DISTINCT ON (p.id) p.id, p.name, p.display_name
  FROM products p
  WHERE p.deleted_at IS NULL
  ORDER BY p.id
),
hierarchies_deduped AS (
  SELECT DISTINCT ON (bh.id) bh.id, bh.name
  FROM business_hierarchies bh
  WHERE bh.deleted_at IS NULL
  ORDER BY bh.id
),
merchant_by_mobile AS (
  SELECT DISTINCT ON (mu.mobile, mu.entity_id)
    mu.mobile,
    mu.user_id,
    mu.entity_id,
    COALESCE(mu.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id,
    COALESCE(
      mu.full_name,
      NULLIF(TRIM(COALESCE(mu.firstname, '') || ' ' || COALESCE(mu.lastname, '')), '')
    ) AS profile_name
  FROM merchant_users mu
  LEFT JOIN users u ON u.id = mu.user_id
  WHERE mu.deleted_at IS NULL
    AND mu.mobile IS NOT NULL
  ORDER BY mu.mobile, mu.entity_id, mu.id DESC
),
enterprise_by_mobile AS (
  SELECT DISTINCT ON (eu.mobile, eu.entity_id)
    eu.mobile,
    eu.user_id,
    eu.entity_id,
    COALESCE(eu.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id,
    COALESCE(
      eu.full_name,
      NULLIF(TRIM(COALESCE(eu.firstname, '') || ' ' || COALESCE(eu.lastname, '')), '')
    ) AS profile_name
  FROM enterprise_users eu
  LEFT JOIN users u ON u.id = eu.user_id
  WHERE eu.deleted_at IS NULL
    AND eu.mobile IS NOT NULL
  ORDER BY eu.mobile, eu.entity_id, eu.id DESC
),
target_products AS (
  SELECT
    p.id,
    p.name,
    COALESCE(p.display_name, p.name) AS display_name,
    CASE
      WHEN p.name = 'Disbursement' THEN 0.009
      ELSE 0.008
    END AS revenue_rate,
    CASE
      WHEN p.name = 'Disbursement' THEN 0.9
      ELSE 0.8
    END AS rate_pct,
    CASE
      WHEN p.name IN ('APS PAY', 'Ticket') THEN 'merchant'::text
      WHEN p.name = 'Disbursement' THEN 'enterprise'::text
    END AS profile_type
  FROM products_deduped p
  WHERE p.name IN ${TARGET_PRODUCTS}
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

/** Merchant products (APS PAY, Ticket): CR on MERCHANT entity. Disbursement: DR on ENTERPRISE entity. */
function productTxnFilter(alias = 't', productAlias = 'p', entityAlias = 'e'): string {
  return `
    AND ${productAlias}.name IN ${TARGET_PRODUCTS}
    AND ${alias}.deleted_at IS NULL
    AND ${alias}.status = 'SUCCESS'
    AND (
      (
        ${productAlias}.name IN ('APS PAY', 'Ticket')
        AND ${alias}.transaction_type = 'CR'
        AND ${entityAlias}.entity_category = 'MERCHANT'
      )
      OR (
        ${productAlias}.name = 'Disbursement'
        AND ${alias}.transaction_type = 'DR'
        AND ${entityAlias}.entity_category = 'ENTERPRISE'
      )
    )`
}

function buildProductPeriodCtes(suffix: '_current' | '_previous', startExpr: string, endExclusiveExpr: string): string {
  return `
product_txns${suffix} AS (
  SELECT
    p.name AS product_name,
    tp.display_name,
    tp.rate_pct,
    tp.revenue_rate,
    tp.profile_type,
    t.id AS transaction_row_id,
    t.user_identifier,
    t.entity_id,
    t.transaction_amount::numeric AS transaction_volume,
    ROUND(t.transaction_amount::numeric * tp.revenue_rate, 2) AS revenue_amount
  FROM transactions t
  JOIN products_deduped p ON p.id = t.product_id
  JOIN entities_deduped e ON e.id = t.entity_id
  JOIN target_products tp ON tp.name = p.name
  WHERE t.created_at >= ${startExpr}
    AND t.created_at < ${endExclusiveExpr}
    ${productTxnFilter()}
),
product_summary${suffix} AS (
  SELECT
    product_name,
    display_name,
    rate_pct,
    profile_type,
    COUNT(*)::int AS txn_count,
    SUM(transaction_volume) AS transaction_volume,
    SUM(revenue_amount) AS revenue_amount
  FROM product_txns${suffix}
  GROUP BY product_name, display_name, rate_pct, profile_type
),
user_product_txns${suffix} AS (
  SELECT
    product_name,
    user_identifier,
    entity_id,
    COUNT(*)::int AS txn_count,
    SUM(transaction_volume) AS transaction_volume
  FROM product_txns${suffix}
  WHERE user_identifier IS NOT NULL
  GROUP BY product_name, user_identifier, entity_id
)`
}

const PRODUCT_PERIOD_CTES = [
  buildProductPeriodCtes('_current', 'CAST(:dateFrom AS timestamp)', 'CAST(:dateToExclusive AS timestamp)'),
  buildProductPeriodCtes(
    '_previous',
    '(SELECT previous_period_start FROM period_bounds)::timestamp',
    'CAST(:dateFrom AS timestamp)',
  ),
].join(',\n')

/** Product txn count, volume, and calculated revenue with previous vs current period. */
export const PRODUCT_SUMMARY_PERIOD_COMPARISON = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS_COMPARISON},
${PRODUCT_PERIOD_CTES},
all_products AS (
  SELECT * FROM target_products
),
product_comparison AS (
  SELECT
    ap.name AS product_name,
    ap.display_name,
    ap.rate_pct,
    ap.profile_type,
    COALESCE(prev.txn_count, 0) AS previous_txn_count,
    COALESCE(curr.txn_count, 0) AS current_txn_count,
    COALESCE(prev.transaction_volume, 0) AS previous_transaction_volume,
    COALESCE(curr.transaction_volume, 0) AS current_transaction_volume,
    COALESCE(prev.revenue_amount, 0) AS previous_revenue_amount,
    COALESCE(curr.revenue_amount, 0) AS current_revenue_amount,
    COALESCE(curr.revenue_amount, 0) - COALESCE(prev.revenue_amount, 0) AS revenue_change
  FROM all_products ap
  LEFT JOIN product_summary_previous prev ON prev.product_name = ap.name
  LEFT JOIN product_summary_current curr ON curr.product_name = ap.name
)
SELECT
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  pc.product_name,
  pc.display_name,
  pc.rate_pct,
  pc.profile_type,
  pc.previous_txn_count,
  pc.current_txn_count,
  pc.current_txn_count - pc.previous_txn_count AS txn_count_change,
  pc.previous_transaction_volume,
  pc.current_transaction_volume,
  pc.current_transaction_volume - pc.previous_transaction_volume AS transaction_volume_change,
  pc.previous_revenue_amount,
  pc.current_revenue_amount,
  pc.revenue_change
FROM product_comparison pc
CROSS JOIN period_bounds pb
ORDER BY pc.current_revenue_amount DESC NULLS LAST, pc.product_name
`

const ENTITY_PRODUCT_PERIOD_CTES = [
  `
product_entity_txns_current AS (
  SELECT
    pt.product_name,
    pt.display_name,
    pt.rate_pct,
    pt.profile_type,
    pt.entity_id,
    COUNT(*)::int AS txn_count,
    SUM(pt.transaction_volume) AS transaction_volume,
    SUM(pt.revenue_amount) AS revenue_amount
  FROM product_txns_current pt
  GROUP BY pt.product_name, pt.display_name, pt.rate_pct, pt.profile_type, pt.entity_id
),
product_entity_txns_previous AS (
  SELECT
    pt.product_name,
    pt.display_name,
    pt.rate_pct,
    pt.profile_type,
    pt.entity_id,
    COUNT(*)::int AS txn_count,
    SUM(pt.transaction_volume) AS transaction_volume,
    SUM(pt.revenue_amount) AS revenue_amount
  FROM product_txns_previous pt
  GROUP BY pt.product_name, pt.display_name, pt.rate_pct, pt.profile_type, pt.entity_id
)`,
].join(',\n')

/** Same product metrics rolled up by entity for merchant and enterprise legs. */
export const PRODUCT_ENTITY_PERIOD_COMPARISON = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS_COMPARISON},
${PRODUCT_PERIOD_CTES},
${ENTITY_PRODUCT_PERIOD_CTES},
entity_product_comparison AS (
  SELECT
    COALESCE(curr.product_name, prev.product_name) AS product_name,
    COALESCE(curr.display_name, prev.display_name) AS display_name,
    COALESCE(curr.rate_pct, prev.rate_pct) AS rate_pct,
    COALESCE(curr.profile_type, prev.profile_type) AS profile_type,
    COALESCE(curr.entity_id, prev.entity_id) AS entity_id,
    COALESCE(prev.txn_count, 0) AS previous_txn_count,
    COALESCE(curr.txn_count, 0) AS current_txn_count,
    COALESCE(prev.transaction_volume, 0) AS previous_transaction_volume,
    COALESCE(curr.transaction_volume, 0) AS current_transaction_volume,
    COALESCE(prev.revenue_amount, 0) AS previous_revenue_amount,
    COALESCE(curr.revenue_amount, 0) AS current_revenue_amount
  FROM product_entity_txns_current curr
  FULL OUTER JOIN product_entity_txns_previous prev
    ON curr.product_name = prev.product_name
    AND curr.entity_id = prev.entity_id
)
SELECT
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  COALESCE(bh.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pe.name, '(Root)') AS parent_entity_name,
  COALESCE(e.name, 'Unassigned') AS entity_name,
  e.entity_category,
  epc.product_name,
  epc.display_name,
  epc.rate_pct,
  epc.profile_type,
  epc.previous_txn_count,
  epc.current_txn_count,
  epc.current_txn_count - epc.previous_txn_count AS txn_count_change,
  epc.previous_transaction_volume,
  epc.current_transaction_volume,
  epc.current_transaction_volume - epc.previous_transaction_volume AS transaction_volume_change,
  epc.previous_revenue_amount,
  epc.current_revenue_amount,
  epc.current_revenue_amount - epc.previous_revenue_amount AS revenue_change
FROM entity_product_comparison epc
CROSS JOIN period_bounds pb
LEFT JOIN entities_deduped e ON e.id = epc.entity_id
LEFT JOIN LATERAL (
  SELECT bhe.business_hierarchy_id, bhe.parent_entity_id
  FROM business_hierarchy_entities bhe
  WHERE bhe.entity_id = e.id
  ORDER BY bhe.id
  LIMIT 1
) bhe ON true
LEFT JOIN hierarchies_deduped bh ON bh.id = bhe.business_hierarchy_id
LEFT JOIN entities_deduped pe ON pe.id = bhe.parent_entity_id
ORDER BY
  epc.product_name,
  epc.current_revenue_amount DESC NULLS LAST,
  e.name
`

const INACTIVE_USER_CTES = `
entity_product_users AS (
  SELECT
    tp.name AS product_name,
    tp.display_name,
    tp.profile_type,
    mbm.mobile AS user_identifier,
    mbm.user_id,
    mbm.entity_id,
    mbm.hierarchy_id,
    mbm.profile_name
  FROM target_products tp
  JOIN merchant_by_mobile mbm ON tp.profile_type = 'merchant'
  JOIN entities_deduped e ON e.id = mbm.entity_id AND e.entity_category = 'MERCHANT'
  WHERE tp.name IN ('APS PAY', 'Ticket')
  UNION ALL
  SELECT
    tp.name AS product_name,
    tp.display_name,
    tp.profile_type,
    ebm.mobile AS user_identifier,
    ebm.user_id,
    ebm.entity_id,
    ebm.hierarchy_id,
    ebm.profile_name
  FROM target_products tp
  JOIN enterprise_by_mobile ebm ON tp.profile_type = 'enterprise'
  JOIN entities_deduped e ON e.id = ebm.entity_id AND e.entity_category = 'ENTERPRISE'
  WHERE tp.name = 'Disbursement'
),
user_product_activity AS (
  SELECT
    epu.product_name,
    epu.display_name,
    epu.profile_type,
    epu.user_id,
    epu.user_identifier,
    epu.entity_id,
    epu.hierarchy_id,
    epu.profile_name,
    COALESCE(prev.txn_count, 0) AS previous_txn_count,
    COALESCE(curr.txn_count, 0) AS current_txn_count,
    COALESCE(prev.transaction_volume, 0) AS previous_transaction_volume,
    COALESCE(curr.transaction_volume, 0) AS current_transaction_volume
  FROM entity_product_users epu
  LEFT JOIN user_product_txns_previous prev
    ON prev.product_name = epu.product_name
    AND prev.user_identifier = epu.user_identifier
    AND prev.entity_id = epu.entity_id
  LEFT JOIN user_product_txns_current curr
    ON curr.product_name = epu.product_name
    AND curr.user_identifier = epu.user_identifier
    AND curr.entity_id = epu.entity_id
)`

/** Entity members with zero product transactions in the current period; includes previous-period activity. */
export const INACTIVE_ENTITY_USERS_PERIOD_COMPARISON = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS_COMPARISON},
${PRODUCT_PERIOD_CTES},
${INACTIVE_USER_CTES}
SELECT
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  COALESCE(bh.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pe.name, '(Root)') AS parent_entity_name,
  COALESCE(e.name, 'Unassigned') AS entity_name,
  e.entity_category,
  upa.product_name,
  upa.display_name,
  upa.profile_type,
  upa.user_id,
  upa.user_identifier,
  COALESCE(upa.profile_name, upa.user_identifier) AS user_name,
  upa.previous_txn_count,
  upa.current_txn_count,
  upa.previous_transaction_volume,
  upa.current_transaction_volume,
  upa.previous_txn_count - upa.current_txn_count AS txn_count_drop
FROM user_product_activity upa
CROSS JOIN period_bounds pb
LEFT JOIN entities_deduped e ON e.id = upa.entity_id
LEFT JOIN hierarchies_deduped bh ON bh.id = upa.hierarchy_id
LEFT JOIN LATERAL (
  SELECT bhe.parent_entity_id
  FROM business_hierarchy_entities bhe
  WHERE bhe.business_hierarchy_id = bh.id
    AND bhe.entity_id = e.id
  ORDER BY bhe.id
  LIMIT 1
) bhe ON true
LEFT JOIN entities_deduped pe ON pe.id = bhe.parent_entity_id
WHERE upa.current_txn_count = 0
  [[AND upa.product_name = :productName?]]
  [[AND e.name = :entityName?]]
  [[AND bh.name = :hierarchyName?]]
ORDER BY
  upa.product_name,
  CASE WHEN COALESCE(bh.name, 'Unassigned') = 'Unassigned' THEN 1 ELSE 0 END,
  COALESCE(bh.name, 'Unassigned'),
  e.name,
  upa.previous_txn_count DESC,
  upa.user_identifier
`

function stripOptionalBlocks(sql: string): string {
  return sql.replace(/\[\[[\s\S]*?\]\]/g, '')
}

async function validateReports(dateFilters: Record<string, string>) {
  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) throw new Error('No active datasource')

  const reports = [
    ['Product Summary — period comparison', PRODUCT_SUMMARY_PERIOD_COMPARISON],
    ['Product by entity — period comparison', PRODUCT_ENTITY_PERIOD_COMPARISON],
    ['Inactive entity users — period comparison', INACTIVE_ENTITY_USERS_PERIOD_COMPARISON],
  ] as const

  for (const [name, sql] of reports) {
    const t0 = Date.now()
    const cleaned = applySqlFilters(stripOptionalBlocks(sql), dateFilters)
    const result = await executeDataSourceQuery(ds.id, cleaned)
    console.log(`\n=== ${name} (${Date.now() - t0}ms, ${result.rows.length} rows) ===`)
    if (result.rows.length > 0) {
      console.log(
        'period:',
        result.rows[0]?.period_start,
        '→',
        result.rows[0]?.period_end,
        '| previous:',
        result.rows[0]?.previous_period_start,
        '→',
        result.rows[0]?.previous_period_end,
      )
    }
    console.log(JSON.stringify(result.rows.slice(0, 8), null, 2))
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
      name: '[Product] - Summary by product — period comparison',
      description:
        'APS PAY, Ticket, and Disbursement performance: txn count, volume, and revenue (APS PAY/Ticket 0.8%, Disbursement 0.9%). Merchant products use CR on MERCHANT entity; Disbursement uses DR on ENTERPRISE entity (Employee/Enterprise). Previous period matches the same length ending the day before dateFrom.',
      category: ReportCategory.OPERATIONAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: PRODUCT_SUMMARY_PERIOD_COMPARISON.trim(),
    },
    {
      name: '[Product] - Summary by entity — period comparison',
      description:
        'Same product metrics as the summary report, rolled up by merchant or enterprise entity with hierarchy and previous vs current period comparison.',
      category: ReportCategory.OPERATIONAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: PRODUCT_ENTITY_PERIOD_COMPARISON.trim(),
    },
    {
      name: '[Product] - Inactive entity users — period comparison',
      description:
        'Merchant users (APS PAY, Ticket) and enterprise users (Disbursement) who belong to the entity but had zero product transactions in the current period, with previous-period txn count and volume for comparison.',
      category: ReportCategory.OPERATIONAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: INACTIVE_ENTITY_USERS_PERIOD_COMPARISON.trim(),
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
    console.log('-- PRODUCT_SUMMARY_PERIOD_COMPARISON --')
    console.log(PRODUCT_SUMMARY_PERIOD_COMPARISON.trim())
    console.log('\n-- PRODUCT_ENTITY_PERIOD_COMPARISON --')
    console.log(PRODUCT_ENTITY_PERIOD_COMPARISON.trim())
    console.log('\n-- INACTIVE_ENTITY_USERS_PERIOD_COMPARISON --')
    console.log(INACTIVE_ENTITY_USERS_PERIOD_COMPARISON.trim())
  } else {
    run().catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
