import 'dotenv/config'
import { prisma } from '../src/prisma.js'
import {
  executeDataSourceQuery,
  getConnectionConfig,
  getDataSourceTableColumns,
  listDataSourceTables,
} from '../src/datasources/service.js'

async function main() {
  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) {
    console.error('No active datasource')
    process.exit(1)
  }

  const config = getConnectionConfig(ds)
  const dsId = ds.id

  console.log(`DataSource: ${ds.name} (${ds.database})`)

  for (const search of ['hierarch', 'agent', 'entity', 'users']) {
    const tables = await listDataSourceTables(dsId, search)
    console.log(`\n=== TABLES matching "${search}" ===`)
    console.log(JSON.stringify(tables, null, 2))
  }

  const targetTables = [
    'business_hierarchies',
    'business_hierarchy_entities',
    'agent_users',
    'users',
    'entity',
    'entities',
  ]

  for (const tableName of targetTables) {
    const tables = await listDataSourceTables(dsId, tableName)
    const match = tables.find((t) => t.name === tableName)
    if (match) {
      const cols = await getDataSourceTableColumns(dsId, match.schema, match.name)
      console.log(`\n=== COLUMNS: ${match.qualifiedName} ===`)
      console.log(JSON.stringify(cols, null, 2))
    }
  }

  const fkSql = `
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    tc.table_name IN (
      'business_hierarchies',
      'business_hierarchy_entities',
      'agent_users',
      'users',
      'entity',
      'entities'
    )
    OR ccu.table_name IN (
      'business_hierarchies',
      'business_hierarchy_entities',
      'agent_users',
      'users',
      'entity',
      'entities'
    )
  )
ORDER BY tc.table_name, kcu.column_name
`

  console.log('\n=== FOREIGN KEYS ===')
  const fkResult = await executeDataSourceQuery(dsId, fkSql)
  console.log(JSON.stringify(fkResult.rows, null, 2))

  console.log('\n=== AGENT STATUSES ===')
  const statusResult = await executeDataSourceQuery(
    dsId,
    `SELECT status, COUNT(*) AS cnt FROM agent_users GROUP BY status ORDER BY cnt DESC`,
  )
  console.log(JSON.stringify(statusResult.rows, null, 2))

  console.log('\n=== JOIN PROBE (LIMIT 5) ===')
  const probeSql = `
SELECT
  bh.name AS hierarchy_name,
  au.status AS agent_status,
  e.name AS entity_name,
  au.id AS agent_user_id
FROM agent_users au
JOIN users u ON u.id = au.user_id
JOIN entity e ON e.id = au.entity_id
JOIN business_hierarchy_entities bhe ON bhe.entity_id = e.id
JOIN business_hierarchies bh ON bh.id = bhe.business_hierarchy_id
LIMIT 5
`
  try {
    const probeResult = await executeDataSourceQuery(dsId, probeSql)
    console.log(JSON.stringify(probeResult.rows, null, 2))
  } catch (err) {
    console.error('Probe failed:', err instanceof Error ? err.message : err)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
