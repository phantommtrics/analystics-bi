import { Router } from 'express'

export const protectedRouter = Router()

protectedRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

