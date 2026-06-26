# Partner Agent Float Integration

This document describes how partner systems receive, verify, decrypt, and merge agent float balance snapshots from biReports.

## Overview

biReports sends a **full snapshot** of all **active** agents' EMoney balances on the Agent ledger entity on a **per-organization** schedule. Each tenant configures its own partner API URL, credentials, and delivery interval in **Agent Float Sync** (stored encrypted in the database).

Each delivery includes:

- Every **active** registered agent (`agent_number` = mobile / `user_identifier`; `users.status = 'Active'`, not soft-deleted)
- Agents with zero balance or no wallet activity are included (`after_balance: "0.00"`)
- Encrypted payload over HTTPS with Bearer auth and HMAC signature

## Partner endpoint requirements

Your server must expose an HTTPS POST endpoint configured per organization in biReports (Agent Float Sync settings).

## biReports configuration (per organization)

Platform operators configure each tenant in **Overview → Agent Float Sync**:

| Setting | Description |
|---------|-------------|
| Partner org code | Shareable identifier your partner registers for this tenant (required) |
| Partner API URL | Your ingest endpoint for that tenant |
| Delivery interval | How often biReports sends snapshots (default 5 minutes) |
| API key | Bearer token your server validates |
| HMAC secret | Shared secret for `X-BIReports-Signature` |
| Encryption key | Base64 32-byte AES key for payload decryption |

Credentials are encrypted at rest. Each organization uses its own active data source for balance queries.

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
| `X-BIReports-Organization-Id` | biReports organization ID for this tenant |
| `X-BIReports-Partner-Org-Code` | Partner org code agreed with biReports for this tenant |
| `Content-Type` | `application/json` |

## Request body (envelope)

```json
{
  "schema_version": 2,
  "delivery_id": "550e8400-e29b-41d4-a716-446655440000",
  "snapshot_at": "2026-06-26T12:05:00.000Z",
  "record_count": 4821,
  "algorithm": "aes-256-gcm",
  "organization": {
    "id": "clxyz123organizationid",
    "partner_org_code": "PHANTOM-AGENT-FLOAT"
  },
  "encrypted_payload": "<base64>"
}
```

The `organization` object is also covered by the HMAC signature. Partners should reject requests when any org identifier does not match what they have registered for that API key — **even if the Bearer token, HMAC, and encryption key are all valid**.

## Processing steps

### 1. Authenticate

Verify `Authorization: Bearer <api_key>` matches the key shared with biReports.

### 2. Verify organization (before decrypt)

Read org identifiers from headers (fast reject) and confirm they match the tenant registered for this API key:

| Header | Envelope field |
|--------|----------------|
| `X-BIReports-Organization-Id` | `organization.id` |
| `X-BIReports-Partner-Org-Code` | `organization.partner_org_code` |

If any value mismatches what you expect for this tenant, return **`403 Forbidden`** (or your equivalent) and do not process the payload — even when secrets are correct. This prevents cross-tenant credential reuse.

After parsing the JSON body, confirm the envelope `organization` object matches the same two values in the headers.

### 3. Verify signature

Recompute the HMAC over the **exact raw request body bytes** (before JSON re-serialization):

```
expected = "sha256=" + HMAC_SHA256(raw_body, PARTNER_AGENT_FLOAT_HMAC_SECRET).hex()
```

Compare with `X-BIReports-Signature` using a constant-time comparison. Reject with `401` if invalid.

### 4. Idempotency check

If `delivery_id` was already processed successfully, return `200` without re-applying data.

### 5. Decrypt payload

`encrypted_payload` is base64-encoded binary:

```
[12-byte IV][16-byte auth tag][ciphertext]
```

Decrypt with AES-256-GCM using `PARTNER_AGENT_FLOAT_ENCRYPTION_KEY` (32-byte key, base64-encoded).

### 6. Validate inner JSON

