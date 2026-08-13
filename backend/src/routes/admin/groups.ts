import { Router } from 'express'
import { UserType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../prisma.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize, authorizeAny } from '../../middleware/authorize.js'
import { paramId } from '../../utils/params.js'
import { organizationListWhere, resolveOrganizationId } from '../../organization/scope.js'
import { assertRoleForOrganization } from './roles.js'

export const groupsRouter = Router()

groupsRouter.use(authenticate)

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  roleId: z.string().min(1),
  organizationId: z.string().min(1).optional(),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  roleId: z.string().min(1).optional(),
  memberIds: z.array(z.string().min(1)).optional(),
})

type GroupMemberRow = {
  user: {
    id: string
    username: string
    email: string
    displayName: string | null
    status: string
  }
}

function formatMembers(members: GroupMemberRow[]) {
  return members.map((m) => ({
    id: m.user.id,
    username: m.user.username,
    email: m.user.email,
    displayName: m.user.displayName,
    status: m.user.status,
  }))
}

function formatGroup(group: {
  id: string
  name: string
  description: string | null
  roleId: string
  organizationId: string
  role: { id: string; name: string }
  organization: { id: string; name: string }
  createdAt: Date
  updatedAt: Date
  _count: { members: number }
  members?: GroupMemberRow[]
}) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    roleId: group.roleId,
    role: group.role,
    organizationId: group.organizationId,
    organizationName: group.organization.name,
    memberCount: group._count.members,
    members: group.members ? formatMembers(group.members) : undefined,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }
}

const groupInclude = {
  role: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true } },
  _count: { select: { members: true } },
} as const

const groupDetailInclude = {
  ...groupInclude,
  members: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          status: true,
        },
      },
    },
    orderBy: { user: { username: 'asc' as const } },
  },
} as const

async function assertGroupInScope(
  req: Parameters<typeof resolveOrganizationId>[0],
  groupId: string,
) {
  const group = await prisma.userGroup.findUnique({
    where: { id: groupId },
    select: { id: true, organizationId: true },
  })
  if (!group) return null

  if (req.authUser?.userType === UserType.OWNER) {
    const listFilter = await organizationListWhere(req)
    if (listFilter.organizationId && group.organizationId !== listFilter.organizationId) {
      return null
    }
    return group
  }

  if (group.organizationId !== req.authUser?.organizationId) {
    return null
  }
  return group
}

groupsRouter.get(
  '/',
  authorizeAny([
    ['system-config-groups', 'view'],
    ['system-config-operators', 'view'],
    ['system-config-operators', 'edit'],
  ]),
  async (req, res) => {
    const groups = await prisma.userGroup.findMany({
      where: await organizationListWhere(req),
      include: groupInclude,
      orderBy: { name: 'asc' },
    })
    return res.json(groups.map(formatGroup))
  },
)

groupsRouter.get('/:id', authorize('system-config-groups', 'view'), async (req, res) => {
  const scoped = await assertGroupInScope(req, paramId(req))
  if (!scoped) {
    return res.status(404).json({ message: 'Group not found' })
  }

  const group = await prisma.userGroup.findUnique({
    where: { id: scoped.id },
    include: groupDetailInclude,
  })
  if (!group) {
    return res.status(404).json({ message: 'Group not found' })
  }
  return res.json(formatGroup(group))
})

groupsRouter.post('/', authorize('system-config-groups', 'edit'), async (req, res) => {
  const parsed = createGroupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const organizationId = await resolveOrganizationId(req, parsed.data.organizationId)
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization context required' })
  }

  const role = await assertRoleForOrganization(parsed.data.roleId, organizationId)
  if (!role) {
    return res.status(400).json({ message: 'Role must belong to the same organization as the group' })
  }

  try {
    const group = await prisma.userGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        roleId: parsed.data.roleId,
        organizationId,
      },
      include: groupDetailInclude,
    })
    return res.status(201).json(formatGroup(group))
  } catch {
    return res.status(409).json({ message: 'Group name already exists' })
  }
})

groupsRouter.patch('/:id', authorize('system-config-groups', 'edit'), async (req, res) => {
  const parsed = updateGroupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const scoped = await assertGroupInScope(req, paramId(req))
  if (!scoped) {
    return res.status(404).json({ message: 'Group not found' })
  }

  if (parsed.data.roleId) {
    const role = await assertRoleForOrganization(parsed.data.roleId, scoped.organizationId)
    if (!role) {
      return res.status(400).json({
        message: 'Role must belong to the same organization as the group',
      })
    }
  }

  if (parsed.data.memberIds) {
    const memberIds = [...new Set(parsed.data.memberIds)]
    if (memberIds.length > 0) {
      const operators = await prisma.user.findMany({
        where: {
          id: { in: memberIds },
          userType: UserType.SYSTEM_USER,
          organizationId: scoped.organizationId,
        },
        select: { id: true },
      })
      if (operators.length !== memberIds.length) {
        return res.status(400).json({
          message: 'All members must be system operators in this group\'s organization',
        })
      }
    }
  }

  try {
    const group = await prisma.$transaction(async (tx) => {
      await tx.userGroup.update({
        where: { id: scoped.id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.description !== undefined && { description: parsed.data.description }),
          ...(parsed.data.roleId !== undefined && { roleId: parsed.data.roleId }),
        },
      })

      if (parsed.data.memberIds) {
        const memberIds = [...new Set(parsed.data.memberIds)]
        const existing = await tx.userGroupMember.findMany({
          where: { groupId: scoped.id },
          select: { userId: true },
        })
        const existingIds = new Set(existing.map((m) => m.userId))
        const desiredIds = new Set(memberIds)
        const toRemove = [...existingIds].filter((id) => !desiredIds.has(id))
        const toAdd = memberIds.filter((id) => !existingIds.has(id))

        if (toRemove.length > 0) {
          await tx.userGroupMember.deleteMany({
            where: { groupId: scoped.id, userId: { in: toRemove } },
          })
        }
        if (toAdd.length > 0) {
          await tx.userGroupMember.createMany({
            data: toAdd.map((userId) => ({ userId, groupId: scoped.id })),
          })
        }
      }

      return tx.userGroup.findUniqueOrThrow({
        where: { id: scoped.id },
        include: groupDetailInclude,
      })
    })

    return res.json(formatGroup(group))
  } catch {
    return res.status(404).json({ message: 'Group not found' })
  }
})

groupsRouter.delete('/:id', authorize('system-config-groups', 'delete'), async (req, res) => {
  const scoped = await assertGroupInScope(req, paramId(req))
  if (!scoped) {
    return res.status(404).json({ message: 'Group not found' })
  }

  const group = await prisma.userGroup.findUnique({
    where: { id: scoped.id },
    include: { _count: { select: { members: true } } },
  })
  if (!group) {
    return res.status(404).json({ message: 'Group not found' })
  }
  if (group._count.members > 0) {
    return res.status(400).json({ message: 'Group has members and cannot be deleted' })
  }
  await prisma.userGroup.delete({ where: { id: group.id } })
  return res.status(204).send()
})
