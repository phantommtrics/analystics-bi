import 'dotenv/config'
import { prisma } from '../src/prisma.ts'
import { executeDataSourceQuery } from '../src/datasources/service.ts'

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
  ORDER BY t.user_identifier, t.entity_id, t.pouch_id, t.created_at DESC, t.id DESC
),
agent_ctx AS (
  SELECT DISTINCT ON (au.mobile)
    au.mobile,
    u.status AS user_status,
    COALESCE(au.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL
    AND au.mobile IS NOT NULL
  ORDER BY au.mobile, au.id DESC
),
all_profiles AS (
  SELECT 'agent'::text AS profile_type, au.mobile, u.status AS user_status
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL AND au.mobile IS NOT NULL
  UNION ALL
  SELECT 'customer', cu.mobile, u.status
  FROM customer_users cu
  LEFT JOIN users u ON u.id = cu.user_id
  WHERE cu.deleted_at IS NULL AND cu.mobile IS NOT NULL
  UNION ALL
  SELECT 'merchant', mu.mobile, u.status
  FROM merchant_users mu
  LEFT JOIN users u ON u.id = mu.user_id
  WHERE mu.deleted_at IS NULL AND mu.mobile IS NOT NULL
  UNION ALL
  SELECT 'enterprise', eu.mobile, u.status
  FROM enterprise_users eu
  LEFT JOIN users u ON u.id = eu.user_id
  WHERE eu.deleted_at IS NULL AND eu.mobile IS NOT NULL
  UNION ALL
  SELECT 'vendor', vu.mobile, u.status
  FROM vendor_users vu
  LEFT JOIN users u ON u.id = vu.user_id
  WHERE vu.deleted_at IS NULL AND vu.mobile IS NOT NULL
  UNION ALL
  SELECT 'operational', ou.mobile, u.status
  FROM operational_users ou
  LEFT JOIN users u ON u.id = ou.user_id
  WHERE ou.deleted_at IS NULL AND ou.mobile IS NOT NULL
),
profile_ctx AS (
  SELECT DISTINCT ON (mobile)
    mobile,
    user_status
  FROM all_profiles
  ORDER BY mobile, profile_type
)
SELECT
  COALESCE(h.name, 'Unassigned') AS hierarchy_name,
  COALESCE(pr.user_status, a.user_status, 'No user record') AS user_status,
  e.name AS entity_name,
  p.name AS pouch_name,
  l.pouch_id,
  COUNT(*) AS user_count,
  COUNT(*) FILTER (WHERE l.latest_balance = 0) AS zero_balance_users,
  SUM(l.latest_balance) AS total_balance
FROM latest_balances l
INNER JOIN entities_d e ON e.id = l.entity_id
INNER JOIN pouches_d p ON p.id = l.pouch_id
LEFT JOIN agent_ctx a ON a.mobile = l.user_identifier
LEFT JOIN profile_ctx pr ON pr.mobile = l.user_identifier
LEFT JOIN hierarchies_d h ON h.id = a.hierarchy_id
GROUP BY h.name, COALESCE(pr.user_status, a.user_status, 'No user record'), e.name, p.name, l.pouch_id
ORDER BY total_balance DESC NULLS LAST
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
agent_ctx AS (
  SELECT DISTINCT ON (au.mobile)
    au.mobile,
    au.user_id,
    u.status AS user_status,
    COALESCE(au.business_hierarchy_id, u.business_hierarchy_id) AS hierarchy_id
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL
    AND au.mobile IS NOT NULL
  ORDER BY au.mobile, au.id DESC
),
all_profiles AS (
  SELECT 'agent'::text AS profile_type, au.mobile, au.user_id, u.status AS user_status
  FROM agent_users au
  LEFT JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL AND au.mobile IS NOT NULL
  UNION ALL
  SELECT 'customer', cu.mobile, cu.user_id, u.status
  FROM customer_users cu
  LEFT JOIN users u ON u.id = cu.user_id
  WHERE cu.deleted_at IS NULL AND cu.mobile IS NOT NULL
  UNION ALL
  SELECT 'merchant', mu.mobile, mu.user_id, u.status
  FROM merchant_users mu
  LEFT JOIN users u ON u.id = mu.user_id
  WHERE mu.deleted_at IS NULL AND mu.mobile IS NOT NULL
  UNION ALL
  SELECT 'enterprise', eu.mobile, eu.user_id, u.status
  FROM enterprise_users eu
  LEFT JOIN users u ON u.id = eu.user_id
  WHERE eu.deleted_at IS NULL AND eu.mobile IS NOT NULL
  UNION ALL
  SELECT 'vendor', vu.mobile, vu.user_id, u.status
  FROM vendor_users vu
  LEFT JOIN users u ON u.id = vu.user_id
  WHERE vu.deleted_at IS NULL AND vu.mobile IS NOT NULL
  UNION ALL
  SELECT 'operational', ou.mobile, ou.user_id, u.status
  FROM operational_users ou
  LEFT JOIN users u ON u.id = ou.user_id
  WHERE ou.deleted_at IS NULL AND ou.mobile IS NOT NULL
),
profile_ctx AS (
  SELECT DISTINCT ON (mobile)
    profile_type,
    mobile,
    user_id,
    user_status
  FROM all_profiles
  ORDER BY mobile, profile_type
)
SELECT
  COALESCE(h.name, 'Unassigned') AS hierarchy_name,
  e.name AS entity_name,
  p.name AS pouch_name,
  l.user_identifier AS mobile,
  COALESCE(a.user_id, pr.user_id) AS user_id,
  COALESCE(pr.profile_type, 'unknown') AS profile_type,
  COALESCE(pr.user_status, a.user_status, 'No user record') AS user_status,
  l.latest_balance,
  l.balance_as_of
FROM latest_balances l
INNER JOIN entities_d e ON e.id = l.entity_id
INNER JOIN pouches_d p ON p.id = l.pouch_id
LEFT JOIN agent_ctx a ON a.mobile = l.user_identifier
LEFT JOIN hierarchies_d h ON h.id = a.hierarchy_id
LEFT JOIN profile_ctx pr ON pr.mobile = l.user_identifier
ORDER BY l.latest_balance DESC NULLS LAST
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
    user_status,
    hierarchy_id
  FROM all_profiles
  ORDER BY mobile, profile_type
),
non_transacting AS (
  SELECT d.*
  FROM deduped d
  LEFT JOIN transacting t ON t.key = d.mobile
  WHERE t.key IS NULL
)
SELECT
  n.profile_type,
  COALESCE(n.user_status, 'No user record') AS user_status,
  COALESCE(h.name, 'Unassigned') AS hierarchy_name,
  COALESCE(e.name, '(No entity on profile)') AS entity_name,
  COUNT(*) AS non_transacting_count
