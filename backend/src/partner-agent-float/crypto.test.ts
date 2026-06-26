import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { describe, it } from 'node:test'
import {
  decryptPayload,
  encryptPayload,
  signBody,
  verifySignature,
} from './crypto.js'
import { buildDeliveryEnvelope } from './client.js'
import { buildSnapshotPayload } from './query.js'

const TEST_KEY = randomBytes(32).toString('base64')
const TEST_HMAC = 'test-hmac-secret-for-partner-float'

describe('partner-agent-float crypto', () => {
  it('encrypts and decrypts round-trip', () => {
    const plaintext = JSON.stringify({ agents: [{ agent_number: '7957051' }] })
    const encrypted = encryptPayload(plaintext, TEST_KEY)
    const decrypted = decryptPayload(encrypted, TEST_KEY)
    assert.equal(decrypted, plaintext)
  })

  it('signs and verifies request body', () => {
    const body = '{"schema_version":1}'
    const signature = signBody(body, TEST_HMAC)
    assert.ok(verifySignature(body, signature, TEST_HMAC))
    assert.equal(verifySignature(body, 'sha256=deadbeef', TEST_HMAC), false)
  })

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptPayload('{"test":true}', TEST_KEY)
    const tampered = encrypted.slice(0, -4) + 'AAAA'
    assert.throws(() => decryptPayload(tampered, TEST_KEY))
  })
})

describe('partner-agent-float snapshot', () => {
  it('formats balances as decimal strings', () => {
    const snapshot = buildSnapshotPayload('delivery-1', new Date('2026-06-26T12:00:00.000Z'), [
      {
        agent_number: '7957051',
        after_balance: 12450,
        balance_as_of: '2026-06-26T11:58:32.000Z',
      },
      {
        agent_number: '2015645',
        after_balance: '0',
        balance_as_of: new Date('2026-06-26T12:00:00.000Z'),
      },
    ])

    assert.equal(snapshot.agents[0].after_balance, '12450.00')
    assert.equal(snapshot.agents[1].after_balance, '0.00')
    assert.equal(snapshot.agents.length, 2)
  })
})

describe('partner-agent-float delivery envelope', () => {
  it('builds envelope with matching record count', () => {
    const inner = JSON.stringify(
      buildSnapshotPayload('d-1', new Date('2026-06-26T12:00:00.000Z'), [
        { agent_number: '1', after_balance: 0, balance_as_of: '2026-06-26T12:00:00.000Z' },
      ]),
    )
    const envelope = buildDeliveryEnvelope(
      'd-1',
      new Date('2026-06-26T12:00:00.000Z'),
      inner,
      TEST_KEY,
    )
    assert.equal(envelope.record_count, 1)
    assert.equal(envelope.algorithm, 'aes-256-gcm')
    assert.ok(envelope.encrypted_payload.length > 0)

    const decrypted = JSON.parse(decryptPayload(envelope.encrypted_payload, TEST_KEY))
    assert.equal(decrypted.agents.length, 1)
    assert.equal(decrypted.agents[0].agent_number, '1')
  })

  it('signature covers full envelope JSON', () => {
    const inner = JSON.stringify(
      buildSnapshotPayload('d-2', new Date('2026-06-26T12:00:00.000Z'), []),
    )
    const envelope = buildDeliveryEnvelope(
      'd-2',
      new Date('2026-06-26T12:00:00.000Z'),
      inner,
      TEST_KEY,
    )
    const rawBody = JSON.stringify(envelope)
    const signature = signBody(rawBody, TEST_HMAC)
    assert.ok(verifySignature(rawBody, signature, TEST_HMAC))
    assert.equal(verifySignature(`${rawBody} `, signature, TEST_HMAC), false)
  })
})
