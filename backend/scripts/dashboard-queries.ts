/**
 * Dashboard-ready query definitions derived from recovered summary reports.
 * Detail / line-level reports are excluded — those belong in Report Catalog drilldowns.
 */
import { ENTITY_BALANCE_SUMMARY } from './validate-balance-reports.ts'
import {
  DAILY_COMMISSION_ROLLUP,
  DAILY_COMMISSION_USER,
  MONTHLY_COMMISSION_ROLLUP,
  MONTHLY_COMMISSION_USER,
} from './validate-commission-reports.ts'
import { HIERARCHY_PRODUCT_ROLLUP_PERIOD_COMPARISON } from './validate-hierarchy-rollup-reports.ts'
import {
  INACTIVE_ENTITY_USERS_PERIOD_COMPARISON,
  PRODUCT_ENTITY_PERIOD_COMPARISON,
  PRODUCT_HIERARCHY_PERIOD_COMPARISON,
  PRODUCT_SUMMARY_PERIOD_COMPARISON,
} from './validate-product-analysis-reports.ts'
import {
  REVENUE_SUMMARY,
  REVENUE_SUMMARY_PERIOD_COMPARISON,
} from './validate-revenue-reports.ts'
import { TRANSACTION_SUMMARY } from './validate-transaction-reports.ts'
import { EMONEY_POUCH_DIM_CTES, EMONEY_POUCH_TXN_JOIN, SYSTEM_FLOAT_EXCLUDED_ENTITY } from './report-sql-constants.ts'

export type DashboardWidgetKind = 'KPI' | 'BAR_CHART' | 'LINE_CHART' | 'PIE_CHART' | 'TABLE_ONLY'

export type DashboardQueryDef = {
  name: string
  basedOn: string
  description: string
  widgetKind: DashboardWidgetKind
  /** Suggested SavedReport.visualization when seeding */
  visualization: DashboardWidgetKind extends 'KPI' ? 'TABLE_ONLY' : DashboardWidgetKind
  category: 'FINANCIAL' | 'OPERATIONAL' | 'AGENT' | 'BALANCE'
  /** Main-dashboard-style layout hint (12-col grid) */
  layoutHint: string
  labelColumn?: string
  valueColumns?: string[]
  kpiColumn?: string
  kpiLabel?: string
  maxRows?: number
  drilldownReport?: string
  sql: string
}

/** Wrap a full report SELECT so dashboard charts see label + numeric columns only. */
function wrapReport(innerSql: string): string {
  return innerSql.trim()
}

const EXCLUDED_DETAIL_REPORTS = [
  {
    name: '[Revenue] - Transaction detail',
    reason: 'Line-level fee rows — use Report View for drilldown, not dashboard widgets.',
  },
  {
    name: '[Transaction] - Detail by product',
    reason: 'Product grain within scope — too many rows for charts; link from summary widget.',
  },
  {
    name: '[Transaction] - Detail by entity and product',
    reason: 'Entity × product grain — drilldown table only.',
  },
  {
    name: 'User Balance Detail As At',
    reason: 'Per-user balance rows — not suitable for KPI/chart aggregation.',
  },
  {
    name: 'Monthly Commission — detail',
    reason: 'Transaction-level commission lines — drilldown only.',
  },
  {
    name: 'Daily Commission — detail',
    reason: 'Transaction-level commission lines — drilldown only.',
  },
  {
    name: 'Bank Statement — Any Entity (Dual Leg, DR / CR columns)',
    reason: 'Account statement format — belongs in Statements, not dashboards.',
  },
] as const

export const DASHBOARD_LAYOUT_BLUEPRINT = `
Main Dashboard layout (reference for custom dashboards)
──────────────────────────────────────────────────────
Row 1 — KPI strip (4 × 3-col widgets, h=2)
  • Total System Float          → KPI — Total System Float
  • Transaction Count           → KPI — Transaction Count
  • Fee Revenue                 → KPI — Fee Revenue
  • Agents with Commission      → KPI — Agents with Commission Releases

Row 2 — Primary charts (8-col bar + 4-col pie, h=4)
  • Daily Transaction Volume    → Chart — Daily Transaction Trend (LINE_CHART)
  • Fee Revenue Breakdown       → Chart — Fee Revenue by Stream (PIE_CHART)

Row 3 — Summary panel (8-col table + 4-col breakdown, h=5)
  • Top Performing Agents       → Table — Top Agents by Commission
  • Float by Entity             → Chart — System Float by Entity (PIE_CHART)

Chart rules (rowsToChartData / rowsToPieData)
  • First column = category label (scope, stream, entity, product, day)
  • Remaining columns = numeric series (counts, volumes, revenue)
  • Pie charts use the first numeric column only
  • KPI widgets bind valueColumn (+ optional rowIndex) from a single-row or scalar result
  • Table widgets: keep ≤15 rows on canvas (compact page size); use LIMIT in SQL

Transaction volume & count scope
  • All txn_count and transaction_volume metrics use the EMoney pouch only (not Commission, Bonus, Bank Emoney, etc.)

System float scope
  • Total System Float and float breakdown widgets exclude the "${SYSTEM_FLOAT_EXCLUDED_ENTITY}" entity
`.trim()

