import 'dotenv/config'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'
import { applySqlFilters } from '../src/reports/sqlFilters.ts'

const SHARED_DIM_CTES = `
agent_by_mobile AS (
  SELECT DISTINCT ON (au.mobile)
    au.mobile,
    au.id AS agent_profile_id,
    au.user_id,
    au.entity_id AS agent_entity_id,
    COALESCE(au.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id,
    COALESCE(
      au.full_name,
      NULLIF(TRIM(COALESCE(au.firstname, '') || ' ' || COALESCE(au.lastname, '')), '')
    ) AS profile_name
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL
    AND au.mobile IS NOT NULL
  ORDER BY au.mobile, au.id DESC
),
entities_deduped AS (
  SELECT DISTINCT ON (e.id) e.id, e.name, e.entity_category
  FROM entities e
  WHERE e.deleted_at IS NULL
  ORDER BY e.id
),
hierarchies_deduped AS (
  SELECT DISTINCT ON (bh.id) bh.id, bh.name
  FROM business_hierarchies bh
  WHERE bh.deleted_at IS NULL
  ORDER BY bh.id
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
)`

function periodReleaseCtes(productId: number, serviceId: number): string {
  return `
period_bounds AS (
  SELECT
    CAST(:dateFrom AS date) AS period_start,
    CAST(:dateTo AS date) AS period_end,
    (
      CAST(:dateFrom AS date)
      - ((CAST(:dateTo AS date) - CAST(:dateFrom AS date)) + 1) * interval '1 day'
    )::date AS previous_period_start,
    (CAST(:dateFrom AS date) - interval '1 day')::date AS previous_period_end
),
release_txs_current AS (
  SELECT
    t.id,
    t.user_identifier,
    t.entity_id,
    t.service_id,
    t.product_id,
    t.transaction_amount::numeric AS amount,
    t.created_at
  FROM transactions t
  WHERE t.deleted_at IS NULL
    AND t.product_id = ${productId}
    AND t.service_id = ${serviceId}
    AND t.status = 'SUCCESS'
    AND t.transaction_type = 'CR'
    AND t.created_at >= CAST(:dateFrom AS timestamp)
    AND t.created_at < CAST(:dateToExclusive AS timestamp)
),
release_txs_previous AS (
  SELECT
    t.id,
    t.user_identifier,
    t.entity_id,
    t.service_id,
    t.product_id,
    t.transaction_amount::numeric AS amount,
    t.created_at
  FROM transactions t
  CROSS JOIN period_bounds pb
  WHERE t.deleted_at IS NULL
    AND t.product_id = ${productId}
    AND t.service_id = ${serviceId}
    AND t.status = 'SUCCESS'
    AND t.transaction_type = 'CR'
    AND t.created_at >= pb.previous_period_start::timestamp
    AND t.created_at < CAST(:dateFrom AS timestamp)
),
user_releases_current AS (
  SELECT
    user_identifier,
    entity_id,
    service_id,
    product_id,
    COUNT(*)::int AS release_count,
    SUM(amount) AS total_released
  FROM release_txs_current
  GROUP BY 1, 2, 3, 4
),
user_releases_previous AS (
  SELECT
    user_identifier,
    entity_id,
    service_id,
    product_id,
    COUNT(*)::int AS release_count,
    SUM(amount) AS total_released
  FROM release_txs_previous
  GROUP BY 1, 2, 3, 4
),
period_releases AS (
  SELECT
    COALESCE(c.user_identifier, p.user_identifier) AS user_identifier,
    COALESCE(c.entity_id, p.entity_id) AS entity_id,
    COALESCE(c.service_id, p.service_id) AS service_id,
    COALESCE(c.product_id, p.product_id) AS product_id,
    COALESCE(p.release_count, 0) AS previous_release_count,
    COALESCE(c.release_count, 0) AS current_release_count,
    COALESCE(p.total_released, 0) AS total_previous_released,
    COALESCE(c.total_released, 0) AS total_current_released
  FROM user_releases_current c
  FULL OUTER JOIN user_releases_previous p
    ON c.user_identifier = p.user_identifier
    AND c.entity_id = p.entity_id
    AND c.service_id = p.service_id
    AND c.product_id = p.product_id
)`
}

