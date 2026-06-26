/**
 * Dual-leg bank statement queries.
 *
 * The mobile filter scopes transactions via transaction_id so counterparty legs
 * remain available for DR/CR pairing and from/to metadata. Output rows must come
 * from statement_legs so before/after balances belong to the filtered account.
 */
export const BANK_STATEMENT_ANY_ENTITY = `
WITH entities_d AS (
  SELECT DISTINCT ON (e.id)
    e.id,
    e.name,
    e.entity_category
  FROM entities e
  WHERE e.deleted_at IS NULL
  ORDER BY e.id
),
services_d AS (
  SELECT DISTINCT ON (s.id) s.id, s.name
  FROM services s
  WHERE s.deleted_at IS NULL
  ORDER BY s.id
),
products_d AS (
  SELECT DISTINCT ON (p.id) p.id, p.name
  FROM products p
  WHERE p.deleted_at IS NULL
  ORDER BY p.id
),
filtered AS (
  SELECT
    t.id,
    t.transaction_id,
    t.sub_transaction_id,
    t.transaction_type,
    t.user_id,
    t.user_identifier,
    t.entity_id,
    t.transaction_amount::numeric AS transaction_amount,
    t.before_balance::numeric     AS before_balance,
    t.after_balance::numeric      AS after_balance,
    t.status,
    t.service_id,
    t.product_id,
    t.created_at,
    t.remarks
  FROM transactions t
  WHERE t.deleted_at IS NULL
    AND t.transaction_type IN ('DR', 'CR')
    AND t.status IN (
      'SUCCESS',
      'SUCCESS_BUT_GAMING',
      'SUCCESS_BUT_FLAG',
      'REVERSED',
      'ROLLBACK'
    )
    AND t.created_at >= CAST(:start_date AS timestamp)
    AND t.created_at < CAST(:dateToExclusive AS timestamp)
    [[AND t.transaction_id IN (
      SELECT DISTINCT x.transaction_id
      FROM transactions x
      WHERE x.deleted_at IS NULL
        AND x.user_identifier = :mobile?
    )]]
    [[AND t.entity_id IN (
      SELECT id FROM entities_d WHERE name = :entityName?
    )]]
),
dr AS (
  SELECT
    f.*,
    ROW_NUMBER() OVER (
      PARTITION BY f.transaction_id, f.transaction_amount
      ORDER BY f.id
    ) AS pair_rn
  FROM filtered f
  WHERE f.transaction_type = 'DR'
),
cr AS (
  SELECT
    f.*,
    ROW_NUMBER() OVER (
      PARTITION BY f.transaction_id, f.transaction_amount
      ORDER BY f.id
    ) AS pair_rn
  FROM filtered f
  WHERE f.transaction_type = 'CR'
),
pairs AS (
  SELECT
    d.id              AS dr_id,
    c.id              AS cr_id,
    d.user_identifier AS from_mobile,
    c.user_identifier AS to_mobile,
    d.entity_id       AS from_entity_id,
    c.entity_id       AS to_entity_id
  FROM dr d
  INNER JOIN cr c
    ON c.transaction_id = d.transaction_id
   AND c.transaction_amount = d.transaction_amount
   AND c.pair_rn = d.pair_rn
),
paired_ids AS (
  SELECT dr_id AS id FROM pairs
  UNION ALL
  SELECT cr_id FROM pairs
),
legs AS (
  SELECT
    d.id AS leg_row_id,
    d.transaction_id,
    d.sub_transaction_id,
    'DR'::text AS leg_type,
    d.user_id,
    d.user_identifier AS leg_mobile,
    d.entity_id,
    d.transaction_amount,
    d.before_balance,
    d.after_balance,
    d.status,
    d.service_id,
    d.product_id,
    d.created_at AS transaction_datetime,
    d.remarks,
    p.from_mobile,
    p.to_mobile,
    p.from_entity_id,
    p.to_entity_id
  FROM pairs p
  INNER JOIN dr d ON d.id = p.dr_id

  UNION ALL

  SELECT
    c.id,
    c.transaction_id,
    c.sub_transaction_id,
    'CR',
    c.user_id,
    c.user_identifier,
    c.entity_id,
    c.transaction_amount,
    c.before_balance,
    c.after_balance,
    c.status,
    c.service_id,
    c.product_id,
    c.created_at,
    c.remarks,
    p.from_mobile,
    p.to_mobile,
    p.from_entity_id,
    p.to_entity_id
  FROM pairs p
  INNER JOIN cr c ON c.id = p.cr_id

  UNION ALL

  SELECT
    f.id,
    f.transaction_id,
    f.sub_transaction_id,
    f.transaction_type,
    f.user_id,
    f.user_identifier,
    f.entity_id,
    f.transaction_amount,
    f.before_balance,
    f.after_balance,
    f.status,
    f.service_id,
    f.product_id,
    f.created_at,
    f.remarks,
    CASE WHEN f.transaction_type = 'DR' THEN f.user_identifier END,
    CASE WHEN f.transaction_type = 'CR' THEN f.user_identifier END,
    CASE WHEN f.transaction_type = 'DR' THEN f.entity_id END,
    CASE WHEN f.transaction_type = 'CR' THEN f.entity_id END
  FROM filtered f
  WHERE NOT EXISTS (
    SELECT 1 FROM paired_ids pi WHERE pi.id = f.id
  )
),
statement_legs AS (
  SELECT l.*
  FROM legs l
  [[WHERE l.leg_mobile = :mobile?]]
),
relevant_mobiles AS (
  SELECT leg_mobile AS mobile FROM statement_legs
  UNION
  SELECT from_mobile FROM statement_legs WHERE from_mobile IS NOT NULL
  UNION
  SELECT to_mobile FROM statement_legs WHERE to_mobile IS NOT NULL
),
profile_hits AS (
  SELECT DISTINCT ON (src.mobile)
    src.mobile,
    src.profile_type,
    src.firstname,
    src.lastname,
    src.full_name,
    src.profile_name
  FROM (
    SELECT 'customer' AS profile_type, cu.mobile, cu.firstname, cu.lastname, cu.full_name,
      COALESCE(cu.full_name, NULLIF(TRIM(COALESCE(cu.firstname, '') || ' ' || COALESCE(cu.lastname, '')), '')) AS profile_name
    FROM customer_users cu
    INNER JOIN relevant_mobiles rm ON rm.mobile = cu.mobile
    WHERE cu.deleted_at IS NULL
    UNION ALL
    SELECT 'agent', au.mobile, au.firstname, au.lastname, au.full_name,
      COALESCE(au.full_name, NULLIF(TRIM(COALESCE(au.firstname, '') || ' ' || COALESCE(au.lastname, '')), ''))
    FROM agent_users au
    INNER JOIN relevant_mobiles rm ON rm.mobile = au.mobile
    WHERE au.deleted_at IS NULL
    UNION ALL
    SELECT 'merchant', mu.mobile, mu.firstname, mu.lastname, mu.full_name,
      COALESCE(mu.full_name, NULLIF(TRIM(COALESCE(mu.firstname, '') || ' ' || COALESCE(mu.lastname, '')), ''))
    FROM merchant_users mu
    INNER JOIN relevant_mobiles rm ON rm.mobile = mu.mobile
    WHERE mu.deleted_at IS NULL
    UNION ALL
    SELECT 'enterprise', eu.mobile, eu.firstname, eu.lastname, eu.full_name,
      COALESCE(eu.full_name, NULLIF(TRIM(COALESCE(eu.firstname, '') || ' ' || COALESCE(eu.lastname, '')), ''))
    FROM enterprise_users eu
    INNER JOIN relevant_mobiles rm ON rm.mobile = eu.mobile
    WHERE eu.deleted_at IS NULL
    UNION ALL
    SELECT 'vendor', vu.mobile, vu.firstname, vu.lastname, vu.full_name,
      COALESCE(vu.full_name, NULLIF(TRIM(COALESCE(vu.firstname, '') || ' ' || COALESCE(vu.lastname, '')), ''))
    FROM vendor_users vu
    INNER JOIN relevant_mobiles rm ON rm.mobile = vu.mobile
    WHERE vu.deleted_at IS NULL
    UNION ALL
    SELECT 'operational', ou.mobile, ou.firstname, ou.lastname, ou.full_name,
      COALESCE(ou.full_name, NULLIF(TRIM(COALESCE(ou.firstname, '') || ' ' || COALESCE(ou.lastname, '')), ''))
    FROM operational_users ou
    INNER JOIN relevant_mobiles rm ON rm.mobile = ou.mobile
    WHERE ou.deleted_at IS NULL
  ) src
  ORDER BY
    src.mobile,
    CASE src.profile_type
      WHEN 'customer' THEN 0 WHEN 'agent' THEN 1 WHEN 'merchant' THEN 2
      WHEN 'enterprise' THEN 3 WHEN 'vendor' THEN 4 WHEN 'operational' THEN 5 ELSE 6
    END
)

SELECT
  l.leg_mobile                                              AS mobile,
  e.name                                                    AS entity_name,
  e.entity_category,
  COALESCE(leg_p.profile_name, l.leg_mobile)                AS account_name,

  l.transaction_datetime,
  l.transaction_datetime::date                              AS transaction_date,

  l.transaction_id,
  l.leg_type,
  LOWER(l.status)                                           AS transaction_status,

  TRIM(BOTH ' ' FROM CONCAT_WS(
    ' — ',
    NULLIF(TRIM(s.name), ''),
    NULLIF(TRIM(p.name), ''),
    CASE
      WHEN l.leg_type = 'DR' AND l.to_mobile IS NOT NULL THEN
        'To ' || COALESCE(to_p.profile_name, l.to_mobile)
    END,
    CASE
      WHEN l.leg_type = 'CR' AND l.from_mobile IS NOT NULL THEN
        'From ' || COALESCE(from_p.profile_name, l.from_mobile)
    END,
    NULLIF(TRIM(l.remarks), '')
  ))                                                        AS description,

  s.name                                                    AS service_name,
  p.name                                                    AS product_name,
  l.remarks,

  l.from_mobile,
  COALESCE(from_p.profile_name, l.from_mobile)              AS from_name,
  from_e.name                                               AS from_entity_name,

  l.to_mobile,
  COALESCE(to_p.profile_name, l.to_mobile)                  AS to_name,
  to_e.name                                                 AS to_entity_name,

  CASE WHEN l.leg_type = 'DR' THEN l.transaction_amount END AS debit_amount,
  CASE WHEN l.leg_type = 'CR' THEN l.transaction_amount END AS credit_amount,

  l.before_balance,
  l.after_balance

FROM statement_legs l
INNER JOIN entities_d e ON e.id = l.entity_id
LEFT JOIN entities_d from_e ON from_e.id = l.from_entity_id
LEFT JOIN entities_d to_e ON to_e.id = l.to_entity_id
LEFT JOIN services_d s ON s.id = l.service_id
LEFT JOIN products_d p ON p.id = l.product_id
LEFT JOIN profile_hits leg_p ON leg_p.mobile = l.leg_mobile
LEFT JOIN profile_hits from_p ON from_p.mobile = l.from_mobile
LEFT JOIN profile_hits to_p ON to_p.mobile = l.to_mobile

ORDER BY
  l.transaction_datetime ASC,
  l.leg_row_id ASC,
  l.transaction_id ASC,
  l.leg_type ASC
`
