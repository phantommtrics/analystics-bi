import 'dotenv/config'
import { ReportCategory, ReportVisualization } from '@prisma/client'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'
import { applySqlFilters } from '../src/reports/sqlFilters.ts'
import { publishSavedReport } from '../src/reports/service.ts'
import { EMONEY_POUCH_DIM_CTES, EMONEY_POUCH_TXN_JOIN } from './report-sql-constants.ts'

const PROFILE_DEDUPE_ORDER = `
  CASE COALESCE(user_status, 'No user record')
    WHEN 'Active' THEN 0
    WHEN 'Registered' THEN 1
    WHEN 'AwaitingApproval' THEN 2
    WHEN 'InActive' THEN 3
    WHEN 'Blocked' THEN 4
    WHEN 'Terminated' THEN 5
    ELSE 6
  END,
  CASE profile_type
    WHEN 'customer' THEN 0
    WHEN 'agent' THEN 1
    WHEN 'merchant' THEN 2
    WHEN 'enterprise' THEN 3
    WHEN 'vendor' THEN 4
    WHEN 'operational' THEN 5
    ELSE 6
  END
`

const SHARED_DIM_CTES = `
entities_deduped AS (
  SELECT DISTINCT ON (e.id) e.id, e.name, e.entity_category
  FROM entities e
  WHERE e.deleted_at IS NULL
  ORDER BY e.id
),
services_deduped AS (
  SELECT DISTINCT ON (s.id) s.id, s.name, s.display_name
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
hierarchies_deduped AS (
  SELECT DISTINCT ON (bh.id) bh.id, bh.name
  FROM business_hierarchies bh
  WHERE bh.deleted_at IS NULL
  ORDER BY bh.id
),
global_fees_entity AS (
  SELECT id FROM entities_deduped WHERE name = 'Global Fees Income' LIMIT 1
),
customer_entity AS (
  SELECT id FROM entities_deduped WHERE name = 'Customer' LIMIT 1
),
customer_hierarchy AS (
  SELECT id FROM hierarchies_deduped WHERE name = 'Customer' LIMIT 1
),
all_profiles AS (
  SELECT
    'agent'::text AS profile_type,
    au.mobile,
    u.status AS user_status,
    COALESCE(au.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL AND au.mobile IS NOT NULL
  UNION ALL
  SELECT 'customer', cu.mobile, u.status, u.business_hierarchy_id
  FROM customer_users cu
  LEFT JOIN users u ON u.id = cu.user_id
  WHERE cu.deleted_at IS NULL AND cu.mobile IS NOT NULL
  UNION ALL
  SELECT 'merchant', mu.mobile, u.status, COALESCE(mu.business_hierarchy_id, u.business_hierarchy_id)
  FROM merchant_users mu
  LEFT JOIN users u ON u.id = mu.user_id
  WHERE mu.deleted_at IS NULL AND mu.mobile IS NOT NULL
  UNION ALL
  SELECT 'enterprise', eu.mobile, u.status, COALESCE(eu.business_hierarchy_id, u.business_hierarchy_id)
  FROM enterprise_users eu
  LEFT JOIN users u ON u.id = eu.user_id
  WHERE eu.deleted_at IS NULL AND eu.mobile IS NOT NULL
  UNION ALL
  SELECT 'vendor', vu.mobile, u.status, u.business_hierarchy_id
  FROM vendor_users vu
  LEFT JOIN users u ON u.id = vu.user_id
  WHERE vu.deleted_at IS NULL AND vu.mobile IS NOT NULL
  UNION ALL
  SELECT 'operational', ou.mobile, u.status, u.business_hierarchy_id
  FROM operational_users ou
  LEFT JOIN users u ON u.id = ou.user_id
  WHERE ou.deleted_at IS NULL AND ou.mobile IS NOT NULL
),
user_ctx AS (
  SELECT DISTINCT ON (mobile)
    mobile,
    hierarchy_id
  FROM all_profiles
  ORDER BY mobile, ${PROFILE_DEDUPE_ORDER}
),
${EMONEY_POUCH_DIM_CTES}`

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
    t.id AS transaction_row_id,
    t.user_identifier,
    t.entity_id,
    COALESCE(
      p.name,
      CASE
        WHEN t.remarks ~* '^You have received .+ FEE of '
          THEN TRIM(regexp_replace(t.remarks, '^You have received (.+) FEE of .*', '\\1'))
        ELSE '(Recorded fee)'
      END
    ) AS product_name,
    COALESCE(
      p.display_name,
      p.name,
      CASE
        WHEN t.remarks ~* '^You have received .+ FEE of '
          THEN TRIM(regexp_replace(t.remarks, '^You have received (.+) FEE of .*', '\\1'))
        ELSE '(Recorded fee)'
      END
    ) AS product_display_name,
    t.transaction_amount::numeric AS revenue_amount
  FROM transactions t
  CROSS JOIN global_fees_entity gfe
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
    t.id AS transaction_row_id,
    t.user_identifier,
    t.entity_id,
    p.name AS product_name,
    COALESCE(p.display_name, p.name) AS product_display_name,
    ROUND(
      t.transaction_amount::numeric * CASE
        WHEN p.name = 'Disbursement' THEN 0.009
        WHEN s.name = 'Airtime Topup' THEN 0.05
        WHEN p.name ILIKE '%intouch%' OR p.name ILIKE '%moov%' THEN 0.01
        WHEN p.name = 'APS PAY' THEN 0.008
      END,
      2
    ) AS revenue_amount
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

