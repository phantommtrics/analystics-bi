import { UserType } from '@prisma/client'
import { prisma } from '../prisma.js'

export const CUSTOM_STATEMENT_PREFIX = 'custom-statement-'

export const CUSTOM_STATEMENT_ACTIONS = [
  'view',
  'export_pdf',
  'export_csv',
  'schedule',
] as const

export type CustomStatementAction = (typeof CUSTOM_STATEMENT_ACTIONS)[number]

export function statementModuleKey(statementId: string): string {
  return `${CUSTOM_STATEMENT_PREFIX}${statementId}`
}

export function isCustomStatementModule(moduleKey: string): boolean {
  return moduleKey.startsWith(CUSTOM_STATEMENT_PREFIX)
}

export function statementIdFromModuleKey(moduleKey: string): string | null {
  if (!isCustomStatementModule(moduleKey)) return null
  return moduleKey.slice(CUSTOM_STATEMENT_PREFIX.length)
}

export type StatementPermissionMeta = {
  name: string
}

export async function syncStatementPermissions(
  statementId: string,
  meta: StatementPermissionMeta,
) {
  const moduleKey = statementModuleKey(statementId)
  for (const actionKey of CUSTOM_STATEMENT_ACTIONS) {
    await prisma.permission.upsert({
      where: { moduleKey_actionKey: { moduleKey, actionKey } },
      update: {
        name: meta.name,
        description: `${actionKey} access for statement "${meta.name}"`,
      },
      create: {
        moduleKey,
        actionKey,
        name: meta.name,
        description: `${actionKey} access for statement "${meta.name}"`,
      },
    })
  }
}

export async function removeStatementPermissions(statementId: string) {
  const moduleKey = statementModuleKey(statementId)
  await prisma.rolePermission.deleteMany({
    where: { permission: { moduleKey } },
  })
  await prisma.permission.deleteMany({ where: { moduleKey } })
}

export async function ensureAllStatementPermissions() {
  const published = await prisma.statement.findMany({
    where: { deletedAt: null, isPublished: true },
    select: { id: true, name: true },
  })
  for (const statement of published) {
    await syncStatementPermissions(statement.id, { name: statement.name })
  }

  const unpublished = await prisma.statement.findMany({
    where: { deletedAt: null, isPublished: false },
    select: { id: true },
  })
  for (const statement of unpublished) {
    await removeStatementPermissions(statement.id)
  }
}

export async function listCatalogStatementModuleKeys(): Promise<string[]> {
  const statements = await prisma.statement.findMany({
    where: { deletedAt: null, isPublished: true },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  return statements.map((s) => statementModuleKey(s.id))
}

export function hasExplicitCustomStatementView(
  permissions: string[],
  statementId: string,
): boolean {
  return permissions.includes(`${statementModuleKey(statementId)}:view`)
}

export function hasStatementParentView(permissions: string[]): boolean {
  return permissions.includes('*') || permissions.includes('statements:view')
}

export function userCanViewStatement(
  permissions: string[],
  statementId: string,
  userType?: UserType,
): boolean {
  if (!hasStatementParentView(permissions)) return false
  if (userType === UserType.OWNER || permissions.includes('*')) return true
  return hasExplicitCustomStatementView(permissions, statementId)
}

function hasStatementParentExport(
  permissions: string[],
  action: 'export_pdf' | 'export_csv',
): boolean {
  return permissions.includes('*') || permissions.includes(`statements:${action}`)
}

function hasExplicitCustomStatementExport(
  permissions: string[],
  statementId: string,
  action: 'export_pdf' | 'export_csv',
): boolean {
  return permissions.includes(`${statementModuleKey(statementId)}:${action}`)
}

export function userCanExportStatement(
  permissions: string[],
  statementId: string,
  action: 'export_pdf' | 'export_csv',
  userType?: UserType,
): boolean {
  if (!hasStatementParentView(permissions)) return false
  if (userType === UserType.OWNER || permissions.includes('*')) return true
  return (
    hasStatementParentExport(permissions, action) &&
    hasExplicitCustomStatementExport(permissions, statementId, action)
  )
}
