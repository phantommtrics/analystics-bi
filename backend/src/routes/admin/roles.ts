import { Router } from 'express'
import { UserType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../prisma.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize, authorizeAny } from '../../middleware/authorize.js'
import { ACTIONS, MODULES, getModuleActionsMap } from '../../auth/permissions.js'
import {
  CUSTOM_DASHBOARD_ACTIONS,
  buildDashboardPermissionModuleList,
  ensureAllDashboardPermissions,
  insertModulesAfter,
  listMainMenuDashboardModuleKeys,
  listSidebarDashboardModulesBySection,
} from '../../dashboards/permissions.js'
import {
  CUSTOM_REPORT_ACTIONS,
  ensureAllReportPermissions,
  listCatalogReportModuleKeys,
} from '../../reports/permissions.js'
import {
  CUSTOM_STATEMENT_ACTIONS,
  ensureAllStatementPermissions,
  listCatalogStatementModuleKeys,
} from '../../statements/permissions.js'
import { paramId } from '../../utils/params.js'
import { organizationListWhere, resolveOrganizationId } from '../../organization/scope.js'

export const rolesRouter = Router()

rolesRouter.use(authenticate)

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  organizationId: z.string().min(1).optional(),
})

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
})

const setPermissionsSchema = z.object({
  permissionIds: z.array(z.string()),
})

const roleListInclude = {
  organization: { select: { id: true, name: true } },
  _count: { select: { permissions: true, groups: true } },
  users: { select: { userId: true } },
  groups: {
    select: {
      members: { select: { userId: true } },
    },
  },
} as const

function formatRole(r: {
  id: string
  name: string
  description: string | null
  organizationId: string | null
  organization: { id: string; name: string } | null
  createdAt: Date
  updatedAt: Date
  _count: { permissions: number; groups: number }
  users: Array<{ userId: string }>
  groups: Array<{ members: Array<{ userId: string }> }>
}) {
  const userIds = new Set([
    ...r.users.map((u) => u.userId),
    ...r.groups.flatMap((g) => g.members.map((m) => m.userId)),
  ])
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    organizationId: r.organizationId,
    organizationName: r.organization?.name ?? null,
    userCount: userIds.size,
    groupCount: r._count.groups,
    permissionCount: r._count.permissions,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

async function assertRoleInScope(
  req: Parameters<typeof resolveOrganizationId>[0],
  roleId: string,
) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, organizationId: true },
  })
  if (!role) return null

  if (req.authUser?.userType === UserType.OWNER) {
    const listFilter = await organizationListWhere(req)
    if (listFilter.organizationId && role.organizationId !== listFilter.organizationId) {
      return null
    }
    return role
  }

  if (!role.organizationId || role.organizationId !== req.authUser?.organizationId) {
    return null
  }
  return role
}

export async function assertRoleForOrganization(roleId: string, organizationId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, organizationId: true, name: true },
  })
  if (!role || !role.organizationId || role.organizationId !== organizationId) {
    return null
  }
  return role
}

rolesRouter.get('/permissions', authorize('system-config-roles', 'view'), async (_req, res) => {
  await Promise.all([
    ensureAllDashboardPermissions(),
    ensureAllReportPermissions(),
    ensureAllStatementPermissions(),
  ])
  const [
    permissions,
    mainMenuDashboardModules,
    sidebarDashboardBySection,
    catalogReportModules,
    catalogStatementModules,
  ] = await Promise.all([
    prisma.permission.findMany({
      orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
    }),
    listMainMenuDashboardModuleKeys(),
    listSidebarDashboardModulesBySection(),
    listCatalogReportModuleKeys(),
    listCatalogStatementModuleKeys(),
  ])

  const allCustomDashboardModules = [
    ...mainMenuDashboardModules,
    ...Object.values(sidebarDashboardBySection).flat(),
  ]

  const moduleActions = {
    ...getModuleActionsMap(),
    ...Object.fromEntries(
      allCustomDashboardModules.map((moduleKey) => [
        moduleKey,
        [...CUSTOM_DASHBOARD_ACTIONS],
      ]),
    ),
    ...Object.fromEntries(
      catalogReportModules.map((moduleKey) => [moduleKey, [...CUSTOM_REPORT_ACTIONS]]),
    ),
    ...Object.fromEntries(
      catalogStatementModules.map((moduleKey) => [moduleKey, [...CUSTOM_STATEMENT_ACTIONS]]),
    ),
  }

  const modules = insertModulesAfter(
    insertModulesAfter(
      buildDashboardPermissionModuleList(
        MODULES,
        mainMenuDashboardModules,
        sidebarDashboardBySection,
      ),
      'reports',
      catalogReportModules,
    ),
    'statements',
    catalogStatementModules,
  )

  return res.json({
    modules,
    actions: ACTIONS,
    moduleActions,
    permissions,
  })
})

