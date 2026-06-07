import 'dotenv/config'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'
import { applySqlFilters } from '../src/reports/sqlFilters.ts'

/** Prefer Active profile when the same mobile exists in multiple profile tables or rows. */
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

/** Customer wallet balances live on entity "Customer" — use Customer hierarchy, not the user's agent hierarchy. */
const CUSTOMER_HIERARCHY_CTES = `
customer_entity AS (
  SELECT id FROM entities_d WHERE name = 'Customer' LIMIT 1
),
customer_hierarchy AS (
  SELECT id FROM hierarchies_d WHERE name = 'Customer' LIMIT 1
)`

const ENTITY_BALANCE_SUMMARY = `
WITH entities_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM entities
  WHERE deleted_at IS NULL
  ORDER BY id
),
hierarchies_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM business_hierarchies
  WHERE deleted_at IS NULL
  ORDER BY id
),
pouches_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM pouches
  WHERE deleted_at IS NULL
  ORDER BY id
),
latest_balances AS (
  SELECT DISTINCT ON (t.user_identifier, t.entity_id, t.pouch_id)
    t.user_identifier,
    t.entity_id,
    t.pouch_id,
    t.after_balance::numeric AS latest_balance
  FROM transactions t
  WHERE t.deleted_at IS NULL
    AND t.after_balance IS NOT NULL
    AND t.user_identifier IS NOT NULL
    AND t.created_at < CAST(:dateToExclusive AS timestamp)
  ORDER BY t.user_identifier, t.entity_id, t.pouch_id, t.created_at DESC, t.id DESC
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
${CUSTOMER_HIERARCHY_CTES}
SELECT
  :dateTo AS as_at_date,
  COALESCE(h.name, 'Unassigned') AS hierarchy_name,
  e.name AS entity_name,
  p.name AS pouch_name,
  l.pouch_id,
  COUNT(*) AS user_count,
  COUNT(*) FILTER (WHERE l.latest_balance = 0) AS zero_balance_users,
  SUM(l.latest_balance) AS total_balance
FROM latest_balances l
INNER JOIN entities_d e ON e.id = l.entity_id
INNER JOIN pouches_d p ON p.id = l.pouch_id
CROSS JOIN customer_entity ce
CROSS JOIN customer_hierarchy ch
LEFT JOIN user_ctx u ON u.mobile = l.user_identifier
LEFT JOIN hierarchies_d h ON h.id = CASE WHEN l.entity_id = ce.id THEN ch.id ELSE u.hierarchy_id END
GROUP BY h.name, e.name, p.name, l.pouch_id
ORDER BY
  CASE WHEN COALESCE(h.name, 'Unassigned') = 'Unassigned' THEN 1 ELSE 0 END,
  COALESCE(h.name, 'Unassigned'),
  e.name,
  p.name
`

