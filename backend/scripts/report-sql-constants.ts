/** Pouch used for wallet transaction volume and count metrics (excludes Commission, Bonus, etc.). */
export const EMONEY_POUCH_NAME = 'EMoney' as const

export const EMONEY_POUCH_DIM_CTES = `
pouches_deduped AS (
  SELECT DISTINCT ON (p.id) p.id, p.name
  FROM pouches p
  WHERE p.deleted_at IS NULL
  ORDER BY p.id
),
emoney_pouch AS (
  SELECT id FROM pouches_deduped WHERE name = '${EMONEY_POUCH_NAME}' LIMIT 1
)`

/** Join transactions to the EMoney pouch — use on txn volume/count queries. */
export const EMONEY_POUCH_TXN_JOIN = 'JOIN emoney_pouch ep ON ep.id = t.pouch_id'

/** Operational Bank ledger — excluded from system float dashboard totals. */
export const SYSTEM_FLOAT_EXCLUDED_ENTITY = 'Bank' as const
