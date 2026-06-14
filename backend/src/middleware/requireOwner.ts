import type { NextFunction, Request, Response } from 'express'
import { UserType } from '@prisma/client'

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (req.authUser?.userType !== UserType.OWNER) {
    return res.status(403).json({ message: 'Owner access required' })
  }
  next()
}
