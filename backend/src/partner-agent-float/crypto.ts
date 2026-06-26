import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(encryptionKeyBase64: string): Buffer {
  const key = Buffer.from(encryptionKeyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('PARTNER_AGENT_FLOAT_ENCRYPTION_KEY must decode to 32 bytes')
  }
  return key
}

export function encryptPayload(plaintext: string, encryptionKeyBase64: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(encryptionKeyBase64), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptPayload(ciphertextBase64: string, encryptionKeyBase64: string): string {
  const data = Buffer.from(ciphertextBase64, 'base64')
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted payload')
  }
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, getKey(encryptionKeyBase64), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function signBody(rawBody: string, hmacSecret: string): string {
  return `sha256=${createHmac('sha256', hmacSecret).update(rawBody).digest('hex')}`
}

export function verifySignature(
  rawBody: string,
  signatureHeader: string | undefined,
  hmacSecret: string,
): boolean {
  if (!signatureHeader?.trim()) {
    return false
  }
  const expected = signBody(rawBody, hmacSecret)
  const provided = signatureHeader.trim()
  if (expected.length !== provided.length) {
    return false
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}
