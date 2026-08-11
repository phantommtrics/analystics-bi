import bcrypt from 'bcryptjs'
import { TokenStatus, UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import {
  resolvePermissions,
  userPermissionInclude,
} from './permissions.js'
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens.js'

const refreshTtlMs = 7 * 24 * 60 * 60 * 1000

export async function loginWithIdentifier(identifier: string, password: string) {
  const normalized = identifier.toLowerCase().trim()
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalized }, { username: normalized }],
      status: 'ACTIVE',
    },
    include: userPermissionInclude,
  })

  if (!user) {
    return null
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return null
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const permissions = resolvePermissions(user)

  const accessToken = signAccessToken({
    sub: user.id,
    userType: user.userType,
  })

  const tokenId = cryptoRandom()
  const refreshToken = signRefreshToken({ sub: user.id, tokenId })
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + refreshTtlMs),
      status: TokenStatus.ACTIVE,
    },
  })

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      userType: user.userType,
      mustChangePassword: user.mustChangePassword,
      permissions,
    },
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return { ok: false as const, reason: 'not_found' as const }
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return { ok: false as const, reason: 'invalid_password' as const }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  })

  await prisma.refreshToken.updateMany({
    where: { userId, status: TokenStatus.ACTIVE },
    data: { status: TokenStatus.REVOKED },
  })

  const accessToken = signAccessToken({
    sub: user.id,
    userType: user.userType,
  })
  const refreshToken = signRefreshToken({ sub: user.id, tokenId: cryptoRandom() })
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + refreshTtlMs),
      status: TokenStatus.ACTIVE,
    },
  })

  return { ok: true as const, accessToken, refreshToken }
}

export async function rotateRefreshToken(refreshToken: string) {
  const claims = verifyRefreshToken(refreshToken)
  const tokenHash = hashToken(refreshToken)
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!existing || existing.status !== TokenStatus.ACTIVE || existing.expiresAt < new Date()) {
    return null
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { status: TokenStatus.REVOKED },
  })

  const accessToken = signAccessToken({
    sub: existing.user.id,
    userType: existing.user.userType,
  })
  const nextRefreshToken = signRefreshToken({ sub: claims.sub, tokenId: cryptoRandom() })

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(nextRefreshToken),
      userId: existing.user.id,
      expiresAt: new Date(Date.now() + refreshTtlMs),
      status: TokenStatus.ACTIVE,
    },
  })

  return { accessToken, refreshToken: nextRefreshToken }
}

export async function revokeRefreshToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken)
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } })
  if (!existing) {
    return
  }
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { status: TokenStatus.REVOKED },
  })
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
