import type { NextFunction, Request, Response } from 'express'

export function authorize(moduleKey: string, actionKey: string) {
  const permission = `${moduleKey}:${actionKey}`

  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.authUser
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    if (user.permissions.includes('*') || user.permissions.includes(permission)) {
      return next()
    }
    return res.status(403).json({ message: 'Forbidden' })
  }
}
