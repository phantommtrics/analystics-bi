import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../prisma.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize, authorizeAny } from '../../middleware/authorize.js'
import { paramId } from '../../utils/params.js'
import { organizationListWhere, resolveOrganizationId } from '../../organization/scope.js'

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
})

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
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }
}

const groupInclude = {
  role: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true } },
  _count: { select: { members: true } },
} as const

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
  const group = await prisma.userGroup.findUnique({
    where: { id: paramId(req) },
    include: groupInclude,
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

  const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } })
  if (!role) {
    return res.status(400).json({ message: 'Invalid role ID' })
  }

  try {
    const group = await prisma.userGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        roleId: parsed.data.roleId,
        organizationId,
      },
      include: groupInclude,
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

  if (parsed.data.roleId) {
    const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } })
    if (!role) {
      return res.status(400).json({ message: 'Invalid role ID' })
    }
  }

  try {
    const group = await prisma.userGroup.update({
      where: { id: paramId(req) },
      data: parsed.data,
      include: groupInclude,
    })
    return res.json(formatGroup(group))
  } catch {
    return res.status(404).json({ message: 'Group not found' })
  }
})

groupsRouter.delete('/:id', authorize('system-config-groups', 'delete'), async (req, res) => {
  const group = await prisma.userGroup.findUnique({
    where: { id: paramId(req) },
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