function resolveHierarchyExpr(alias: string): string {
  return `
    CASE
      WHEN ${alias}.entity_id = ce.id THEN ch.id
      ELSE uc.hierarchy_id
    END`
}

function buildPeriodProductActivityCtes(
  suffix: '_current' | '_previous',
  startExpr: string,
  endExclusiveExpr: string,
): string {
  return `
entity_txn_volumes${suffix} AS (
  SELECT
    t.transaction_id,
    e.id AS entity_id,
    COALESCE(p.name, '(No product)') AS product_name,
    COALESCE(p.display_name, p.name, '(No product)') AS product_display_name,
    MAX(t.user_identifier) AS user_identifier,
    MAX(t.transaction_amount::numeric) AS transaction_volume
  FROM transactions t
  JOIN entities_deduped e ON e.id = t.entity_id
  ${EMONEY_POUCH_TXN_JOIN}
  LEFT JOIN products_deduped p ON p.id = t.product_id
  WHERE t.deleted_at IS NULL
    AND t.status = 'SUCCESS'
    AND t.transaction_id IS NOT NULL
    AND t.created_at >= ${startExpr}
    AND t.created_at < ${endExclusiveExpr}
  GROUP BY t.transaction_id, e.id, p.name, p.display_name
),
activity_with_hierarchy${suffix} AS (
  SELECT
    etv.product_name,
    etv.product_display_name,
    etv.transaction_volume,
    ${resolveHierarchyExpr('etv')} AS hierarchy_id
  FROM entity_txn_volumes${suffix} etv
  CROSS JOIN customer_entity ce
  CROSS JOIN customer_hierarchy ch
  LEFT JOIN user_ctx uc ON uc.mobile = etv.user_identifier
),
hierarchy_product_activity${suffix} AS (
  SELECT
    hierarchy_id,
    product_name,
    product_display_name,
    COUNT(*)::int AS txn_count,
    SUM(transaction_volume) AS transaction_volume
  FROM activity_with_hierarchy${suffix}
  GROUP BY hierarchy_id, product_name, product_display_name
)`
}

