import { Router } from 'express'
import { UserType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import {
  changePassword,
  loginWithIdentifier,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../auth/service.js'
import { clientIp, recordAuditEvent } from '../audit/service.js'
import { authenticate } from '../middleware/authenticate.js'
import { hashToken } from '../auth/tokens.js'
import {
  cachedOrganizationSubscription,
  syncOrganizationSubscription,
} from '../directpay/subscription-sync.js'
import { isSubscriptionAccessAllowed } from '../directpay/client.js'

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

  const ip = clientIp(req)
  const identifier = parsed.data.identifier.trim()

  const session = await loginWithIdentifier(parsed.data.identifier, parsed.data.password)
  if (!session) {
    void recordAuditEvent({
      userLabel: identifier,
      action: 'LOGIN_FAILED',
      resource: 'System',
      ipAddress: ip,
    })
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  void recordAuditEvent({
    userId: session.user.id,
    userLabel: `${session.user.displayName?.trim() || session.user.username} (${session.user.email})`,
    action: 'LOGIN_SUCCESS',
    resource: 'System',
    ipAddress: ip,
  })

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

  const tokenHash = hashToken(parsed.data.refreshToken)
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, username: true, email: true, displayName: true } } },
  })

  await revokeRefreshToken(parsed.data.refreshToken)

  if (existing?.user) {
    void recordAuditEvent({
      userId: existing.user.id,
      userLabel: `${existing.user.displayName?.trim() || existing.user.username} (${existing.user.email})`,
      action: 'LOGOUT',
      resource: 'System',
      ipAddress: clientIp(req),
    })
  }

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
      organizationId: true,
      organization: {
        select: {
          id: true,
          name: true,
          directPayBusinessId: true,
          subscriptionStatus: true,
          subscriptionPlanCode: true,
          subscriptionPeriodEnd: true,
          subscriptionPayUrl: true,
        },
      },
    },
  })
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  let subscription = user.organization
    ? cachedOrganizationSubscription(user.organization)
    : {
        status: null,
        planCode: null,
        periodEnd: null,
        payUrl: null,
        accessAllowed: authUser.userType === UserType.OWNER,
        directPayBusinessId: null,
      }

  if (
    user.organizationId &&
    user.organization?.directPayBusinessId &&
    authUser.userType !== UserType.OWNER
  ) {
    try {
      subscription = await syncOrganizationSubscription(user.organizationId)
    } catch (err) {
      console.error('[auth/me] subscription sync failed:', err)
    }
  }

  if (subscription.payUrl === null && user.organization?.directPayBusinessId) {
    subscription = { ...subscription, payUrl: null }
  }

  const accessAllowed =
    authUser.userType === UserType.OWNER || isSubscriptionAccessAllowed(subscription.status)

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    userType: user.userType,
    mustChangePassword: user.mustChangePassword,
    permissions: authUser.permissions,
    organization: user.organization
      ? { id: user.organization.id, name: user.organization.name }
      : null,
    subscription: {
      status: subscription.status,
      planCode: subscription.planCode,
      periodEnd: subscription.periodEnd,
      payUrl: subscription.payUrl,
      accessAllowed,
    },
  })
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

  void recordAuditEvent({
    userId: authUser.id,
    userLabel: `${authUser.displayName?.trim() || authUser.username} (${authUser.email})`,
    action: 'CHANGE_PASSWORD',
    resource: 'System',
    ipAddress: clientIp(req),
  })

  return res.json({ message: 'Password updated' })
})
