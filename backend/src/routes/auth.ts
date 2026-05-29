import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import {
  changePassword,
  loginWithIdentifier,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../auth/service.js'
import { authenticate } from '../middleware/authenticate.js'

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const session = await loginWithIdentifier(parsed.data.identifier, parsed.data.password)
  if (!session) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  return res.json(session)
})

authRouter.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const tokens = await rotateRefreshToken(parsed.data.refreshToken)
  if (!tokens) {
    return res.status(401).json({ message: 'Invalid refresh token' })
  }

  return res.json(tokens)
})

authRouter.post('/logout', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }
  await revokeRefreshToken(parsed.data.refreshToken)
  return res.status(204).send()
})

authRouter.get('/me', authenticate, async (req, res) => {
  const authUser = req.authUser
  if (!authUser) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      userType: true,
      mustChangePassword: true,
    },
  })
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }
  return res.json({ ...user, permissions: authUser.permissions })
})

authRouter.post('/change-password', authenticate, async (req, res) => {
  const authUser = req.authUser
  if (!authUser) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const result = await changePassword(
    authUser.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  )

  if (!result.ok) {
    if (result.reason === 'invalid_password') {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }
    return res.status(404).json({ message: 'User not found' })
  }

  return res.json({ message: 'Password updated' })
})
