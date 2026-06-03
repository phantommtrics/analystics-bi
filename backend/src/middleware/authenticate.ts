import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../prisma.js'
import { resolvePermissions, userPermissionInclude } from '../auth/permissions.js'
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
      include: userPermissionInclude,
    })

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const permissions = resolvePermissions(user)

    req.authUser = {
      id: user.id,
      userType: user.userType,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      permissions,
      mustChangePassword: user.mustChangePassword,
    }
    next()
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}