function buildPeriodProductRevenueCtes(
  suffix: '_current' | '_previous',
  startExpr: string,
  endExclusiveExpr: string,
): string {
  const intouchCte = `intouch_moov_recorded_products${suffix}`
  return [
    intouchMoovRecordedProductsCte(suffix, startExpr, endExclusiveExpr),
    recordedFeeLinesCte(suffix, startExpr, endExclusiveExpr),
    calculatedFeeLinesCte(suffix, startExpr, endExclusiveExpr, intouchCte),
    `
revenue_lines${suffix} AS (
  SELECT * FROM recorded_fee_lines${suffix}
  UNION ALL
  SELECT * FROM calculated_fee_lines${suffix}
),
revenue_with_hierarchy${suffix} AS (
  SELECT
    rl.product_name,
    rl.product_display_name,
    rl.revenue_amount,
    CASE
      WHEN rl.entity_id = gfe.id THEN NULL::bigint
      WHEN rl.entity_id = ce.id THEN ch.id
      ELSE uc.hierarchy_id
    END AS hierarchy_id
  FROM revenue_lines${suffix} rl
  CROSS JOIN global_fees_entity gfe
  CROSS JOIN customer_entity ce
  CROSS JOIN customer_hierarchy ch
  LEFT JOIN user_ctx uc ON uc.mobile = rl.user_identifier
),
hierarchy_product_revenue${suffix} AS (
  SELECT
    hierarchy_id,
    product_name,
    product_display_name,
    SUM(revenue_amount) AS revenue_amount
  FROM revenue_with_hierarchy${suffix}
  GROUP BY hierarchy_id, product_name, product_display_name
)`,
  ].join(',\n')
}

const PERIOD_CTES = [
  buildPeriodProductActivityCtes('_current', 'CAST(:dateFrom AS timestamp)', 'CAST(:dateToExclusive AS timestamp)'),
  buildPeriodProductRevenueCtes('_current', 'CAST(:dateFrom AS timestamp)', 'CAST(:dateToExclusive AS timestamp)'),
  buildPeriodProductActivityCtes(
    '_previous',
    '(SELECT previous_period_start FROM period_bounds)::timestamp',
    'CAST(:dateFrom AS timestamp)',
  ),
  buildPeriodProductRevenueCtes(
    '_previous',
    '(SELECT previous_period_start FROM period_bounds)::timestamp',
    'CAST(:dateFrom AS timestamp)',
  ),
].join(',\n')

/** Product txn count, volume, and revenue by hierarchy — all products and entities, current vs previous. */
export const HIERARCHY_PRODUCT_ROLLUP_PERIOD_COMPARISON = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS_COMPARISON},
${PERIOD_CTES},
hierarchy_product_keys AS (
  SELECT hierarchy_id, product_name FROM hierarchy_product_activity_current
  UNION
  SELECT hierarchy_id, product_name FROM hierarchy_product_activity_previous
  UNION
  SELECT hierarchy_id, product_name FROM hierarchy_product_revenue_current
  UNION
  SELECT hierarchy_id, product_name FROM hierarchy_product_revenue_previous
),
hierarchy_product_comparison AS (
  SELECT
    k.hierarchy_id,
    k.product_name,
    COALESCE(
      curr.product_display_name,
      prev.product_display_name,
      curr_rev.product_display_name,
      prev_rev.product_display_name,
      k.product_name
    ) AS product_display_name,
    COALESCE(prev.txn_count, 0) AS previous_txn_count,
    COALESCE(curr.txn_count, 0) AS current_txn_count,
    COALESCE(prev.transaction_volume, 0) AS previous_transaction_volume,
    COALESCE(curr.transaction_volume, 0) AS current_transaction_volume,
    COALESCE(prev_rev.revenue_amount, 0) AS previous_revenue_amount,
    COALESCE(curr_rev.revenue_amount, 0) AS current_revenue_amount
  FROM hierarchy_product_keys k
  LEFT JOIN hierarchy_product_activity_current curr
    ON curr.hierarchy_id IS NOT DISTINCT FROM k.hierarchy_id
    AND curr.product_name = k.product_name
  LEFT JOIN hierarchy_product_activity_previous prev
    ON prev.hierarchy_id IS NOT DISTINCT FROM k.hierarchy_id
    AND prev.product_name = k.product_name
  LEFT JOIN hierarchy_product_revenue_current curr_rev
    ON curr_rev.hierarchy_id IS NOT DISTINCT FROM k.hierarchy_id
    AND curr_rev.product_name = k.product_name
  LEFT JOIN hierarchy_product_revenue_previous prev_rev
    ON prev_rev.hierarchy_id IS NOT DISTINCT FROM k.hierarchy_id
    AND prev_rev.product_name = k.product_name
)
SELECT
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  COALESCE(bh.name, 'Unassigned') AS hierarchy_name,
  hpc.product_name,
  hpc.product_display_name,
  hpc.previous_txn_count,
  hpc.current_txn_count,
  hpc.current_txn_count - hpc.previous_txn_count AS txn_count_change,
  hpc.previous_transaction_volume,
  hpc.current_transaction_volume,
  hpc.current_transaction_volume - hpc.previous_transaction_volume AS transaction_volume_change,
  hpc.previous_revenue_amount,
  hpc.current_revenue_amount,
  hpc.current_revenue_amount - hpc.previous_revenue_amount AS revenue_change
