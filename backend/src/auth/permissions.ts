import { UserType } from '@prisma/client'

export const MODULES = [
  'dashboard',
  'statements',
  'reports',
  'report-builder',
  'agents',
  'balance',
  'customers',
  'banks',
  'remittance',
  'aml',
  'dashboard-builder',
  'schedules',
  'system-config-roles',
  'system-config-groups',
  'system-config-operators',
  'system-config-datasources',
  'audit',
] as const

export const SYSTEM_CONFIG_MODULES = [
  'system-config-roles',
  'system-config-groups',
  'system-config-operators',
  'system-config-datasources',
] as const

export const ACTIONS = [
  'view',
  'export_pdf',
  'export_csv',
  'schedule',
  'edit',
  'delete',
] as const

export type ModuleKey = (typeof MODULES)[number]
export type ActionKey = (typeof ACTIONS)[number]

const SYSTEM_CONFIG_ACTIONS: readonly ActionKey[] = ['view', 'edit', 'delete']

/** Actions available per module in the roles permission matrix. */
const MODULE_ACTION_OVERRIDES: Partial<Record<ModuleKey, readonly ActionKey[]>> = {
  'system-config-roles': SYSTEM_CONFIG_ACTIONS,
  'system-config-groups': SYSTEM_CONFIG_ACTIONS,
  'system-config-operators': SYSTEM_CONFIG_ACTIONS,
  'system-config-datasources': SYSTEM_CONFIG_ACTIONS,
}

export function actionsForModule(moduleKey: string): readonly ActionKey[] {
  const override = MODULE_ACTION_OVERRIDES[moduleKey as ModuleKey]
  if (override) {
    return override
  }
  return ACTIONS
}

export function getModuleActionsMap(): Record<ModuleKey, ActionKey[]> {
  return Object.fromEntries(
    MODULES.map((moduleKey) => [moduleKey, [...actionsForModule(moduleKey)]]),
  ) as Record<ModuleKey, ActionKey[]>
}

type PermissionRow = {
  moduleKey: string
  actionKey: string
}

type RoleWithPermissions = {
  permissions: Array<{
    permission: PermissionRow
  }>
}

type GroupWithRole = {
  group: {
    role: RoleWithPermissions
  }
}

export type UserWithPermissionGraph = {
  userType: UserType
  roles: Array<{
    role: RoleWithPermissions
  }>
  groups: GroupWithRole[]
}

export const userPermissionInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
  groups: {
    include: {
      group: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  },
} as const

function permissionsFromRole(role: RoleWithPermissions): string[] {
  return role.permissions.map(
    (rp) => `${rp.permission.moduleKey}:${rp.permission.actionKey}`,
  )
}

export function resolvePermissions(user: UserWithPermissionGraph): string[] {
  if (user.userType === UserType.OWNER) {
    return ['*']
  }

  const directRoles = user.roles.map((ur) => ur.role)
  const groupRoles = user.groups.map((ug) => ug.group.role)
  const all = [
    ...directRoles.flatMap(permissionsFromRole),
    ...groupRoles.flatMap(permissionsFromRole),
  ]
  return [...new Set(all)]
}