function userPeriodSelect(extraWhere = ''): string {
  return `
SELECT
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  COALESCE(bh.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pe.name, '(Root)') AS parent_entity_name,
  COALESCE(e.name, 'Unassigned') AS entity_name,
  e.entity_category,
  COALESCE(s.display_name, s.name) AS service_name,
  s.service_type,
  COALESCE(p.display_name, p.name) AS product_name,
  abm.user_id,
  abm.agent_profile_id,
  pr.user_identifier,
  COALESCE(abm.profile_name, pr.user_identifier) AS user_name,
  pr.previous_release_count,
  pr.current_release_count,
  pr.total_previous_released,
  pr.total_current_released,
  pr.total_current_released - pr.total_previous_released AS release_change
FROM period_releases pr
CROSS JOIN period_bounds pb
LEFT JOIN agent_by_mobile abm ON abm.mobile = pr.user_identifier
LEFT JOIN entities_deduped e ON e.id = COALESCE(abm.agent_entity_id, pr.entity_id)
LEFT JOIN services_deduped s ON s.id = pr.service_id
LEFT JOIN products_deduped p ON p.id = pr.product_id
LEFT JOIN hierarchies_deduped bh ON bh.id = abm.hierarchy_id
LEFT JOIN LATERAL (
  SELECT bhe.parent_entity_id
  FROM business_hierarchy_entities bhe
  WHERE bhe.business_hierarchy_id = bh.id
    AND bhe.entity_id = e.id
  ORDER BY bhe.id
  LIMIT 1
) bhe ON true
LEFT JOIN entities_deduped pe ON pe.id = bhe.parent_entity_id
WHERE 1 = 1
  ${extraWhere}
ORDER BY
  CASE WHEN COALESCE(bh.name, 'Unassigned') = 'Unassigned' THEN 1 ELSE 0 END,
  COALESCE(bh.name, 'Unassigned'),
  e.name,
  pr.total_current_released DESC`
}

function rollupPeriodSelect(extraWhere = ''): string {
  return `
SELECT
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  COALESCE(bh.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pe.name, '(Root)') AS parent_entity_name,
  COALESCE(e.name, 'Unassigned') AS entity_name,
  e.entity_category,
  COALESCE(s.display_name, s.name) AS service_name,
  COALESCE(p.display_name, p.name) AS product_name,
  COUNT(DISTINCT abm.user_id) AS users_with_releases,
  SUM(pr.previous_release_count)::int AS previous_release_count,
  SUM(pr.current_release_count)::int AS current_release_count,
  SUM(pr.total_previous_released) AS total_previous_released,
  SUM(pr.total_current_released) AS total_current_released,
  SUM(pr.total_current_released) - SUM(pr.total_previous_released) AS release_change
FROM period_releases pr
CROSS JOIN period_bounds pb
LEFT JOIN agent_by_mobile abm ON abm.mobile = pr.user_identifier
LEFT JOIN entities_deduped e ON e.id = COALESCE(abm.agent_entity_id, pr.entity_id)
LEFT JOIN services_deduped s ON s.id = pr.service_id
LEFT JOIN products_deduped p ON p.id = pr.product_id
LEFT JOIN hierarchies_deduped bh ON bh.id = abm.hierarchy_id
LEFT JOIN LATERAL (
  SELECT bhe.parent_entity_id
  FROM business_hierarchy_entities bhe
  WHERE bhe.business_hierarchy_id = bh.id
    AND bhe.entity_id = e.id
  ORDER BY bhe.id LIMIT 1
) bhe ON true
LEFT JOIN entities_deduped pe ON pe.id = bhe.parent_entity_id
WHERE 1 = 1
  ${extraWhere}
GROUP BY
  pb.period_start,
  pb.period_end,
  pb.previous_period_start,
  pb.previous_period_end,
  bh.name,
  pe.name,
  e.name,
  e.entity_category,
  s.display_name,
  s.name,
  p.display_name,
  p.name
ORDER BY
  CASE WHEN COALESCE(bh.name, 'Unassigned') = 'Unassigned' THEN 1 ELSE 0 END,
  COALESCE(bh.name, 'Unassigned'),
  e.name,
  total_current_released DESC`
}

