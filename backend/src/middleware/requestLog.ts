import type { NextFunction, Request, Response } from 'express'

const SKIP_PATHS = new Set(['/api/health'])

export function requestLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.originalUrl.split('?')[0] ?? req.originalUrl
  if (SKIP_PATHS.has(path)) {
    return next()
  }

  const started = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - started
    const status = res.statusCode
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'log'
    const line = `[http] ${req.method} ${req.originalUrl} ${status} ${ms}ms`
    console[level](line)
  })

  next()
}
