import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { prisma } from '../src/prisma.js'
import { executeDataSourceQuery } from '../src/datasources/service.js'

function parseArgs() {
  const args = process.argv.slice(2)
  let fromDate: string | null = null
  let toDate: string | null = null
  let channel: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) fromDate = args[++i]
    if (args[i] === '--to' && args[i + 1]) toDate = args[++i]
    if (args[i] === '--channel' && args[i + 1]) channel = args[++i]
  }

  return { fromDate, toDate, channel }
}

function dateFilter(fromDate: string | null, toDate: string | null) {
  const clauses: string[] = []
  if (fromDate) clauses.push(`AND u.created_at >= TIMESTAMP '${fromDate} 00:00:00'`)
  if (toDate) clauses.push(`AND u.created_at < TIMESTAMP '${toDate} 00:00:00' + INTERVAL '1 day'`)
  return clauses.join('\n    ')
}

function channelFilter(channel: string | null) {
  if (!channel) return ''
  const escaped = channel.replace(/'/g, "''")
  return `AND ra.access_channel ILIKE '%${escaped}%'`
}

const REPORT_SQL = `
WITH flagged_customers AS (
  SELECT
    cu.id AS customer_user_id,
    u.id AS user_id,
    cu.full_name,
    cu.firstname,
    cu.lastname,
    cu.mobile,
    cu.email,
    cu.identification_number AS national_id,
    cu.date_of_birth,
    cu.gender,
    u.kyc_verified,
    u.account_type,
    u.status AS user_status,
    u.creation_channel,
    u.created_at AS user_created_at,
    cu.created_at AS customer_created_at,
    (cu.identification_number IS NULL) AS missing_national_id,
    (cu.date_of_birth IS NULL) AS missing_dob,
    (cu.gender IS NULL) AS missing_gender
  FROM users u
  INNER JOIN customer_users cu ON cu.user_id = u.id
  WHERE u.kyc_verified = true
    AND u.deleted_at IS NULL
    AND cu.deleted_at IS NULL
    AND (
      cu.identification_number IS NULL
      OR cu.date_of_birth IS NULL
      OR cu.gender IS NULL
    )
    {{DATE_FILTER}}
),
latest_kyc_approval AS (
  SELECT DISTINCT ON (ra.approveable_id)
    ra.approveable_id AS user_id,
    ra.id AS approval_id,
    ra.approval_type,
    ra.approveable_type,
    ra.status AS approval_status,
    ra.action AS approval_action,
    ra.approved_by,
    ra.created_by,
    ra.created_at AS approval_created_at,
    ra.updated_at AS approval_updated_at,
    ra.remarks AS approval_remarks,
    ra.access_channel AS approval_access_channel
  FROM request_approvals ra
  WHERE ra.approveable_type = 'PayConnect\\\\User\\\\Models\\\\User'
    AND ra.approval_type IN ('UpgradeCustomer', 'UserOnboarding', 'UpdateProfile')
    AND ra.status = 'Processed'
    AND ra.approved_by IS NOT NULL
    {{CHANNEL_FILTER}}
  ORDER BY ra.approveable_id, ra.updated_at DESC NULLS LAST, ra.created_at DESC
)
SELECT
  fc.customer_user_id,
  fc.user_id,
  fc.full_name,
  fc.firstname,
  fc.lastname,
  fc.mobile,
  fc.email,
  fc.national_id,
  fc.date_of_birth,
  fc.gender,
  fc.kyc_verified,
  fc.account_type,
  fc.user_status,
  fc.creation_channel,
  fc.missing_national_id,
  fc.missing_dob,
  fc.missing_gender,
  fc.user_created_at,
  fc.customer_created_at,
  lka.approval_id,
  lka.approval_type,
  lka.approval_status,
  lka.approval_action,
  lka.approval_created_at,
  lka.approval_updated_at,
  lka.approval_remarks,
  lka.approval_access_channel,
  su.id AS approver_system_user_id,
  su.user_id AS approver_user_id,
  su.full_name AS approver_name,
  su.email AS approver_email,
  su.mobile AS approver_mobile
FROM flagged_customers fc
{{APPROVAL_JOIN}} latest_kyc_approval lka ON lka.user_id = fc.user_id
LEFT JOIN system_users su ON su.user_id = lka.approved_by OR su.id = lka.approved_by
ORDER BY fc.user_created_at DESC
`

const SUMMARY_SQL = `
SELECT
  (SELECT COUNT(*) FROM users u
   INNER JOIN customer_users cu ON cu.user_id = u.id
   WHERE u.kyc_verified = true AND u.deleted_at IS NULL AND cu.deleted_at IS NULL) AS kyc_verified_customers,
  (SELECT COUNT(*) FROM users u
   INNER JOIN customer_users cu ON cu.user_id = u.id
   WHERE u.kyc_verified = true AND u.deleted_at IS NULL AND cu.deleted_at IS NULL
     AND (cu.identification_number IS NULL OR cu.date_of_birth IS NULL OR cu.gender IS NULL)
     {{DATE_FILTER}}) AS flagged_customers,
  (SELECT COUNT(*) FROM customer_users WHERE deleted_at IS NULL) AS total_customer_users,
  (SELECT COUNT(*) FROM users WHERE kyc_verified = true AND deleted_at IS NULL) AS total_kyc_verified_users
`

async function main() {
  const { fromDate, toDate, channel } = parseArgs()
  if (!fromDate && !toDate) {
    console.error(
      'Usage: npx tsx scripts/kyc-missing-fields-report.ts --from YYYY-MM-DD [--to YYYY-MM-DD] [--channel AGENT]',
    )
    console.error('Omit --channel to include all access channels (AGENT APP, CUSTOMER APP, etc.).')
    console.error('At least --from is required to avoid loading all rows at once.')
    process.exit(1)
  }

  const dateFilterSql = dateFilter(fromDate, toDate)
  const channelFilterSql = channelFilter(channel)
  const approvalJoin = channel ? 'INNER JOIN' : 'LEFT JOIN'
  const reportSql = REPORT_SQL.replaceAll('{{DATE_FILTER}}', dateFilterSql)
    .replaceAll('{{CHANNEL_FILTER}}', channelFilterSql)
    .replaceAll('{{APPROVAL_JOIN}}', approvalJoin)
  const summarySql = SUMMARY_SQL.replaceAll('{{DATE_FILTER}}', dateFilterSql)

  const ds = await prisma.dataSource.findFirst({ where: { isActive: true } })
  if (!ds) {
    console.error('No active datasource')
    process.exit(1)
  }

  console.log(`DataSource: ${ds.name} (${ds.database})`)
  console.log(`Date filter: ${fromDate ?? '(none)'} to ${toDate ?? '(none)'}`)
  console.log(`Channel filter: ${channel ? `access_channel ILIKE '%${channel}%'` : '(none)'}\n`)

  const summary = await executeDataSourceQuery(ds.id, summarySql)
  console.log('=== Summary ===')
  console.log(JSON.stringify(summary.rows[0], null, 2))

  const report = await executeDataSourceQuery(ds.id, reportSql)
  console.log(`\n=== Flagged customers with approver (${report.rowCount} rows, truncated=${report.truncated}) ===`)

  if (report.rows.length === 0) {
    console.log('No rows matched.')
  } else {
    console.log(JSON.stringify(report.rows, null, 2))
    const outPath = new URL('../kyc-missing-fields-report.json', import.meta.url)
    writeFileSync(outPath, JSON.stringify(report.rows, null, 2))
    console.log(`\nWrote ${report.rows.length} rows to ${outPath.pathname}`)
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
