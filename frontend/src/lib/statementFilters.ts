import type { UserType } from '../auth/types'

export const CUSTOM_STATEMENT_PREFIX = 'custom-statement-'

export function statementModuleKey(statementId: string): string {
  return `${CUSTOM_STATEMENT_PREFIX}${statementId}`
}

export function hasStatementParentView(permissions: string[]): boolean {
  return permissions.includes('*') || permissions.includes('statements:view')
}

export function hasExplicitPermission(
  permissions: string[],
  moduleKey: string,
  action: string,
): boolean {
  return permissions.includes(`${moduleKey}:${action}`)
}

export function canViewCustomStatement(
  permissions: string[],
  statementId: string,
  userType?: UserType,
): boolean {
  if (!hasStatementParentView(permissions)) return false
  if (userType === 'OWNER' || permissions.includes('*')) return true
  return hasExplicitPermission(permissions, statementModuleKey(statementId), 'view')
}

export function canExportCustomStatement(
  permissions: string[],
  statementId: string,
  action: 'export_pdf' | 'export_csv',
  userType?: UserType,
): boolean {
  if (!hasStatementParentView(permissions)) return false
  if (userType === 'OWNER' || permissions.includes('*')) return true
  const parentOk = permissions.includes(`statements:${action}`)
  const childOk = hasExplicitPermission(
    permissions,
    statementModuleKey(statementId),
    action,
  )
  return parentOk && childOk
}
