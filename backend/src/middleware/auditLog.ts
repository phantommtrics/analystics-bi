import type { NextFunction, Request, Response } from 'express'
import { resolveAuditAction, shouldAuditRequest } from '../audit/resolveAction.js'
import { clientIp, recordAuditEvent } from '../audit/service.js'

export function auditLogMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!shouldAuditRequest(req.method, req.originalUrl)) {
    return next()
  }

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return
    }

    const resolved = resolveAuditAction(req.method, req.originalUrl)
    if (!resolved) {
      return
    }

    const authUser = req.authUser
    const userLabel = authUser
      ? authUser.displayName?.trim() || authUser.username
      : 'System'

    void recordAuditEvent({
      userId: authUser?.id ?? null,
      userLabel: authUser ? `${userLabel} (${authUser.email})` : userLabel,
      action: resolved.action,
      resource: resolved.resource ?? null,
      ipAddress: clientIp(req),
      metadata: {
        method: req.method,
        path: req.originalUrl,
      },
    })
  })

  next()
}
