import 'dotenv/config'
import { ReportCategory, ReportVisualization } from '@prisma/client'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'
import { applySqlFilters } from '../src/reports/sqlFilters.ts'
import { publishSavedReport } from '../src/reports/service.ts'
import { EMONEY_POUCH_DIM_CTES, EMONEY_POUCH_TXN_JOIN } from './report-sql-constants.ts'

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
${EMONEY_POUCH_DIM_CTES}`

const PERIOD_BOUNDS = `
period_bounds AS (
  SELECT
    CAST(:dateFrom AS date) AS period_start,
    CAST(:dateTo AS date) AS period_end
)`

/** One row per business transaction on an entity; volume deduped when multiple ledger legs share a transaction_id. */
const ENTITY_TXN_VOLUMES_CTE = `
entity_txn_volumes AS (
  SELECT
    e.id AS entity_id,
    e.name AS entity_name,
    e.entity_category,
    t.transaction_id,
    COALESCE(p.name, '(No product)') AS product_name,
    COALESCE(p.display_name, p.name, '(No product)') AS product_display_name,
    MAX(t.transaction_amount::numeric) AS transaction_volume
  FROM transactions t
  JOIN entities_deduped e ON e.id = t.entity_id
  ${EMONEY_POUCH_TXN_JOIN}
  LEFT JOIN products_deduped p ON p.id = t.product_id
  WHERE t.deleted_at IS NULL
    AND t.status = 'SUCCESS'
    AND t.transaction_id IS NOT NULL
    AND t.created_at >= CAST(:dateFrom AS timestamp)
    AND t.created_at < CAST(:dateToExclusive AS timestamp)
    [[AND e.entity_category = :entityCategory?]]
    [[AND e.name = :entityName?]]
  GROUP BY
    e.id,
    e.name,
    e.entity_category,
    t.transaction_id,
    p.name,
    p.display_name
),
scoped_txns AS (
  SELECT
    etv.entity_id,
    etv.entity_name,
    etv.entity_category,
    etv.transaction_id,
    etv.product_name,
    etv.product_display_name,
    etv.transaction_volume,
    CASE
      WHEN etv.entity_category = 'CUSTOMER' THEN 'Customer'
      WHEN etv.entity_category = 'AGENT' THEN 'Agent'
      ELSE etv.entity_name
    END AS scope_label
  FROM entity_txn_volumes etv
),
scope_filtered AS (
  SELECT *
  FROM scoped_txns st
  WHERE (
    (:entityName? IS NOT NULL AND st.entity_name = :entityName?)
    OR (:entityCategory? IS NOT NULL AND st.entity_category = :entityCategory?)
    OR (:entityName? IS NULL AND :entityCategory? IS NULL AND st.scope_label IN ('Customer', 'Agent'))
  )
)`

/** Transaction count and volume by scope (Customer, Agent, or a specific entity). */
export const TRANSACTION_SUMMARY = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS},
${ENTITY_TXN_VOLUMES_CTE},
summary AS (
  SELECT
    sf.scope_label,
    sf.entity_category,
    CASE
      WHEN sf.scope_label IN ('Customer', 'Agent') THEN NULL::text
      ELSE sf.entity_name
    END AS entity_name,
    COUNT(*)::int AS txn_count,
    SUM(sf.transaction_volume) AS transaction_volume
  FROM scope_filtered sf
  GROUP BY
    sf.scope_label,
    sf.entity_category,
    CASE
      WHEN sf.scope_label IN ('Customer', 'Agent') THEN NULL::text
      ELSE sf.entity_name
    END
)
SELECT
  pb.period_start,
  pb.period_end,
  s.scope_label,
  s.entity_category,
  s.entity_name,
  s.txn_count,
  s.transaction_volume
FROM summary s
CROSS JOIN period_bounds pb
ORDER BY
  CASE s.scope_label
    WHEN 'Customer' THEN 0
    WHEN 'Agent' THEN 1
    ELSE 2
  END,
  s.transaction_volume DESC NULLS LAST,
  s.scope_label
`

/** Product breakdown of txn count and volume within each scope. */
export const TRANSACTION_DETAIL_BY_PRODUCT = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS},
${ENTITY_TXN_VOLUMES_CTE},
product_detail AS (
  SELECT
    sf.scope_label,
    sf.entity_category,
    CASE
      WHEN sf.scope_label IN ('Customer', 'Agent') THEN NULL::text
      ELSE sf.entity_name
    END AS entity_name,
    sf.product_name,
    sf.product_display_name,
    COUNT(*)::int AS txn_count,
    SUM(sf.transaction_volume) AS transaction_volume
  FROM scope_filtered sf
  GROUP BY
    sf.scope_label,
    sf.entity_category,
    CASE
      WHEN sf.scope_label IN ('Customer', 'Agent') THEN NULL::text
      ELSE sf.entity_name
    END,
    sf.product_name,
    sf.product_display_name
)
SELECT
  pb.period_start,
  pb.period_end,
  pd.scope_label,
  pd.entity_category,
  pd.entity_name,
  pd.product_name,
  pd.product_display_name,
  pd.txn_count,
  pd.transaction_volume
FROM product_detail pd
CROSS JOIN period_bounds pb
ORDER BY
  CASE pd.scope_label
    WHEN 'Customer' THEN 0
    WHEN 'Agent' THEN 1
    ELSE 2
  END,
  pd.scope_label,
  pd.transaction_volume DESC NULLS LAST,
  pd.product_name
