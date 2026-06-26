# Partner Agent Float Integration

This document describes how partner systems receive, verify, decrypt, and merge agent float balance snapshots from biReports.

## Overview

biReports sends a **full snapshot** of all **active** agents' EMoney balances on the Agent ledger entity every `PARTNER_AGENT_FLOAT_INTERVAL_MS` (default 5 minutes). Each delivery includes:

- Every **active** registered agent (`agent_number` = mobile / `user_identifier`; `users.status = 'Active'`, not soft-deleted)
- Agents with zero balance or no wallet activity are included (`after_balance: "0.00"`)
- Encrypted payload over HTTPS with Bearer auth and HMAC signature

## Partner endpoint requirements

Your server must expose an HTTPS POST endpoint configured as `PARTNER_AGENT_FLOAT_API_URL`.

| Requirement | Detail |
|-------------|--------|
| Method | `POST` |
| Content-Type | `application/json` |
| Success response | HTTP `2xx` (body optional, e.g. `{ "accepted": true }`) |
| Idempotency | Deduplicate by `delivery_id` — retries use the same ID |

## Request headers

| Header | Description |
|--------|-------------|
| `Authorization` | `Bearer <PARTNER_AGENT_FLOAT_API_KEY>` |
| `X-BIReports-Delivery-Id` | UUID for this delivery (same as body `delivery_id`) |
| `X-BIReports-Signature` | `sha256=<hex>` HMAC-SHA256 of the **raw request body** |
| `Content-Type` | `application/json` |

## Request body (envelope)

```json
{
  "schema_version": 1,
  "delivery_id": "550e8400-e29b-41d4-a716-446655440000",
  "snapshot_at": "2026-06-26T12:05:00.000Z",
  "record_count": 4821,
  "algorithm": "aes-256-gcm",
  "encrypted_payload": "<base64>"
}
```

## Processing steps

### 1. Authenticate

Verify `Authorization: Bearer <api_key>` matches the key shared with biReports.

### 2. Verify signature

Recompute the HMAC over the **exact raw request body bytes** (before JSON re-serialization):

```
expected = "sha256=" + HMAC_SHA256(raw_body, PARTNER_AGENT_FLOAT_HMAC_SECRET).hex()
```

Compare with `X-BIReports-Signature` using a constant-time comparison. Reject with `401` if invalid.

### 3. Idempotency check

If `delivery_id` was already processed successfully, return `200` without re-applying data.

### 4. Decrypt payload

`encrypted_payload` is base64-encoded binary:

```
[12-byte IV][16-byte auth tag][ciphertext]
```

Decrypt with AES-256-GCM using `PARTNER_AGENT_FLOAT_ENCRYPTION_KEY` (32-byte key, base64-encoded).

### 5. Validate inner JSON

```json
{
  "schema_version": 1,
  "delivery_id": "550e8400-e29b-41d4-a716-446655440000",
  "snapshot_at": "2026-06-26T12:05:00.000Z",
  "agents": [
    {
      "agent_number": "7957051",
      "after_balance": "12450.00",
      "balance_as_of": "2026-06-26T11:58:32.000Z"
    }
  ]
}
```

Confirm:

- `schema_version === 1`
- `delivery_id` matches envelope
- `agents.length === record_count`
- `after_balance` values are decimal strings

### 6. Merge into partner records

Recommended upsert per agent:

| Field | Source |
|-------|--------|
| Primary key | `agent_number` |
| Balance | `after_balance` (parse as decimal) |
| Balance timestamp | `balance_as_of` |
| Snapshot version | `snapshot_at` |
| Delivery reference | `delivery_id` |
| Received at | server timestamp |

**Merge rule:** Only update a row if `snapshot_at` is newer than the stored `last_snapshot_at` (or `delivery_id` not yet seen).

Agents absent from a snapshot should **not** be deleted — biReports always sends the full agent list.

## Node.js example

```javascript
import crypto from 'node:crypto'

const HMAC_SECRET = process.env.PARTNER_AGENT_FLOAT_HMAC_SECRET
const ENCRYPTION_KEY = Buffer.from(process.env.PARTNER_AGENT_FLOAT_ENCRYPTION_KEY, 'base64')

function verifySignature(rawBody, signatureHeader) {
  const expected = `sha256=${crypto.createHmac('sha256', HMAC_SECRET).update(rawBody).digest('hex')}`
  if (!signatureHeader || expected.length !== signatureHeader.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}

function decryptPayload(ciphertextBase64) {
  const data = Buffer.from(ciphertextBase64, 'base64')
  const iv = data.subarray(0, 12)
  const authTag = data.subarray(12, 28)
  const encrypted = data.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// In your HTTP handler (use raw body middleware):
export function handleAgentFloatDelivery(req, res) {
  const rawBody = req.rawBody // string
  if (!verifySignature(rawBody, req.headers['x-bireports-signature'])) {
    return res.status(401).json({ message: 'Invalid signature' })
  }

  const envelope = JSON.parse(rawBody)
  if (alreadyProcessed(envelope.delivery_id)) {
    return res.status(200).json({ accepted: true, duplicate: true })
  }

  const inner = JSON.parse(decryptPayload(envelope.encrypted_payload))
  if (inner.agents.length !== envelope.record_count) {
    return res.status(400).json({ message: 'Record count mismatch' })
  }

  for (const agent of inner.agents) {
    upsertAgentBalance({
      agentNumber: agent.agent_number,
      balance: agent.after_balance,
      balanceAsOf: agent.balance_as_of,
      snapshotAt: inner.snapshot_at,
      deliveryId: inner.delivery_id,
    })
  }

  markProcessed(envelope.delivery_id)
  return res.status(200).json({ accepted: true })
}
```

## Python example

```python
import base64
import hashlib
import hmac
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HMAC_SECRET = os.environ["PARTNER_AGENT_FLOAT_HMAC_SECRET"].encode()
ENCRYPTION_KEY = base64.b64decode(os.environ["PARTNER_AGENT_FLOAT_ENCRYPTION_KEY"])

def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    expected = "sha256=" + hmac.new(HMAC_SECRET, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")

def decrypt_payload(ciphertext_b64: str) -> dict:
    data = base64.b64decode(ciphertext_b64)
    iv, tag, ciphertext = data[:12], data[12:28], data[28:]
    aesgcm = AESGCM(ENCRYPTION_KEY)
    plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
    return json.loads(plaintext)
```

## Secrets exchange

Share these values out-of-band (not via the API):

| Secret | Purpose |
|--------|---------|
| `PARTNER_AGENT_FLOAT_API_KEY` | Bearer token — biReports sends, partner validates |
| `PARTNER_AGENT_FLOAT_HMAC_SECRET` | Sign/verify request body integrity |
| `PARTNER_AGENT_FLOAT_ENCRYPTION_KEY` | AES-256-GCM — 32 random bytes, base64-encoded |

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Field reference

| Field | Type | Description |
|-------|------|-------------|
| `agent_number` | string | Agent mobile number (`agent_users.mobile`); only agents with `users.status = 'Active'` and no soft-delete on profile or user |
| `after_balance` | string | EMoney balance on Agent entity after latest txn (or `"0.00"`) |
| `balance_as_of` | ISO 8601 | Timestamp of the txn that produced the balance; equals `snapshot_at` when zero |
| `snapshot_at` | ISO 8601 | When biReports captured the snapshot |
| `delivery_id` | UUID | Unique per delivery; use for idempotency |