export const DASHBOARD_QUERIES: DashboardQueryDef[] = [
  {
    name: 'Dashboard KPI — Total System Float',
    basedOn: 'Entity Balance Summary',
    description:
      'Single metric: sum of user wallet balances as at dateTo, excluding the Bank entity. Mirrors “Total System Float” on the main dashboard.',
    widgetKind: 'KPI',
    visualization: 'TABLE_ONLY',
    category: 'BALANCE',
    layoutHint: 'Row 1 · w=3 h=2 · KPI card',
    kpiColumn: 'total_system_float',
    kpiLabel: 'Total System Float',
    sql: `
SELECT SUM(b.total_current_balance) AS total_system_float
FROM (
${wrapReport(ENTITY_BALANCE_SUMMARY)}
) b
WHERE b.entity_name <> '${SYSTEM_FLOAT_EXCLUDED_ENTITY}'
`.trim(),
  },
  {
    name: 'Dashboard KPI — Transaction Count',
    basedOn: '[Transaction] - Summary by scope',
    description:
      'Single metric: total successful EMoney pouch business transactions in the selected date range (Customer + Agent scopes).',
    widgetKind: 'KPI',
    visualization: 'TABLE_ONLY',
    category: 'OPERATIONAL',
    layoutHint: 'Row 1 · w=3 h=2 · KPI card',
    kpiColumn: 'transaction_count',
    kpiLabel: 'Transaction Count',
    sql: `
SELECT SUM(t.txn_count)::int AS transaction_count
FROM (
${wrapReport(TRANSACTION_SUMMARY)}
) t
WHERE t.scope_label IN ('Customer', 'Agent')
`.trim(),
  },
  {
    name: 'Dashboard KPI — Fee Revenue',
    basedOn: '[Revenue] - Summary by stream',
    description:
      'Single metric: total wallet fee revenue in the period (recorded + calculated streams, excluding subtotal rows).',
    widgetKind: 'KPI',
    visualization: 'TABLE_ONLY',
    category: 'FINANCIAL',
    layoutHint: 'Row 1 · w=3 h=2 · KPI card',
    kpiColumn: 'fee_revenue',
    kpiLabel: 'Fee Revenue',
    sql: `
SELECT SUM(r.revenue_amount) AS fee_revenue
FROM (
${wrapReport(REVENUE_SUMMARY)}
) r
WHERE NOT r.is_subtotal
  AND r.revenue_category NOT LIKE 'Subtotal%'
`.trim(),
  },
  {
    name: 'Dashboard KPI — Agents with Commission Releases',
    basedOn: 'Daily Commission — rollup',
    description:
      'Single metric: count of distinct agents who received daily commission releases in the current period.',
    widgetKind: 'KPI',
    visualization: 'TABLE_ONLY',
    category: 'AGENT',
    layoutHint: 'Row 1 · w=3 h=2 · KPI card',
    kpiColumn: 'active_agents',
    kpiLabel: 'Active Agents',
    sql: `
SELECT SUM(c.users_with_releases)::int AS active_agents
FROM (
${wrapReport(DAILY_COMMISSION_ROLLUP)}
) c
`.trim(),
  },
  {
    name: 'Dashboard Chart — Daily Transaction Trend',
    basedOn: '[Transaction] - Summary by scope (daily grain)',
    description:
      'Daily EMoney pouch transaction count for Customer + Agent activity. First column = day (chart label); use LINE_CHART or BAR_CHART.',
    widgetKind: 'LINE_CHART',
    visualization: 'LINE_CHART',
    category: 'OPERATIONAL',
    layoutHint: 'Row 2 · w=8 h=4 · wide chart',
    labelColumn: 'day',
    valueColumns: ['txn_count', 'transaction_volume'],
    drilldownReport: '[Transaction] - Detail by product',
    sql: `
WITH entities_deduped AS (
  SELECT DISTINCT ON (e.id) e.id, e.name, e.entity_category
  FROM entities e
  WHERE e.deleted_at IS NULL
  ORDER BY e.id
),
${EMONEY_POUCH_DIM_CTES},
entity_txn_volumes AS (
  SELECT
    t.created_at::date AS day,
    t.transaction_id,
    MAX(t.transaction_amount::numeric) AS transaction_volume
  FROM transactions t
  JOIN entities_deduped e ON e.id = t.entity_id
  ${EMONEY_POUCH_TXN_JOIN}
  WHERE t.deleted_at IS NULL
    AND t.status = 'SUCCESS'
    AND t.transaction_id IS NOT NULL
    AND e.entity_category IN ('CUSTOMER', 'AGENT')
    AND t.created_at >= CAST(:dateFrom AS timestamp)
    AND t.created_at < CAST(:dateToExclusive AS timestamp)
  GROUP BY t.created_at::date, t.transaction_id
)
SELECT
  day,
  COUNT(*)::int AS txn_count,
  SUM(transaction_volume) AS transaction_volume
FROM entity_txn_volumes
GROUP BY day
ORDER BY day
`.trim(),
  },
  {
    name: 'Dashboard Chart — Transaction Volume by Scope',
    basedOn: '[Transaction] - Summary by scope',
    description:
      'Customer vs Agent (or filtered entity) EMoney pouch txn count and volume. Bar chart: scope_label + numeric columns.',
    widgetKind: 'BAR_CHART',
    visualization: 'BAR_CHART',
    category: 'OPERATIONAL',
    layoutHint: 'Row 2 alt · w=8 h=4',
    labelColumn: 'scope_label',
    valueColumns: ['txn_count', 'transaction_volume'],
    drilldownReport: '[Transaction] - Detail by product',
    sql: `
SELECT
  t.scope_label,
  t.txn_count,
  t.transaction_volume
FROM (
${wrapReport(TRANSACTION_SUMMARY)}
) t
ORDER BY t.transaction_volume DESC NULLS LAST
`.trim(),
  },
  {
    name: 'Dashboard Chart — Fee Revenue by Stream',
    basedOn: '[Revenue] - Summary by stream',
    description:
      'Pie chart of fee revenue by stream. Excludes subtotal rows so slices match real revenue categories.',
    widgetKind: 'PIE_CHART',
    visualization: 'PIE_CHART',
    category: 'FINANCIAL',
    layoutHint: 'Row 2 · w=4 h=4 · pie',
    labelColumn: 'revenue_category',
    valueColumns: ['revenue_amount'],
    drilldownReport: '[Revenue] - Transaction detail',
    sql: `
SELECT
  r.revenue_category,
  r.revenue_amount
FROM (
${wrapReport(REVENUE_SUMMARY)}
) r
WHERE NOT r.is_subtotal
  AND r.revenue_category NOT LIKE 'Subtotal%'
ORDER BY r.revenue_amount DESC NULLS LAST
`.trim(),
  },
  {
    name: 'Dashboard Chart — Revenue Stream Period Comparison',
    basedOn: '[Revenue] - Summary by stream — period comparison',
    description:
      'Bar chart comparing current vs previous period revenue by stream.',
    widgetKind: 'BAR_CHART',
    visualization: 'BAR_CHART',
    category: 'FINANCIAL',
    layoutHint: 'Row 2 alt · w=8 h=4',
    labelColumn: 'revenue_category',
    valueColumns: ['current_revenue_amount', 'previous_revenue_amount'],
    sql: `
SELECT
  r.revenue_category,
  r.current_revenue_amount,
  r.previous_revenue_amount,
  r.revenue_change
FROM (
${wrapReport(REVENUE_SUMMARY_PERIOD_COMPARISON)}
) r
WHERE NOT r.is_subtotal
  AND r.revenue_category NOT LIKE 'Subtotal%'
ORDER BY r.current_revenue_amount DESC NULLS LAST
`.trim(),
  },
  {
    name: 'Dashboard Chart — System Float by Entity',
    basedOn: 'Entity Balance Summary',
    description:
      'Pie chart of total current balance grouped by ledger entity (Customer, Agent, Trust, etc.), excluding Bank.',
    widgetKind: 'PIE_CHART',
    visualization: 'PIE_CHART',
    category: 'BALANCE',
    layoutHint: 'Row 3 · w=4 h=5 · float monitor',
    labelColumn: 'entity_name',
    valueColumns: ['total_balance'],
    drilldownReport: 'User Balance Detail As At',
    sql: `
SELECT
  b.entity_name,
  SUM(b.total_current_balance) AS total_balance
FROM (
${wrapReport(ENTITY_BALANCE_SUMMARY)}
) b
WHERE b.entity_name <> '${SYSTEM_FLOAT_EXCLUDED_ENTITY}'
GROUP BY b.entity_name
ORDER BY total_balance DESC NULLS LAST
`.trim(),
  },
  {
    name: 'Dashboard Chart — Product Revenue Comparison',
    basedOn: '[Product] - Summary by product — period comparison',
    description: 'APS PAY, Ticket, Disbursement EMoney pouch volume and revenue — current vs previous period.',
    widgetKind: 'BAR_CHART',
    visualization: 'BAR_CHART',
    category: 'OPERATIONAL',
    layoutHint: 'Row 2 alt · w=6 h=4',
    labelColumn: 'display_name',
    valueColumns: ['current_revenue_amount', 'previous_revenue_amount'],
    sql: `
SELECT
  p.display_name,
  p.current_txn_count,
  p.current_transaction_volume,
  p.current_revenue_amount,
  p.previous_revenue_amount,
  p.revenue_change
FROM (
${wrapReport(PRODUCT_SUMMARY_PERIOD_COMPARISON)}
) p
ORDER BY p.current_revenue_amount DESC NULLS LAST
`.trim(),
  },
  {
    name: 'Dashboard Chart — Product Volume by Hierarchy',
    basedOn: '[Product] - Summary by hierarchy — period comparison',
    description:
      'Hierarchy-level EMoney pouch product volume for the current period. Aggregated for chart readability.',
    widgetKind: 'BAR_CHART',
    visualization: 'BAR_CHART',
    category: 'OPERATIONAL',
    layoutHint: 'Row 2 alt · w=8 h=4',
    labelColumn: 'hierarchy_name',
    valueColumns: ['current_transaction_volume', 'current_revenue_amount'],
    maxRows: 12,
    sql: `
SELECT
  h.hierarchy_name,
  SUM(h.current_txn_count)::int AS current_txn_count,
  SUM(h.current_transaction_volume) AS current_transaction_volume,
  SUM(h.current_revenue_amount) AS current_revenue_amount
FROM (
${wrapReport(PRODUCT_HIERARCHY_PERIOD_COMPARISON)}
) h
GROUP BY h.hierarchy_name
ORDER BY current_revenue_amount DESC NULLS LAST
LIMIT 12
`.trim(),
  },
  {
    name: 'Dashboard Table — Top Agents by Commission',
    basedOn: 'Monthly Commission — by user',
    description:
      'Top 10 agents by commission released in the current period. Mirrors “Top Performing Agents” table on the main dashboard.',
    widgetKind: 'TABLE_ONLY',
    visualization: 'TABLE_ONLY',
    category: 'AGENT',
    layoutHint: 'Row 3 · w=8 h=5 · summary table',
    maxRows: 10,
    drilldownReport: 'Monthly Commission — detail',
    sql: `
SELECT
  c.user_name,
  c.entity_name,
  c.hierarchy_name,
  c.current_release_count,
  c.total_current_released,
  c.release_change
FROM (
${wrapReport(MONTHLY_COMMISSION_USER)}
) c
ORDER BY c.total_current_released DESC NULLS LAST
LIMIT 10
`.trim(),
  },
  {
    name: 'Dashboard Table — Top Daily Commission Agents',
    basedOn: 'Daily Commission — by user',
    description: 'Top 10 agents by daily commission releases in the current period.',
    widgetKind: 'TABLE_ONLY',
    visualization: 'TABLE_ONLY',
    category: 'AGENT',
    layoutHint: 'Row 3 alt · w=8 h=5',
    maxRows: 10,
    drilldownReport: 'Daily Commission — detail',
    sql: `
SELECT
  c.user_name,
  c.entity_name,
  c.current_release_count,
  c.total_current_released,
  c.release_change
FROM (
${wrapReport(DAILY_COMMISSION_USER)}
) c
ORDER BY c.total_current_released DESC NULLS LAST
LIMIT 10
`.trim(),
  },
  {
    name: 'Dashboard Table — Commission Rollup by Entity',
    basedOn: 'Monthly Commission — rollup',
    description: 'Entity-level commission totals with period comparison (≤15 rows on canvas).',
    widgetKind: 'TABLE_ONLY',
    visualization: 'TABLE_ONLY',
    category: 'AGENT',
    layoutHint: 'Row 3 alt · w=8 h=5',
    maxRows: 15,
    sql: `
SELECT
  c.entity_name,
  c.hierarchy_name,
  c.users_with_releases,
  c.current_release_count,
  c.total_current_released,
  c.release_change
FROM (
${wrapReport(MONTHLY_COMMISSION_ROLLUP)}
) c
ORDER BY c.total_current_released DESC NULLS LAST
LIMIT 15
`.trim(),
  },
  {
    name: 'Dashboard Table — Top Merchant Entities by Product Revenue',
    basedOn: '[Product] - Summary by entity — period comparison',
    description: 'Top merchant/enterprise entities by current-period product revenue.',
    widgetKind: 'TABLE_ONLY',
    visualization: 'TABLE_ONLY',
    category: 'OPERATIONAL',
    layoutHint: 'Row 3 alt · w=8 h=5',
    maxRows: 15,
    sql: `
SELECT
  e.entity_name,
  e.product_name,
  e.current_txn_count,
  e.current_transaction_volume,
  e.current_revenue_amount,
  e.revenue_change
FROM (
${wrapReport(PRODUCT_ENTITY_PERIOD_COMPARISON)}
) e
ORDER BY e.current_revenue_amount DESC NULLS LAST
LIMIT 15
`.trim(),
  },
  {
    name: 'Dashboard Table — Inactive Entity Users (Summary)',
    basedOn: '[Product] - Inactive entity users — period comparison',
    description:
      'Users with zero product activity in the current period. Capped for dashboard table widget.',
    widgetKind: 'TABLE_ONLY',
    visualization: 'TABLE_ONLY',
    category: 'OPERATIONAL',
    layoutHint: 'Row 3 alt · w=8 h=5',
    maxRows: 15,
    sql: `
SELECT
  i.entity_name,
  i.user_name,
  i.product_name,
  i.previous_txn_count,
  i.previous_transaction_volume
FROM (
${wrapReport(INACTIVE_ENTITY_USERS_PERIOD_COMPARISON)}
) i
ORDER BY i.previous_transaction_volume DESC NULLS LAST
LIMIT 15
`.trim(),
  },
  {
    name: 'Dashboard Table — Hierarchy Product Rollup (Summary)',
    basedOn: '[Hierarchy] - Products by hierarchy — period comparison',
    description:
      'Hierarchy × product metrics aggregated for dashboard table (top 15 by revenue).',
    widgetKind: 'TABLE_ONLY',
    visualization: 'TABLE_ONLY',
    category: 'OPERATIONAL',
    layoutHint: 'Row 3 alt · w=12 h=5',
    maxRows: 15,
    sql: `
SELECT
  h.hierarchy_name,
  h.product_display_name,
  h.current_txn_count,
  h.current_transaction_volume,
  h.current_revenue_amount,
  h.revenue_change
FROM (
${wrapReport(HIERARCHY_PRODUCT_ROLLUP_PERIOD_COMPARISON)}
) h
ORDER BY h.current_revenue_amount DESC NULLS LAST
LIMIT 15
`.trim(),
  },
  {
    name: 'Dashboard KPI — Total Commission Released',
    basedOn: 'Monthly Commission — rollup',
    description: 'Single metric: total monthly commission released in the current period.',
    widgetKind: 'KPI',
    visualization: 'TABLE_ONLY',
    category: 'AGENT',
    layoutHint: 'KPI strip · w=3 h=2',
    kpiColumn: 'total_commission_released',
    kpiLabel: 'Commission Released',
    sql: `
SELECT SUM(c.total_current_released) AS total_commission_released
FROM (
${wrapReport(MONTHLY_COMMISSION_ROLLUP)}
) c
`.trim(),
  },
  {
    name: 'Dashboard KPI — Balance Change',
    basedOn: 'Entity Balance Summary',
    description:
      'Single metric: net change in system float between previous and current as-at dates, excluding the Bank entity.',
    widgetKind: 'KPI',
    visualization: 'TABLE_ONLY',
    category: 'BALANCE',
    layoutHint: 'KPI strip · w=3 h=2',
    kpiColumn: 'balance_change',
    kpiLabel: 'Balance Change',
    sql: `
SELECT SUM(b.balance_change) AS balance_change
FROM (
${wrapReport(ENTITY_BALANCE_SUMMARY)}
) b
WHERE b.entity_name <> '${SYSTEM_FLOAT_EXCLUDED_ENTITY}'
`.trim(),
  },
]

export { EXCLUDED_DETAIL_REPORTS }