const USER_BALANCE_DETAIL = `
WITH entities_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM entities
  WHERE deleted_at IS NULL
  ORDER BY id
),
hierarchies_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM business_hierarchies
  WHERE deleted_at IS NULL
  ORDER BY id
),
pouches_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM pouches
  WHERE deleted_at IS NULL
  ORDER BY id
),
latest_balances AS (
  SELECT DISTINCT ON (t.user_identifier, t.entity_id, t.pouch_id)
    t.user_identifier,
    t.entity_id,
    t.pouch_id,
    t.after_balance::numeric AS latest_balance,
    t.created_at AS balance_as_of
  FROM transactions t
  WHERE t.deleted_at IS NULL
    AND t.after_balance IS NOT NULL
    AND t.user_identifier IS NOT NULL
  ORDER BY t.user_identifier, t.entity_id, t.pouch_id, t.created_at DESC, t.id DESC
),
all_profiles AS (
  SELECT
    'agent'::text AS profile_type,
    au.mobile,
    au.user_id,
    au.entity_id AS profile_entity_id,
    u.status AS user_status,
    COALESCE(au.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL AND au.mobile IS NOT NULL
  UNION ALL
  SELECT 'customer', cu.mobile, cu.user_id, cu.entity_id, u.status, u.business_hierarchy_id
  FROM customer_users cu
  LEFT JOIN users u ON u.id = cu.user_id
  WHERE cu.deleted_at IS NULL AND cu.mobile IS NOT NULL
  UNION ALL
  SELECT 'merchant', mu.mobile, mu.user_id, mu.entity_id, u.status, COALESCE(mu.business_hierarchy_id, u.business_hierarchy_id)
  FROM merchant_users mu
  LEFT JOIN users u ON u.id = mu.user_id
  WHERE mu.deleted_at IS NULL AND mu.mobile IS NOT NULL
  UNION ALL
  SELECT 'enterprise', eu.mobile, eu.user_id, eu.entity_id, u.status, COALESCE(eu.business_hierarchy_id, u.business_hierarchy_id)
  FROM enterprise_users eu
  LEFT JOIN users u ON u.id = eu.user_id
  WHERE eu.deleted_at IS NULL AND eu.mobile IS NOT NULL
  UNION ALL
  SELECT 'vendor', vu.mobile, vu.user_id, NULL::bigint, u.status, u.business_hierarchy_id
  FROM vendor_users vu
  LEFT JOIN users u ON u.id = vu.user_id
  WHERE vu.deleted_at IS NULL AND vu.mobile IS NOT NULL
  UNION ALL
  SELECT 'operational', ou.mobile, ou.user_id, NULL::bigint, u.status, u.business_hierarchy_id
  FROM operational_users ou
  LEFT JOIN users u ON u.id = ou.user_id
  WHERE ou.deleted_at IS NULL AND ou.mobile IS NOT NULL
),
profile_ctx AS (
  SELECT DISTINCT ON (mobile)
    profile_type,
    mobile,
    user_id,
    profile_entity_id,
    user_status,
    hierarchy_id
  FROM all_profiles
  ORDER BY mobile, ${PROFILE_DEDUPE_ORDER}
),
${CUSTOMER_HIERARCHY_CTES}
SELECT
  COALESCE(h.name, 'Unassigned') AS hierarchy_name,
  e.name AS entity_name,
  p.name AS pouch_name,
  l.user_identifier AS mobile,
  pr.user_id,
  CASE WHEN l.entity_id = ce.id THEN 'customer' ELSE COALESCE(pr.profile_type, 'unknown') END AS profile_type,
  COALESCE(pr.user_status, 'No user record') AS user_status,
  l.latest_balance,
  l.balance_as_of
FROM latest_balances l
INNER JOIN entities_d e ON e.id = l.entity_id
INNER JOIN pouches_d p ON p.id = l.pouch_id
CROSS JOIN customer_entity ce
CROSS JOIN customer_hierarchy ch
LEFT JOIN profile_ctx pr ON pr.mobile = l.user_identifier
LEFT JOIN hierarchies_d h ON h.id = CASE WHEN l.entity_id = ce.id THEN ch.id ELSE pr.hierarchy_id END
ORDER BY
  CASE WHEN COALESCE(h.name, 'Unassigned') = 'Unassigned' THEN 1 ELSE 0 END,
  COALESCE(h.name, 'Unassigned'),
  e.name,
  l.user_identifier,
  p.name
`