`

/** Same product detail with hierarchy context when drilling into a specific entity. */
export const TRANSACTION_DETAIL_BY_ENTITY_PRODUCT = `
WITH ${SHARED_DIM_CTES},
${PERIOD_BOUNDS},
${ENTITY_TXN_VOLUMES_CTE},
entity_product_detail AS (
  SELECT
    sf.scope_label,
    sf.entity_category,
    sf.entity_name,
    sf.product_name,
    sf.product_display_name,
    COUNT(*)::int AS txn_count,
    SUM(sf.transaction_volume) AS transaction_volume
  FROM scope_filtered sf
  GROUP BY
    sf.scope_label,
    sf.entity_category,
    sf.entity_name,
    sf.product_name,
    sf.product_display_name
)
SELECT
  pb.period_start,
  pb.period_end,
  COALESCE(bh.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pe.name, '(Root)') AS parent_entity_name,
  epd.scope_label,
  epd.entity_category,
  epd.entity_name,
  epd.product_name,
  epd.product_display_name,
  epd.txn_count,
  epd.transaction_volume
FROM entity_product_detail epd
CROSS JOIN period_bounds pb
LEFT JOIN entities_deduped e ON e.name = epd.entity_name AND e.entity_category = epd.entity_category
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
  epd.entity_name,
  epd.transaction_volume DESC NULLS LAST,
  epd.product_name
`

function stripOptionalBlocks(sql: string): string {
  return sql.replace(/\[\[[\s\S]*?\]\]/g, '')
}

async function validateReports(dateFilters: Record<string, string>) {
  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) throw new Error('No active datasource')

  const reports = [
    ['Transaction Summary', TRANSACTION_SUMMARY],
    ['Transaction Detail by product', TRANSACTION_DETAIL_BY_PRODUCT],
    ['Transaction Detail by entity and product', TRANSACTION_DETAIL_BY_ENTITY_PRODUCT],
  ] as const

  for (const [name, sql] of reports) {
    const t0 = Date.now()
    const cleaned = applySqlFilters(stripOptionalBlocks(sql), dateFilters)
    const result = await executeDataSourceQuery(ds.id, cleaned)
    const totalVolume = result.rows.reduce((sum, row) => sum + Number(row.transaction_volume ?? 0), 0)
    const totalTxns = result.rows.reduce((sum, row) => sum + Number(row.txn_count ?? 0), 0)

    console.log(`\n=== ${name} (${Date.now() - t0}ms, ${result.rows.length} rows) ===`)
    if (result.rows.length > 0) {
      console.log(
        'period:',
        result.rows[0]?.period_start,
        '→',
        result.rows[0]?.period_end,
        '| txn count:',
        totalTxns,
        '| volume:',
        totalVolume.toFixed(2),
      )
    }
    console.log(JSON.stringify(result.rows.slice(0, 8), null, 2))
  }

  return ds.id
}

async function validateScopedFilters(dataSourceId: string, dateFilters: Record<string, string>) {
  const scopes = [
    ['entityName=Customer', { ...dateFilters, entityName: 'Customer' }],
    ['entityCategory=AGENT', { ...dateFilters, entityCategory: 'AGENT' }],
    ['entityName=Merchant', { ...dateFilters, entityName: 'Merchant' }],
  ] as const

  for (const [label, filters] of scopes) {
    const cleaned = applySqlFilters(stripOptionalBlocks(TRANSACTION_SUMMARY), filters)
    const result = await executeDataSourceQuery(dataSourceId, cleaned)
    console.log(`\n--- Summary (${label}, ${result.rows.length} rows) ---`)
    console.log(JSON.stringify(result.rows, null, 2))
  }
}

async function seedReports(dataSourceId: string) {
  const owner = await prisma.user.findFirst({
    where: { userType: 'OWNER' },
    select: { id: true },
  })

  const definitions = [
    {
      name: '[Transaction] - Summary by scope',
      description:
        'Successful EMoney pouch transaction count and volume for the selected date range. Default view shows Customer and Agent totals. Optional filters: entityCategory (e.g. CUSTOMER, AGENT, MERCHANT) or entityName for any specific entity. Counts distinct business transactions per entity; volume dedupes multiple ledger legs on the same transaction_id.',
      category: ReportCategory.OPERATIONAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: TRANSACTION_SUMMARY.trim(),
    },
    {
      name: '[Transaction] - Detail by product',
      description:
        'EMoney pouch product-level transaction count and volume within each scope (Customer, Agent, or filtered entity) for the selected date range. Use entityCategory or entityName to narrow scope; default shows Customer and Agent product mix.',
      category: ReportCategory.OPERATIONAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: TRANSACTION_DETAIL_BY_PRODUCT.trim(),
    },
    {
      name: '[Transaction] - Detail by entity and product',
      description:
        'EMoney pouch product breakdown with hierarchy and entity name on each row. Intended for entityCategory or entityName filters (e.g. all AGENT entities or one Merchant entity). Without filters, lists every entity that had activity in the period.',
      category: ReportCategory.OPERATIONAL,
      visualization: ReportVisualization.TABLE_ONLY,
      sql: TRANSACTION_DETAIL_BY_ENTITY_PRODUCT.trim(),
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

  if (process.argv.includes('--scoped')) {
    await validateScopedFilters(dataSourceId, dateFilters)
  }

  if (process.argv.includes('--seed')) {
    await seedReports(dataSourceId)
  }

  await prisma.$disconnect()
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (process.argv.includes('--print-sql')) {
    console.log('-- TRANSACTION_SUMMARY --')
    console.log(TRANSACTION_SUMMARY.trim())
    console.log('\n-- TRANSACTION_DETAIL_BY_PRODUCT --')
    console.log(TRANSACTION_DETAIL_BY_PRODUCT.trim())
    console.log('\n-- TRANSACTION_DETAIL_BY_ENTITY_PRODUCT --')
    console.log(TRANSACTION_DETAIL_BY_ENTITY_PRODUCT.trim())
  } else {
    run().catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
