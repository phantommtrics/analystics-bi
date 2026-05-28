import type { NextFunction, Request, Response } from 'express'
import { UserType } from '@prisma/client'
import { prisma } from '../prisma.js'
import { verifyAccessToken } from '../auth/tokens.js'

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization
  if (!bearer || !bearer.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = bearer.slice('Bearer '.length)
  try {
    const claims = verifyAccessToken(token)
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
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

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Unauthorized' })
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

    req.authUser = {
      id: user.id,
      userType: user.userType,
      permissions,
    }
    next()
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}