const NON_TX_SUMMARY = `
WITH transacting AS (
  SELECT user_identifier AS key
  FROM transactions
  WHERE deleted_at IS NULL
    AND user_identifier IS NOT NULL
  GROUP BY 1
),
entities_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM entities
  WHERE deleted_at IS NULL
  ORDER BY id
),
hierarchies_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM business_hierarchies
  WHERE deleted_at IS NULL
  ORDER BY id
),
all_profiles AS (
  SELECT
    'agent'::text AS profile_type,
    au.mobile,
    au.user_id,
    au.entity_id,
    u.status AS user_status,
    COALESCE(au.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL AND au.mobile IS NOT NULL

  UNION ALL

  SELECT
    'customer'::text,
    cu.mobile,
    cu.user_id,
    cu.entity_id,
    u.status,
    u.business_hierarchy_id
  FROM customer_users cu
  LEFT JOIN users u ON u.id = cu.user_id
  WHERE cu.deleted_at IS NULL AND cu.mobile IS NOT NULL

  UNION ALL

  SELECT
    'merchant'::text,
    mu.mobile,
    mu.user_id,
    mu.entity_id,
    u.status,
    COALESCE(mu.business_hierarchy_id, u.business_hierarchy_id)
  FROM merchant_users mu
  LEFT JOIN users u ON u.id = mu.user_id
  WHERE mu.deleted_at IS NULL AND mu.mobile IS NOT NULL

  UNION ALL

  SELECT
    'enterprise'::text,
    eu.mobile,
    eu.user_id,
    eu.entity_id,
    u.status,
    COALESCE(eu.business_hierarchy_id, u.business_hierarchy_id)
  FROM enterprise_users eu
  LEFT JOIN users u ON u.id = eu.user_id
  WHERE eu.deleted_at IS NULL AND eu.mobile IS NOT NULL

  UNION ALL

  SELECT
    'vendor'::text,
    vu.mobile,
    vu.user_id,
    NULL::bigint,
    u.status,
    u.business_hierarchy_id
  FROM vendor_users vu
  LEFT JOIN users u ON u.id = vu.user_id
  WHERE vu.deleted_at IS NULL AND vu.mobile IS NOT NULL

  UNION ALL

  SELECT
    'operational'::text,
    ou.mobile,
    ou.user_id,
    NULL::bigint,
    u.status,
    u.business_hierarchy_id
  FROM operational_users ou
  LEFT JOIN users u ON u.id = ou.user_id
  WHERE ou.deleted_at IS NULL AND ou.mobile IS NOT NULL
),
deduped AS (
  SELECT DISTINCT ON (mobile)
    profile_type,
    mobile,
    user_id,
    entity_id,
    hierarchy_id
  FROM all_profiles
  ORDER BY mobile, ${PROFILE_DEDUPE_ORDER}
),
non_transacting AS (
  SELECT d.*
  FROM deduped d
  LEFT JOIN transacting t ON t.key = d.mobile
  WHERE t.key IS NULL
)
SELECT
  n.profile_type,
  COALESCE(h.name, 'Unassigned') AS hierarchy_name,
  COALESCE(e.name, '(No entity on profile)') AS entity_name,
  COUNT(*) AS non_transacting_count
FROM non_transacting n
LEFT JOIN entities_d e ON e.id = n.entity_id
LEFT JOIN hierarchies_d h ON h.id = n.hierarchy_id
GROUP BY n.profile_type, h.name, e.name
ORDER BY
  CASE WHEN COALESCE(h.name, 'Unassigned') = 'Unassigned' THEN 1 ELSE 0 END,
  COALESCE(h.name, 'Unassigned'),
  COALESCE(e.name, '(No entity on profile)'),
  n.profile_type
`