function buildUserReport(productId: number, serviceId: number, extraWhere = ''): string {
  return `
WITH ${periodReleaseCtes(productId, serviceId)},
${SHARED_DIM_CTES}
${userPeriodSelect(extraWhere)}
`
}

function buildRollupReport(productId: number, serviceId: number, extraWhere = ''): string {
  return `
WITH ${periodReleaseCtes(productId, serviceId)},
${SHARED_DIM_CTES}
${rollupPeriodSelect(extraWhere)}
`
}

/** Monthly Commission Release — product 21 / service 11 */
export const MONTHLY_COMMISSION_USER = buildUserReport(
  21,
  11,
  `[[AND bh.name = :hierarchyName?]]
  [[AND e.name = :entityName?]]
  [[AND abm.user_id = :userId?]]`,
)

export const MONTHLY_COMMISSION_ROLLUP = buildRollupReport(21, 11)

/** Daily Commission Release — product 51 / service 17 */
export const DAILY_COMMISSION_USER = buildUserReport(
  51,
  17,
  `[[AND bh.name = :hierarchyName?]]
  [[AND e.name = :entityName?]]
  [[AND abm.user_id = :userId?]]`,
)

export const DAILY_COMMISSION_ROLLUP = buildRollupReport(51, 17)

/** Current-period transaction detail (unchanged grain — no period comparison). */
export const MONTHLY_COMMISSION_DETAIL = `
WITH ${SHARED_DIM_CTES}
SELECT
  t.id AS transaction_row_id,
  t.transaction_id,
  t.sub_transaction_id,
  DATE_TRUNC('month', t.created_at)::date AS release_month,
  t.created_at AS release_date,
  COALESCE(bh.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pe.name, '(Root)') AS parent_entity_name,
  COALESCE(e.name, 'Unassigned') AS entity_name,
  COALESCE(s.display_name, s.name) AS service_name,
  s.service_type,
  COALESCE(p.display_name, p.name) AS product_name,
  abm.user_id,
  abm.agent_profile_id,
  t.user_identifier,
  COALESCE(abm.profile_name, t.user_identifier) AS user_name,
  t.transaction_type,
  t.transaction_amount::numeric AS commission_released,
  t.status,
  t.remarks
FROM transactions t
LEFT JOIN agent_by_mobile abm ON abm.mobile = t.user_identifier
LEFT JOIN entities_deduped e ON e.id = COALESCE(abm.agent_entity_id, t.entity_id)
LEFT JOIN services_deduped s ON s.id = t.service_id
LEFT JOIN products_deduped p ON p.id = t.product_id
LEFT JOIN hierarchies_deduped bh ON bh.id = abm.hierarchy_id
LEFT JOIN LATERAL (
  SELECT bhe.parent_entity_id
  FROM business_hierarchy_entities bhe
  WHERE bhe.business_hierarchy_id = bh.id AND bhe.entity_id = e.id
  ORDER BY bhe.id LIMIT 1
) bhe ON true
LEFT JOIN entities_deduped pe ON pe.id = bhe.parent_entity_id
WHERE t.deleted_at IS NULL
  AND t.product_id = 21
  AND t.service_id = 11
  AND t.status = 'SUCCESS'
  AND t.transaction_type = 'CR'
  AND t.created_at >= CAST(:dateFrom AS timestamp)
  AND t.created_at < CAST(:dateToExclusive AS timestamp)
  [[AND bh.name = :hierarchyName?]]
  [[AND e.name = :entityName?]]
ORDER BY t.created_at DESC, t.transaction_amount::numeric DESC
`

