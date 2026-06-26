const EMONEY_POUCH_NAME = 'EMoney'

const AGENT_PROFILE_ORDER = `
  CASE COALESCE(u.status::text, 'No user record')
    WHEN 'Active' THEN 0
    WHEN 'Registered' THEN 1
    WHEN 'AwaitingApproval' THEN 2
    WHEN 'InActive' THEN 3
    WHEN 'Blocked' THEN 4
    WHEN 'Terminated' THEN 5
    ELSE 6
  END,
  au.id
`

export const AGENT_EMONEY_FLOAT_SNAPSHOT_SQL = `
WITH agent_entity AS (
  SELECT id FROM entities WHERE name = 'Agent' AND deleted_at IS NULL LIMIT 1
),
emoney_pouch AS (
  SELECT id FROM pouches WHERE name = '${EMONEY_POUCH_NAME}' AND deleted_at IS NULL LIMIT 1
),
agents AS (
  SELECT DISTINCT ON (au.mobile)
    au.mobile AS agent_number
  FROM agent_users au
  INNER JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL
    AND au.mobile IS NOT NULL
    AND u.deleted_at IS NULL
    AND u.status::text = 'Active'
  ORDER BY au.mobile, ${AGENT_PROFILE_ORDER}
),
latest_balances AS (
  SELECT DISTINCT ON (t.user_identifier)
    t.user_identifier,
    t.after_balance::numeric AS after_balance,
    t.created_at AS balance_as_of
  FROM transactions t
  INNER JOIN agent_entity ae ON ae.id = t.entity_id
  INNER JOIN emoney_pouch ep ON ep.id = t.pouch_id
  WHERE t.deleted_at IS NULL
    AND t.after_balance IS NOT NULL
    AND t.user_identifier IS NOT NULL
    AND t.created_at <= CAST(:snapshotAt AS timestamp)
  ORDER BY t.user_identifier, t.created_at DESC, t.id DESC
)
SELECT
  a.agent_number,
  COALESCE(lb.after_balance, 0) AS after_balance,
  COALESCE(lb.balance_as_of, CAST(:snapshotAt AS timestamp)) AS balance_as_of
FROM agents a
LEFT JOIN latest_balances lb ON lb.user_identifier = a.agent_number
ORDER BY a.agent_number
`

export type AgentFloatRow = {
  agent_number: string
  after_balance: string | number
  balance_as_of: Date | string
}

export type AgentFloatSnapshot = {
  schema_version: 1
  delivery_id: string
  snapshot_at: string
  agents: Array<{
    agent_number: string
    after_balance: string
    balance_as_of: string
  }>
}

function formatBalance(value: string | number): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) {
    return '0.00'
  }
  return num.toFixed(2)
}

function formatTimestamp(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

export function buildSnapshotPayload(
  deliveryId: string,
  snapshotAt: Date,
  rows: AgentFloatRow[],
): AgentFloatSnapshot {
  return {
    schema_version: 1,
    delivery_id: deliveryId,
    snapshot_at: snapshotAt.toISOString(),
    agents: rows.map((row) => ({
      agent_number: String(row.agent_number),
      after_balance: formatBalance(row.after_balance),
      balance_as_of: formatTimestamp(row.balance_as_of),
    })),
  }
}
