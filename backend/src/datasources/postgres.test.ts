import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatQualifiedTableName,
  normalizeCrossDatabaseReferences,
} from './postgres.js'

describe('normalizeCrossDatabaseReferences', () => {
  it('rewrites schema.database.table to schema.table when database matches', () => {
    const sql = 'SELECT * FROM public.qrpay."BillingLedgerEntry" LIMIT 100'
    assert.equal(
      normalizeCrossDatabaseReferences(sql, 'qrpay'),
      'SELECT * FROM public."BillingLedgerEntry" LIMIT 100',
    )
  })

  it('is case-insensitive for unquoted database segment', () => {
    const sql = 'SELECT * FROM public.QRPAY.users LIMIT 10'
    assert.equal(
      normalizeCrossDatabaseReferences(sql, 'qrpay'),
      'SELECT * FROM public.users LIMIT 10',
    )
  })

  it('leaves two-part references unchanged', () => {
    const sql = 'SELECT * FROM public."Bill" LIMIT 100'
    assert.equal(normalizeCrossDatabaseReferences(sql, 'qrpay'), sql)
  })

  it('does not rewrite when middle segment is a different database', () => {
    const sql = 'SELECT * FROM public.otherdb."Bill" LIMIT 100'
    assert.equal(normalizeCrossDatabaseReferences(sql, 'qrpay'), sql)
  })
})

describe('formatQualifiedTableName', () => {
  it('includes database as middle segment', () => {
    assert.equal(
      formatQualifiedTableName('public', 'BillingLedgerEntry', 'qrpay'),
      'public.qrpay."BillingLedgerEntry"',
    )
  })
})