```json
{
  "schema_version": 2,
  "delivery_id": "550e8400-e29b-41d4-a716-446655440000",
  "snapshot_at": "2026-06-26T12:05:00.000Z",
  "organization": {
    "id": "clxyz123organizationid",
    "partner_org_code": "PHANTOM-AGENT-FLOAT"
  },
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

- `schema_version === 2`
- `delivery_id` matches envelope
- `organization` matches envelope and headers exactly
- `agents.length === record_count`
- `after_balance` values are decimal strings

### 7. Merge into partner records

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

## Test decrypt script (share with partner)

A standalone Node.js tool is included to verify decryption from a captured request:

**File:** [`docs/scripts/decrypt-partner-agent-float.mjs`](scripts/decrypt-partner-agent-float.mjs)

**Requirements:** Node.js 18+ (no npm install — uses built-in `crypto` only)

### 1. Capture a real POST

Save the **exact raw JSON body** your server received to a file, e.g. `captured-request.json`.  
Also note the `X-BIReports-Signature` header from the same request.

### 2. Run the script

```bash
export PARTNER_AGENT_FLOAT_HMAC_SECRET="shared-hmac-secret"
export PARTNER_AGENT_FLOAT_ENCRYPTION_KEY="shared-base64-encryption-key"

node decrypt-partner-agent-float.mjs \
  --body ./captured-request.json \
  --signature "sha256=..."
```

**Decrypt only** (if signature debugging is separate):

```bash
node decrypt-partner-agent-float.mjs --body ./captured-request.json --skip-signature
```

**Summary only** (counts, no agent list):

```bash
node decrypt-partner-agent-float.mjs --body ./captured-request.json --skip-signature --summary
```

**First 10 agents:**

```bash
node decrypt-partner-agent-float.mjs --body ./captured-request.json --skip-signature --limit 10
```

### Expected output

```
OK: HMAC signature verified
Envelope:
  delivery_id:  ...
  snapshot_at:  ...
  record_count: 1234
OK: Payload decrypted
  agents in payload: 1234

Agent detail:
{
  "schema_version": 2,
  "delivery_id": "...",
  "snapshot_at": "...",
  "organization": {
    "id": "clxyz123organizationid",
    "partner_org_code": "PHANTOM-AGENT-FLOAT"
  },
  "agents": [
    {
      "agent_number": "7957051",
      "after_balance": "12450.00",
      "balance_as_of": "2026-06-26T11:58:32.000Z"
    }
  ]
}
```

If they only see `record_count` in their app logs but this script prints the full `agents` array, their ingest handler needs to add the decrypt step below.

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

  const expectedOrg = getRegisteredOrgForApiKey(req.headers.authorization)
  const headerOrg = {
    id: req.headers['x-bireports-organization-id'],
    partner_org_code: req.headers['x-bireports-partner-org-code'],
  }
  if (
    !expectedOrg ||
    headerOrg.id !== expectedOrg.id ||
    headerOrg.partner_org_code !== expectedOrg.partner_org_code ||
    JSON.stringify(envelope.organization) !== JSON.stringify(expectedOrg)
  ) {
    return res.status(403).json({ message: 'Organization mismatch' })
  }

  if (alreadyProcessed(envelope.delivery_id)) {
    return res.status(200).json({ accepted: true, duplicate: true })
  }

  const inner = JSON.parse(decryptPayload(envelope.encrypted_payload))
  if (JSON.stringify(inner.organization) !== JSON.stringify(envelope.organization)) {
    return res.status(400).json({ message: 'Organization mismatch in decrypted payload' })
  }
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

Share these values out-of-band with biReports for each organization (configured in the Agent Float Sync UI):

| Secret | Purpose |
|--------|---------|
| Partner org code | Shareable tenant identifier — included in every delivery; partner must match before processing |
| API key | Bearer token — biReports sends, partner validates |
| HMAC secret | Sign/verify request body integrity |
| Encryption key | AES-256-GCM — 32 random bytes, base64-encoded |

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
