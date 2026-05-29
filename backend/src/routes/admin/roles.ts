import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../prisma.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize, authorizeAny } from '../../middleware/authorize.js'
import { ACTIONS, MODULES, getModuleActionsMap } from '../../auth/permissions.js'
import { paramId } from '../../utils/params.js'

export const rolesRouter = Router()

rolesRouter.use(authenticate)

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
})

const setPermissionsSchema = z.object({
  permissionIds: z.array(z.string()),
})

rolesRouter.get('/permissions', authorize('system-config-roles', 'view'), async (_req, res) => {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
  })
  return res.json({
    modules: MODULES,
    actions: ACTIONS,
    moduleActions: getModuleActionsMap(),
    permissions,
  })
})

rolesRouter.get(
  '/',
  authorizeAny([
    ['system-config-roles', 'view'],
    ['system-config-groups', 'edit'],
  ]),
  async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: {
      _count: { select: { users: true, permissions: true } },
    },
    orderBy: { name: 'asc' },
  })
  return res.json(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      userCount: r._count.users,
      permissionCount: r._count.permissions,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  )
},
)

rolesRouter.get('/:id', authorize('system-config-roles', 'view'), async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: paramId(req) },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  })
  if (!role) {
    return res.status(404).json({ message: 'Role not found' })
  }
  return res.json({
    id: role.id,
    name: role.name,
    description: role.description,
    userCount: role._count.users,
    permissionIds: role.permissions.map((rp) => rp.permissionId),
    permissions: role.permissions.map((rp) => rp.permission),
  })
})

rolesRouter.post('/', authorize('system-config-roles', 'edit'), async (req, res) => {
  const parsed = createRoleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }
  try {
    const role = await prisma.role.create({ data: parsed.data })
    return res.status(201).json(role)
  } catch {
    return res.status(409).json({ message: 'Role name already exists' })
  }
})

rolesRouter.patch('/:id', authorize('system-config-roles', 'edit'), async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }
  try {
    const role = await prisma.role.update({
      where: { id: paramId(req) },
      data: parsed.data,
    })
    return res.json(role)
  } catch {
    return res.status(404).json({ message: 'Role not found' })
  }
})

rolesRouter.put('/:id/permissions', authorize('system-config-roles', 'edit'), async (req, res) => {
  const parsed = setPermissionsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const role = await prisma.role.findUnique({ where: { id: paramId(req) } })
  if (!role) {
    return res.status(404).json({ message: 'Role not found' })
  }

  const validCount = await prisma.permission.count({
    where: { id: { in: parsed.data.permissionIds } },
  })
  if (validCount !== parsed.data.permissionIds.length) {
    return res.status(400).json({ message: 'One or more permission IDs are invalid' })
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({
      data: parsed.data.permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
    }),
  ])

  const updated = await prisma.role.findUnique({
    where: { id: role.id },
    include: { permissions: { include: { permission: true } } },
  })
  return res.json({
    id: updated!.id,
    permissionIds: updated!.permissions.map((rp) => rp.permissionId),
  })
})

rolesRouter.delete('/:id', authorize('system-config-roles', 'delete'), async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: paramId(req) },
    include: { _count: { select: { users: true, groups: true } } },
  })
  if (!role) {
    return res.status(404).json({ message: 'Role not found' })
  }
  if (role.name === 'Owner') {
    return res.status(400).json({ message: 'Cannot delete the Owner role' })
  }
  if (role._count.users > 0 || role._count.groups > 0) {
    return res.status(400).json({ message: 'Role is in use and cannot be deleted' })
  }
  await prisma.role.delete({ where: { id: role.id } })
  return res.status(204).send()
})
