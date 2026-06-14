import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { TokenStatus, UserStatus, UserType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../prisma.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { sendInviteEmail } from '../../mail/invite.js'
import { generateTemporaryPassword } from '../../utils/password.js'
import { paramId } from '../../utils/params.js'
import { organizationWhere, requireOrganizationId } from '../../organization/scope.js'

export const operatorsRouter = Router()

operatorsRouter.use(authenticate)

const createOperatorSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email(),
  displayName: z.string().max(100).optional(),
  groupIds: z.array(z.string()).default([]),
})

const updateOperatorSchema = z.object({
  displayName: z.string().max(100).optional().nullable(),
  groupIds: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
})

const operatorInclude = {
  groups: {
    include: {
      group: {
        include: {
          role: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const

type OperatorWithGroups = {
  id: string
  username: string
  email: string
  displayName: string | null
  status: UserStatus
  mustChangePassword: boolean
  lastLoginAt: Date | null
  createdAt: Date
  groups: Array<{
    group: {
      id: string
      name: string
      role: { id: string; name: string }
    }
  }>
}

function effectiveRoles(user: OperatorWithGroups) {
  const roleMap = new Map<string, { id: string; name: string }>()
  for (const membership of user.groups) {
    roleMap.set(membership.group.role.id, membership.group.role)
  }
  return [...roleMap.values()]
}

function formatOperator(user: OperatorWithGroups) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles: effectiveRoles(user),
    groups: user.groups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
  }
}

async function roleNamesForGroupIds(groupIds: string[]): Promise<string[]> {
  if (groupIds.length === 0) return []
  const groups = await prisma.userGroup.findMany({
    where: { id: { in: groupIds } },
    include: { role: { select: { name: true } } },
  })
  return [...new Set(groups.map((g) => g.role.name))]
}

async function revokeUserTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, status: TokenStatus.ACTIVE },
    data: { status: TokenStatus.REVOKED },
  })
}

async function issueTemporaryPassword(user: {
  id: string
  email: string
  username: string
  groups: Array<{ group: { id: string; name: string } }>
}) {
  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 12)
  const groupIds = user.groups.map((ug) => ug.group.id)

  const delivery = await sendInviteEmail({
    to: user.email,
    username: user.username,
    email: user.email,
    temporaryPassword,
    roleNames: await roleNamesForGroupIds(groupIds),
    groupNames: user.groups.map((ug) => ug.group.name),
  })

  if (!delivery.ok) {
    throw new Error(delivery.message)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true },
  })

  await revokeUserTokens(user.id)

  return delivery
}

operatorsRouter.get('/', authorize('system-config-operators', 'view'), async (req, res) => {
  const users = await prisma.user.findMany({
    where: {
      userType: UserType.SYSTEM_USER,
      ...organizationWhere(req),
    },
    include: operatorInclude,
    orderBy: { username: 'asc' },
  })
  return res.json(users.map(formatOperator))
})

operatorsRouter.get('/:id', authorize('system-config-operators', 'view'), async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: paramId(req), userType: UserType.SYSTEM_USER },
    include: operatorInclude,
  })
  if (!user) {
    return res.status(404).json({ message: 'Operator not found' })
  }
  return res.json(formatOperator(user))
})

operatorsRouter.post('/', authorize('system-config-operators', 'edit'), async (req, res) => {
  const parsed = createOperatorSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const { username, email, displayName, groupIds } = parsed.data
  const normalizedEmail = email.toLowerCase().trim()
  const normalizedUsername = username.trim()

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
    },
  })
  if (existing) {
    return res.status(409).json({ message: 'Username or email already exists' })
  }

  if (groupIds.length > 0) {
    const groupCount = await prisma.userGroup.count({
      where: {
        id: { in: groupIds },
        ...(requireOrganizationId(req)
          ? { organizationId: requireOrganizationId(req)! }
          : {}),
      },
    })
    if (groupCount !== groupIds.length) {
      return res.status(400).json({ message: 'Invalid group IDs' })
    }
  }

  const organizationId = requireOrganizationId(req)
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization context required' })
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 12)

  const groupRecords =
    groupIds.length > 0
      ? await prisma.userGroup.findMany({
          where: { id: { in: groupIds } },
          select: { name: true },
        })
      : []

  const user = await prisma.user.create({
    data: {
      username: normalizedUsername,
      email: normalizedEmail,
      displayName: displayName?.trim() || null,
      passwordHash,
      userType: UserType.SYSTEM_USER,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      organizationId,
      groups: { create: groupIds.map((groupId) => ({ groupId })) },
    },
    include: operatorInclude,
  })

  const delivery = await sendInviteEmail({
    to: normalizedEmail,
    username: normalizedUsername,
    email: normalizedEmail,
    temporaryPassword,
    roleNames: await roleNamesForGroupIds(groupIds),
    groupNames: groupRecords.map((g) => g.name),
  })

  return res.status(201).json({
    ...formatOperator(user),
    emailSent: delivery.ok && delivery.channel === 'resend',
    emailWarning:
      delivery.ok && delivery.channel === 'console'
        ? delivery.warning
        : !delivery.ok
          ? delivery.message
          : undefined,
  })
})