FROM hierarchy_product_comparison hpc
CROSS JOIN period_bounds pb
LEFT JOIN hierarchies_deduped bh ON bh.id = hpc.hierarchy_id
WHERE 1 = 1
  [[AND bh.name = :hierarchyName?]]
  [[AND hpc.product_name = :productName?]]
ORDER BY
  CASE WHEN COALESCE(bh.name, 'Unassigned') = 'Unassigned' THEN 1 ELSE 0 END,
  COALESCE(bh.name, 'Unassigned'),
  hpc.current_revenue_amount DESC NULLS LAST,
  hpc.current_transaction_volume DESC NULLS LAST,
  hpc.product_name
`

function stripOptionalBlocks(sql: string): string {
  return sql.replace(/\[\[[\s\S]*?\]\]/g, '')
}

async function validateReports(dateFilters: Record<string, string>) {
  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) throw new Error('No active datasource')

  const t0 = Date.now()
  const cleaned = applySqlFilters(stripOptionalBlocks(HIERARCHY_PRODUCT_ROLLUP_PERIOD_COMPARISON), dateFilters)
  const result = await executeDataSourceQuery(ds.id, cleaned)
  console.log(`\n=== Hierarchy product rollup (${Date.now() - t0}ms, ${result.rows.length} rows) ===`)
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
  console.log(JSON.stringify(result.rows.slice(0, 12), null, 2))
  return ds.id
}

async function seedReports(dataSourceId: string) {
  const owner = await prisma.user.findFirst({
    where: { userType: 'OWNER' },
    select: { id: true, organizationId: true },
  })

  const def = {
    name: '[Hierarchy] - Products by hierarchy — period comparison',
    description:
      'Full product list organized by business hierarchy: txn count, volume, and revenue for every product across all entities, with previous vs current period comparison. Revenue uses recorded Global Fees credits plus calculated rates where applicable.',
    category: ReportCategory.OPERATIONAL,
    visualization: ReportVisualization.TABLE_ONLY,
    sql: HIERARCHY_PRODUCT_ROLLUP_PERIOD_COMPARISON.trim(),
  }

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
    return
  }

  if (!owner?.organizationId) {
    throw new Error('No owner organization found — cannot create report without organizationId')
  }

  const created = await prisma.savedReport.create({
    data: {
      name: def.name,
      description: def.description,
      category: def.category,
      visualization: def.visualization,
      sql: def.sql,
      dataSourceId,
      organizationId: owner.organizationId,
      createdById: owner.id,
      updatedById: owner.id,
    },
  })
  await publishSavedReport(created.id, owner.id)
  console.log(`Created and published report: ${def.name}`)
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
    console.log(HIERARCHY_PRODUCT_ROLLUP_PERIOD_COMPARISON.trim())
  } else {
    run().catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