export const DAILY_COMMISSION_DETAIL = `
WITH ${SHARED_DIM_CTES}
SELECT
  t.id AS transaction_row_id,
  t.transaction_id,
  t.sub_transaction_id,
  t.created_at::date AS release_day,
  t.created_at AS release_date,
  COALESCE(bh.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pe.name, '(Root)') AS parent_entity_name,
  COALESCE(e.name, 'Unassigned') AS entity_name,
  COALESCE(s.display_name, s.name) AS service_name,
  s.service_type,
  COALESCE(p.display_name, p.name) AS product_name,
  abm.user_id,
  abm.agent_profile_id,
  t.user_identifier,
  COALESCE(abm.profile_name, t.user_identifier) AS user_name,
  t.transaction_type,
  t.transaction_amount::numeric AS commission_released,
  t.status,
  t.remarks
FROM transactions t
LEFT JOIN agent_by_mobile abm ON abm.mobile = t.user_identifier
LEFT JOIN entities_deduped e ON e.id = COALESCE(abm.agent_entity_id, t.entity_id)
LEFT JOIN services_deduped s ON s.id = t.service_id
LEFT JOIN products_deduped p ON p.id = t.product_id
LEFT JOIN hierarchies_deduped bh ON bh.id = abm.hierarchy_id
LEFT JOIN LATERAL (
  SELECT bhe.parent_entity_id
  FROM business_hierarchy_entities bhe
  WHERE bhe.business_hierarchy_id = bh.id AND bhe.entity_id = e.id
  ORDER BY bhe.id LIMIT 1
) bhe ON true
LEFT JOIN entities_deduped pe ON pe.id = bhe.parent_entity_id
WHERE t.deleted_at IS NULL
  AND t.product_id = 51
  AND t.service_id = 17
  AND t.status = 'SUCCESS'
  AND t.transaction_type = 'CR'
  AND t.created_at >= CAST(:dateFrom AS timestamp)
  AND t.created_at < CAST(:dateToExclusive AS timestamp)
  [[AND bh.name = :hierarchyName?]]
  [[AND e.name = :entityName?]]
ORDER BY t.created_at DESC, t.transaction_amount::numeric DESC
`

function stripOptionalBlocks(sql: string): string {
  return sql.replace(/\[\[[\s\S]*?\]\]/g, '')
}

async function run() {
  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) throw new Error('No active datasource')

  const dateFilters = {
    dateFrom: '2026-05-01',
    dateTo: '2026-05-31',
  }

  const reports = [
    ['Monthly Commission — by user', MONTHLY_COMMISSION_USER],
    ['Monthly Commission — rollup', MONTHLY_COMMISSION_ROLLUP],
    ['Daily Commission — by user', DAILY_COMMISSION_USER],
    ['Daily Commission — rollup', DAILY_COMMISSION_ROLLUP],
  ] as const

  for (const [name, sql] of reports) {
    const t0 = Date.now()
    const cleaned = applySqlFilters(stripOptionalBlocks(sql), dateFilters)
    const result = await executeDataSourceQuery(ds.id, cleaned)
    const withChange = result.rows.filter(
      (r) => Number(r.total_previous_released) !== Number(r.total_current_released),
    )
    const totals = result.rows.reduce(
      (acc, r) => ({
        prev: acc.prev + Number(r.total_previous_released ?? 0),
        cur: acc.cur + Number(r.total_current_released ?? 0),
      }),
      { prev: 0, cur: 0 },
    )
    console.log(`\n=== ${name} (${Date.now() - t0}ms, ${result.rows.length} rows) ===`)
    console.log(
      'period:',
      result.rows[0]?.period_start,
      '→',
      result.rows[0]?.period_end,
      '| previous period:',
      result.rows[0]?.previous_period_start,
      '→',
      result.rows[0]?.previous_period_end,
    )
    console.log(
      'totals — previous:',
      totals.prev.toFixed(2),
      'current:',
      totals.cur.toFixed(2),
      '| rows with change:',
      withChange.length,
    )
    console.log('top current:', JSON.stringify(result.rows.slice(0, 2), null, 2))
  }

  await prisma.$disconnect()
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (process.argv.includes('--print-sql')) {
    console.log('-- MONTHLY_COMMISSION_USER --')
    console.log(MONTHLY_COMMISSION_USER.trim())
    console.log('\n-- MONTHLY_COMMISSION_ROLLUP --')
    console.log(MONTHLY_COMMISSION_ROLLUP.trim())
    console.log('\n-- DAILY_COMMISSION_USER --')
    console.log(DAILY_COMMISSION_USER.trim())
    console.log('\n-- DAILY_COMMISSION_ROLLUP --')
    console.log(DAILY_COMMISSION_ROLLUP.trim())
  } else {
    run().catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