rolesRouter.get(
  '/',
  authorizeAny([
    ['system-config-roles', 'view'],
    ['system-config-groups', 'edit'],
  ]),
  async (req, res) => {
    const orgFilter = await organizationListWhere(req)
    const roles = await prisma.role.findMany({
      where: orgFilter,
      include: roleListInclude,
      orderBy: [{ name: 'asc' }],
    })
    return res.json(roles.map(formatRole))
  },
)

rolesRouter.get('/:id', authorize('system-config-roles', 'view'), async (req, res) => {
  const scoped = await assertRoleInScope(req, paramId(req))
  if (!scoped) {
    return res.status(404).json({ message: 'Role not found' })
  }

  const role = await prisma.role.findUnique({
    where: { id: scoped.id },
    include: {
      ...roleListInclude,
      permissions: { include: { permission: true } },
    },
  })
  if (!role) {
    return res.status(404).json({ message: 'Role not found' })
  }
  return res.json({
    ...formatRole(role),
    permissionIds: role.permissions.map((rp) => rp.permissionId),
    permissions: role.permissions.map((rp) => rp.permission),
  })
})

rolesRouter.post('/', authorize('system-config-roles', 'edit'), async (req, res) => {
  const parsed = createRoleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const organizationId = await resolveOrganizationId(req, parsed.data.organizationId)
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization context required' })
  }

  try {
    const role = await prisma.role.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        organizationId,
      },
      include: roleListInclude,
    })
    return res.status(201).json(formatRole(role))
  } catch {
    return res.status(409).json({ message: 'Role name already exists in this organization' })
  }
})

rolesRouter.patch('/:id', authorize('system-config-roles', 'edit'), async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const scoped = await assertRoleInScope(req, paramId(req))
  if (!scoped) {
    return res.status(404).json({ message: 'Role not found' })
  }
  if (!scoped.organizationId) {
    return res.status(400).json({ message: 'Cannot rename the platform Owner role' })
  }

  try {
    const role = await prisma.role.update({
      where: { id: scoped.id },
      data: parsed.data,
      include: roleListInclude,
    })
    return res.json(formatRole(role))
  } catch {
    return res.status(409).json({ message: 'Role name already exists in this organization' })
  }
})

rolesRouter.put('/:id/permissions', authorize('system-config-roles', 'edit'), async (req, res) => {
  const parsed = setPermissionsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const scoped = await assertRoleInScope(req, paramId(req))
  if (!scoped) {
    return res.status(404).json({ message: 'Role not found' })
  }

  const validCount = await prisma.permission.count({
    where: { id: { in: parsed.data.permissionIds } },
  })
  if (validCount !== parsed.data.permissionIds.length) {
    return res.status(400).json({ message: 'One or more permission IDs are invalid' })
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: scoped.id } }),
    prisma.rolePermission.createMany({
      data: parsed.data.permissionIds.map((permissionId) => ({
        roleId: scoped.id,
        permissionId,
      })),
    }),
  ])

  const updated = await prisma.role.findUnique({
    where: { id: scoped.id },
    include: { permissions: { include: { permission: true } } },
  })
  return res.json({
    id: updated!.id,
    permissionIds: updated!.permissions.map((rp) => rp.permissionId),
  })
})

rolesRouter.delete('/:id', authorize('system-config-roles', 'delete'), async (req, res) => {
  const scoped = await assertRoleInScope(req, paramId(req))
  if (!scoped) {
    return res.status(404).json({ message: 'Role not found' })
  }
  if (!scoped.organizationId || scoped.name === 'Owner') {
    return res.status(400).json({ message: 'Cannot delete the Owner role' })
  }

  const role = await prisma.role.findUnique({
    where: { id: scoped.id },
    include: { _count: { select: { users: true, groups: true } } },
  })
  if (!role) {
    return res.status(404).json({ message: 'Role not found' })
  }
  if (role._count.users > 0 || role._count.groups > 0) {
    return res.status(400).json({ message: 'Role is in use and cannot be deleted' })
  }
  await prisma.role.delete({ where: { id: role.id } })
  return res.status(204).send()
})