const NON_TX_DETAIL = `
WITH transacting AS (
  SELECT user_identifier AS key
  FROM transactions
  WHERE deleted_at IS NULL
    AND user_identifier IS NOT NULL
  GROUP BY 1
),
entities_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM entities
  WHERE deleted_at IS NULL
  ORDER BY id
),
hierarchies_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM business_hierarchies
  WHERE deleted_at IS NULL
  ORDER BY id
),
pouches_d AS (
  SELECT DISTINCT ON (id) id, name
  FROM pouches
  WHERE deleted_at IS NULL
  ORDER BY id
),
latest_balances AS (
  SELECT DISTINCT ON (t.user_identifier, t.entity_id, t.pouch_id)
    t.user_identifier,
    t.entity_id,
    t.pouch_id,
    t.after_balance::numeric AS latest_balance,
    t.created_at AS balance_as_of
  FROM transactions t
  WHERE t.deleted_at IS NULL
    AND t.after_balance IS NOT NULL
    AND t.user_identifier IS NOT NULL
  ORDER BY t.user_identifier, t.entity_id, t.pouch_id, t.created_at DESC, t.id DESC
),
all_profiles AS (
  SELECT
    'agent'::text AS profile_type,
    au.mobile,
    au.user_id,
    au.entity_id,
    u.status AS user_status,
    COALESCE(au.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL AND au.mobile IS NOT NULL

  UNION ALL

  SELECT
    'customer'::text,
    cu.mobile,
    cu.user_id,
    cu.entity_id,
    u.status,
    u.business_hierarchy_id
  FROM customer_users cu
  LEFT JOIN users u ON u.id = cu.user_id
  WHERE cu.deleted_at IS NULL AND cu.mobile IS NOT NULL

  UNION ALL

  SELECT
    'merchant'::text,
    mu.mobile,
    mu.user_id,
    mu.entity_id,
    u.status,
    COALESCE(mu.business_hierarchy_id, u.business_hierarchy_id)
  FROM merchant_users mu
  LEFT JOIN users u ON u.id = mu.user_id
  WHERE mu.deleted_at IS NULL AND mu.mobile IS NOT NULL

  UNION ALL

  SELECT
    'enterprise'::text,
    eu.mobile,
    eu.user_id,
    eu.entity_id,
    u.status,
    COALESCE(eu.business_hierarchy_id, u.business_hierarchy_id)
  FROM enterprise_users eu
  LEFT JOIN users u ON u.id = eu.user_id
  WHERE eu.deleted_at IS NULL AND eu.mobile IS NOT NULL

  UNION ALL

  SELECT
    'vendor'::text,
    vu.mobile,
    vu.user_id,
    NULL::bigint,
    u.status,
    u.business_hierarchy_id
  FROM vendor_users vu
  LEFT JOIN users u ON u.id = vu.user_id
  WHERE vu.deleted_at IS NULL AND vu.mobile IS NOT NULL

  UNION ALL

  SELECT
    'operational'::text,
    ou.mobile,
    ou.user_id,
    NULL::bigint,
    u.status,
    u.business_hierarchy_id
  FROM operational_users ou
  LEFT JOIN users u ON u.id = ou.user_id
  WHERE ou.deleted_at IS NULL AND ou.mobile IS NOT NULL
),
deduped AS (
  SELECT DISTINCT ON (mobile)
    profile_type,
    mobile,
    user_id,
    entity_id,
    user_status,
    hierarchy_id
  FROM all_profiles
  ORDER BY mobile, ${PROFILE_DEDUPE_ORDER}
),
non_transacting AS (
  SELECT d.*
  FROM deduped d
  LEFT JOIN transacting t ON t.key = d.mobile
  WHERE t.key IS NULL
)
SELECT
  n.profile_type,
  n.mobile,
  n.user_id,
  COALESCE(n.user_status, 'No user record') AS user_status,
  COALESCE(h.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pe.name, '(No entity on profile)') AS entity_name,
  p.id AS pouch_id,
  p.name AS pouch_name,
  COALESCE(lb.latest_balance, 0) AS current_balance,
  lb.balance_as_of,
  COALESCE(be.name, '(No wallet activity)') AS balance_entity_name
FROM non_transacting n
CROSS JOIN pouches_d p
LEFT JOIN entities_d pe ON pe.id = n.entity_id
LEFT JOIN hierarchies_d h ON h.id = n.hierarchy_id
LEFT JOIN latest_balances lb
  ON lb.user_identifier = n.mobile
  AND lb.pouch_id = p.id
  AND (n.entity_id IS NULL OR lb.entity_id = n.entity_id)
LEFT JOIN entities_d be ON be.id = lb.entity_id
ORDER BY
  CASE WHEN COALESCE(h.name, 'Unassigned') = 'Unassigned' THEN 1 ELSE 0 END,
  COALESCE(h.name, 'Unassigned'),
  COALESCE(pe.name, '(No entity on profile)'),
  n.mobile,
  p.id
`

function stripOptionalBlocks(sql: string): string {
  return sql.replace(/\[\[[\s\S]*?\]\]/g, '')
}

async function run() {
  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) throw new Error('No active datasource')

  const reports = [
    ['Entity Balance Summary', ENTITY_BALANCE_SUMMARY],
    ['User Balance Detail', USER_BALANCE_DETAIL],
    ['Non-Transacting Summary', NON_TX_SUMMARY],
    ['Non-Transacting Detail', NON_TX_DETAIL],
  ] as const

  for (const [name, sql] of reports) {
    const t0 = Date.now()
    let cleaned = stripOptionalBlocks(sql)
    if (name === 'Entity Balance Summary') {
      cleaned = applySqlFilters(cleaned, {
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
      })
    }
    const result = await executeDataSourceQuery(ds.id, cleaned)
    console.log(`\n=== ${name} (${Date.now() - t0}ms, ${result.rows.length} rows) ===`)
    console.log(JSON.stringify(result.rows.slice(0, 3), null, 2))
    if (name === 'Entity Balance Summary') {
      const totalUsers = result.rows.reduce(
        (sum, r) => sum + Number(r.user_count ?? 0),
        0,
      )
      console.log('sum user_count across groups:', totalUsers)
      console.log('has user_status column:', 'user_status' in (result.rows[0] ?? {}))
    }
    if (name === 'Non-Transacting Summary') {
      console.log('has user_status column:', 'user_status' in (result.rows[0] ?? {}))
    }
    if (name === 'User Balance Detail') {
      const sample = result.rows.find((r) => String(r.mobile) === '2015645')
      if (sample) console.log('multi-profile mobile 2015645:', sample)
    }
  }

  await prisma.$disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
