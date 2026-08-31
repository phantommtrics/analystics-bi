import crypto from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../env.js'

export interface AccessClaims {
  sub: string
  userType: 'OWNER' | 'SYSTEM_USER'
}

export interface RefreshClaims {
  sub: string
  tokenId: string
}

const MS_BY_UNIT: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

/** Parse jsonwebtoken-style durations such as `30m` or `7d`. */
export function parseExpiresInMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(value.trim())
  if (!match) return fallbackMs
  return Number(match[1]) * MS_BY_UNIT[match[2].toLowerCase()]
}

const accessSignOptions: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] }
const refreshSignOptions: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] }

export function signAccessToken(claims: AccessClaims) {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, accessSignOptions)
}

export function signRefreshToken(claims: RefreshClaims) {
  return jwt.sign(claims, env.JWT_REFRESH_SECRET, refreshSignOptions)
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
