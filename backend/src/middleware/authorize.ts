import type { NextFunction, Request, Response } from 'express'

function hasPermission(
  permissions: string[],
  moduleKey: string,
  actionKey: string,
): boolean {
  return (
    permissions.includes('*') ||
    permissions.includes(`${moduleKey}:${actionKey}`)
  )
}

export function authorize(moduleKey: string, actionKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.authUser
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    if (hasPermission(user.permissions, moduleKey, actionKey)) {
      return next()
    }
    return res.status(403).json({ message: 'Forbidden' })
  }
}

/** Allow if the user has any one of the listed module:action permissions. */
export function authorizeAny(
  checks: ReadonlyArray<readonly [moduleKey: string, actionKey: string]>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.authUser
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    if (
      checks.some(([moduleKey, actionKey]) =>
        hasPermission(user.permissions, moduleKey, actionKey),
      )
    ) {
      return next()
    }
    return res.status(403).json({ message: 'Forbidden' })
  }
}
