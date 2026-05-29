import type { Request } from 'express'

export function paramId(req: Request, key = 'id'): string {
  const value = req.params[key]
  if (typeof value !== 'string') {
    throw new Error(`Missing route parameter: ${key}`)
  }
  return value
}
