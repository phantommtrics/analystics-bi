#!/usr/bin/env node
/**
 * biReports — Partner Agent Float payload decryptor
 *
 * Verifies HMAC signature and decrypts the inner agent balance report from a
 * captured POST body (the JSON envelope biReports sends to your ingest endpoint).
 *
 * Usage:
 *   export PARTNER_AGENT_FLOAT_HMAC_SECRET="your-hmac-secret"
 *   export PARTNER_AGENT_FLOAT_ENCRYPTION_KEY="your-base64-32-byte-key"
 *
 *   node decrypt-partner-agent-float.mjs \
 *     --body ./captured-request.json \
 *     --signature "sha256=abc123..."
 *
 *   # Decrypt only (skip signature check — not for production)
 *   node decrypt-partner-agent-float.mjs --body ./captured-request.json --skip-signature
 *
 *   # Print first 10 agents only
 *   node decrypt-partner-agent-float.mjs --body ./captured-request.json --skip-signature --limit 10
 *
 * Capture the request body from your web server logs or a proxy. You must use the
 * exact raw JSON bytes that were POSTed (do not pretty-print before verifying HMAC).
 */

import { createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function usage() {
  console.error(`
biReports partner agent float — decrypt test tool

Required environment variables:
  PARTNER_AGENT_FLOAT_ENCRYPTION_KEY   32-byte key, base64-encoded
  PARTNER_AGENT_FLOAT_HMAC_SECRET      shared HMAC secret (unless --skip-signature)

Options:
  --body <file>          Path to raw POST body JSON file (default: stdin)
  --signature <value>    X-BIReports-Signature header (e.g. sha256=...)
  --skip-signature       Decrypt only; skip HMAC verification
  --limit <n>            Print only first n agents (default: all)
  --summary              Print counts only, not full agent list
  --help                 Show this help
`)
  process.exit(1)
}

function parseArgs(argv) {
  const opts = {
    bodyFile: null,
    signature: process.env.PARTNER_AGENT_FLOAT_SIGNATURE || null,
    skipSignature: false,
    limit: null,
    summary: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') usage()
    if (arg === '--body') opts.bodyFile = argv[++i]
    else if (arg === '--signature') opts.signature = argv[++i]
    else if (arg === '--skip-signature') opts.skipSignature = true
    else if (arg === '--summary') opts.summary = true
    else if (arg === '--limit') opts.limit = Number(argv[++i])
    else {
      console.error(`Unknown argument: ${arg}`)
      usage()
    }
  }

  return opts
}

function readInput(bodyFile) {
  if (bodyFile) {
    return readFileSync(bodyFile, 'utf8')
  }
  if (process.stdin.isTTY) {
    console.error('No --body file provided and stdin is empty. Pipe JSON or use --body.')
    process.exit(1)
  }
  return readFileSync(0, 'utf8')
}

function getEncryptionKey() {
  const raw = process.env.PARTNER_AGENT_FLOAT_ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new Error('Missing PARTNER_AGENT_FLOAT_ENCRYPTION_KEY')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('PARTNER_AGENT_FLOAT_ENCRYPTION_KEY must decode to 32 bytes')
  }
  return key
}

function getHmacSecret() {
  const raw = process.env.PARTNER_AGENT_FLOAT_HMAC_SECRET?.trim()
  if (!raw) {
    throw new Error('Missing PARTNER_AGENT_FLOAT_HMAC_SECRET (or pass --skip-signature)')
  }
  return raw
}

function verifySignature(rawBody, signatureHeader, hmacSecret) {
  const expected = `sha256=${createHmac('sha256', hmacSecret).update(rawBody).digest('hex')}`
  const provided = signatureHeader.trim()
  if (expected.length !== provided.length) {
    return false
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}

function decryptPayload(ciphertextBase64, encryptionKey) {
  const data = Buffer.from(ciphertextBase64, 'base64')
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('encrypted_payload is too short or invalid base64')
  }
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const rawBody = readInput(opts.bodyFile)

  if (!opts.skipSignature) {
    if (!opts.signature) {
      throw new Error('Pass --signature "sha256=..." or set PARTNER_AGENT_FLOAT_SIGNATURE')
    }
    const ok = verifySignature(rawBody, opts.signature, getHmacSecret())
    if (!ok) {
      console.error('FAIL: HMAC signature does not match.')
      console.error('Use the exact raw POST body bytes (no re-formatting) and the correct HMAC secret.')
      process.exit(1)
    }
    console.log('OK: HMAC signature verified')
  } else {
    console.warn('WARN: Skipping signature verification (--skip-signature)')
  }

  let envelope
  try {
    envelope = JSON.parse(rawBody)
  } catch {
    throw new Error('Body is not valid JSON')
  }

  const required = ['schema_version', 'delivery_id', 'snapshot_at', 'record_count', 'encrypted_payload']
  for (const field of required) {
    if (envelope[field] === undefined || envelope[field] === null) {
      throw new Error(`Envelope missing required field: ${field}`)
    }
  }

  console.log('Envelope:')
  console.log(`  delivery_id:  ${envelope.delivery_id}`)
  console.log(`  snapshot_at:  ${envelope.snapshot_at}`)
  console.log(`  record_count: ${envelope.record_count}`)
  console.log(`  algorithm:    ${envelope.algorithm ?? 'aes-256-gcm'}`)
  if (envelope.organization) {
    console.log('  organization:')
    console.log(`    id:               ${envelope.organization.id}`)
    console.log(`    partner_org_code: ${envelope.organization.partner_org_code}`)
  }

  const plaintext = decryptPayload(envelope.encrypted_payload, getEncryptionKey())
  const inner = JSON.parse(plaintext)

  if (inner.schema_version !== 1 && inner.schema_version !== 2) {
    throw new Error(`Unsupported inner schema_version: ${inner.schema_version}`)
  }
  if (inner.organization && envelope.organization) {
    const fields = ['id', 'partner_org_code']
    for (const field of fields) {
      if (inner.organization[field] !== envelope.organization[field]) {
        throw new Error(`organization.${field} mismatch between envelope and decrypted payload`)
      }
    }
  }
  if (inner.delivery_id !== envelope.delivery_id) {
    throw new Error('delivery_id mismatch between envelope and decrypted payload')
  }
  if (!Array.isArray(inner.agents)) {
    throw new Error('Decrypted payload missing agents array')
  }
  if (inner.agents.length !== envelope.record_count) {
    console.warn(
      `WARN: record_count (${envelope.record_count}) != agents.length (${inner.agents.length})`,
    )
  }

  console.log('OK: Payload decrypted')
  console.log(`  agents in payload: ${inner.agents.length}`)

  if (opts.summary) {
    const totalBalance = inner.agents.reduce((sum, row) => sum + Number(row.after_balance || 0), 0)
    console.log(`  total after_balance: ${totalBalance.toFixed(2)}`)
    process.exit(0)
  }

  const agents = opts.limit ? inner.agents.slice(0, opts.limit) : inner.agents
  console.log('')
  console.log('Agent detail:')
  console.log(
    JSON.stringify(
      {
        schema_version: inner.schema_version,
        delivery_id: inner.delivery_id,
        snapshot_at: inner.snapshot_at,
        ...(inner.organization ? { organization: inner.organization } : {}),
        agents,
      },
      null,
      2,
    ),
  )

  if (opts.limit && inner.agents.length > opts.limit) {
    console.error(`\n(showing ${opts.limit} of ${inner.agents.length} agents; remove --limit for full list)`)
  }
}

try {
  main()
} catch (err) {
  console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
