import type { UserType } from '../auth/types'

export const CUSTOM_REPORT_PREFIX = 'custom-report-'

export function reportModuleKey(reportId: string): string {
  return `${CUSTOM_REPORT_PREFIX}${reportId}`
}

export function hasReportsParentView(permissions: string[]): boolean {
  return permissions.includes('*') || permissions.includes('reports:view')
}

export function canViewCustomReport(
  permissions: string[],
  reportId: string,
  userType?: UserType,
): boolean {
  if (!hasReportsParentView(permissions)) return false
  if (userType === 'OWNER' || permissions.includes('*')) return true
  return permissions.includes(`${reportModuleKey(reportId)}:view`)
}