operatorsRouter.patch('/:id', authorize('system-config-operators', 'edit'), async (req, res) => {
  const parsed = updateOperatorSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const existing = await prisma.user.findFirst({
    where: { id: paramId(req), userType: UserType.SYSTEM_USER },
  })
  if (!existing) {
    return res.status(404).json({ message: 'Operator not found' })
  }

  const { displayName, groupIds, status } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          ...(displayName !== undefined && { displayName }),
          ...(status !== undefined && { status }),
        },
      })

      if (status === 'DISABLED') {
        await tx.refreshToken.updateMany({
          where: { userId: existing.id, status: TokenStatus.ACTIVE },
          data: { status: TokenStatus.REVOKED },
        })
      }

      if (groupIds !== undefined) {
        const groupCount = await tx.userGroup.count({ where: { id: { in: groupIds } } })
        if (groupCount !== groupIds.length) {
          throw new Error('INVALID_GROUPS')
        }
        await tx.userGroupMember.deleteMany({ where: { userId: existing.id } })
        if (groupIds.length > 0) {
          await tx.userGroupMember.createMany({
            data: groupIds.map((groupId) => ({ userId: existing.id, groupId })),
          })
        }
      }
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_GROUPS') {
      return res.status(400).json({ message: 'Invalid group IDs' })
    }
    throw err
  }

  const user = await prisma.user.findUnique({
    where: { id: existing.id },
    include: operatorInclude,
  })
  return res.json(formatOperator(user!))
})

operatorsRouter.post('/:id/resend-invite', authorize('system-config-operators', 'edit'), async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: paramId(req), userType: UserType.SYSTEM_USER },
    include: operatorInclude,
  })
  if (!user) {
    return res.status(404).json({ message: 'Operator not found' })
  }

  if (!user.mustChangePassword) {
    return res.status(400).json({
      message: 'User has already set their password. Use reset password instead.',
    })
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 12)

  const groupIds = user.groups.map((ug) => ug.group.id)

  const delivery = await sendInviteEmail({
    to: user.email,
    username: user.username,
    email: user.email,
    temporaryPassword,
    roleNames: await roleNamesForGroupIds(groupIds),
    groupNames: user.groups.map((ug) => ug.group.name),
  })

  if (!delivery.ok) {
    return res.status(502).json({ message: delivery.message })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true },
  })

  await revokeUserTokens(user.id)

  return res.json({
    message: delivery.channel === 'resend' ? 'Invitation resent' : 'Invitation logged to server console',
    emailWarning: delivery.channel === 'console' ? delivery.warning : undefined,
  })
})

operatorsRouter.post('/:id/reset-password', authorize('system-config-operators', 'edit'), async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: paramId(req), userType: UserType.SYSTEM_USER },
    include: operatorInclude,
  })
  if (!user) {
    return res.status(404).json({ message: 'Operator not found' })
  }

  if (user.mustChangePassword) {
    return res.status(400).json({
      message: 'User has not completed initial setup. Use resend invitation instead.',
    })
  }

  if (user.status !== UserStatus.ACTIVE) {
    return res.status(400).json({ message: 'Cannot reset password for a disabled user' })
  }

  try {
    const delivery = await issueTemporaryPassword(user)
    return res.json({
      message:
        delivery.channel === 'resend'
          ? 'Password reset email sent'
          : 'Password reset logged to server console',
      emailWarning: delivery.channel === 'console' ? delivery.warning : undefined,
    })
  } catch (err) {
    return res.status(502).json({
      message: err instanceof Error ? err.message : 'Failed to send password reset email',
    })
  }
})

operatorsRouter.post('/:id/disable', authorize('system-config-operators', 'edit'), async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: paramId(req), userType: UserType.SYSTEM_USER },
    include: operatorInclude,
  })
  if (!user) {
    return res.status(404).json({ message: 'Operator not found' })
  }

  await revokeUserTokens(user.id)

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: UserStatus.DISABLED },
    include: operatorInclude,
  })
  return res.json(formatOperator(updated))
})

operatorsRouter.post('/:id/enable', authorize('system-config-operators', 'edit'), async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: paramId(req), userType: UserType.SYSTEM_USER },
    include: operatorInclude,
  })
  if (!user) {
    return res.status(404).json({ message: 'Operator not found' })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: UserStatus.ACTIVE },
    include: operatorInclude,
  })
  return res.json(formatOperator(updated))
})
