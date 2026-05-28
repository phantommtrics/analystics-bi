import bcrypt from 'bcryptjs'
import { TokenStatus, UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens.js'

const refreshTtlMs = 7 * 24 * 60 * 60 * 1000

export async function loginWithIdentifier(identifier: string, password: string) {
  const normalized = identifier.toLowerCase().trim()
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalized }, { username: normalized }],
      status: 'ACTIVE',
    },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  })

  if (!user) {
    return null
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return null
  }

  const permissions =
    user.userType === UserType.OWNER
      ? ['*']
      : user.roles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) =>
              `${rolePermission.permission.moduleKey}:${rolePermission.permission.actionKey}`,
          ),
        )

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
      userType: user.userType,
      permissions,
    },
  }
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