FROM non_transacting n
LEFT JOIN entities_d e ON e.id = n.entity_id
LEFT JOIN hierarchies_d h ON h.id = n.hierarchy_id
GROUP BY n.profile_type, n.user_status, h.name, e.name
ORDER BY non_transacting_count DESC, n.profile_type, user_status, hierarchy_name, entity_name
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
  ORDER BY mobile, profile_type
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
ORDER BY n.profile_type, user_status, hierarchy_name, entity_name, n.mobile, p.id
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
    const cleaned = stripOptionalBlocks(sql)
    const result = await executeDataSourceQuery(ds.id, cleaned)
    console.log(`\n=== ${name} (${Date.now() - t0}ms, ${result.rows.length} rows) ===`)
    console.log(JSON.stringify(result.rows.slice(0, 3), null, 2))
    if (name === 'Entity Balance Summary') {
      const totalUsers = result.rows.reduce(
        (sum, r) => sum + Number(r.user_count ?? 0),
        0,
      )
      console.log('sum user_count across groups:', totalUsers)
    }
    if (name === 'Non-Transacting Detail') {
      const users = new Set(result.rows.map((r) => String(r.mobile)))
      const pouches = new Set(result.rows.map((r) => String(r.pouch_name)))
      console.log('distinct users:', users.size)
      console.log('pouches seen:', [...pouches].sort().join(', '))
      console.log('sample rows per user:', result.rows.slice(0, 8))
    }
  }

  await prisma.$disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
