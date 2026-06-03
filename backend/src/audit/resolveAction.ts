type ResolvedAction = {
  action: string
  resource?: string
} | null

const SKIP_PREFIXES = ['/audit-logs', '/health', '/auth']

export function shouldAuditRequest(method: string, path: string): boolean {
  const normalized = normalizePath(path)
  if (SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false
  }
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return false
  }
  return normalized.length > 0
}

export function resolveAuditAction(method: string, path: string): ResolvedAction {
  const normalized = normalizePath(path)
  const segments = normalized.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const [root, ...rest] = segments

  switch (root) {
    case 'auth':
      if (rest[0] === 'logout') return { action: 'LOGOUT', resource: 'System' }
      if (rest[0] === 'change-password') return { action: 'CHANGE_PASSWORD', resource: 'System' }
      return null

    case 'admin':
      return resolveAdminAction(method, segments)

    case 'reports':
      return resolveReportAction(method, segments)

    case 'dashboards':
      return resolveDashboardAction(method, segments)

    case 'schedules':
      return resolveScheduleAction(method, segments)

    case 'report-builder':
      if (rest[0] === 'execute') {
        return { action: 'RUN_REPORT_QUERY', resource: 'Report Builder' }
      }
      return null

    default:
      return { action: `${method}_${root}`.toUpperCase(), resource: normalized }
  }
}

function resolveAdminAction(method: string, segments: string[]): ResolvedAction {
  const [, resourceType, id, subAction] = segments

  switch (resourceType) {
    case 'roles':
      if (!id) return { action: 'CREATE_ROLE', resource: 'Roles' }
      if (method === 'DELETE') return { action: 'DELETE_ROLE', resource: `Role: ${id}` }
      if (subAction === 'permissions') return { action: 'UPDATE_ROLE_PERMISSIONS', resource: `Role: ${id}` }
      return { action: 'UPDATE_ROLE', resource: `Role: ${id}` }

    case 'groups':
      if (!id) return { action: 'CREATE_GROUP', resource: 'User Groups' }
      if (method === 'DELETE') return { action: 'DELETE_GROUP', resource: `Group: ${id}` }
      return { action: 'UPDATE_GROUP', resource: `Group: ${id}` }

    case 'operators':
      if (!id) return { action: 'CREATE_OPERATOR', resource: 'Operators' }
      if (subAction === 'resend-invite') return { action: 'RESEND_INVITE', resource: `Operator: ${id}` }
      if (subAction === 'reset-password') return { action: 'RESET_OPERATOR_PASSWORD', resource: `Operator: ${id}` }
      if (subAction === 'disable') return { action: 'DISABLE_OPERATOR', resource: `Operator: ${id}` }
      if (subAction === 'enable') return { action: 'ENABLE_OPERATOR', resource: `Operator: ${id}` }
      return { action: 'UPDATE_OPERATOR', resource: `Operator: ${id}` }

    case 'datasources':
      if (!id) return { action: 'CREATE_DATASOURCE', resource: 'Data Sources' }
      if (method === 'DELETE') return { action: 'DELETE_DATASOURCE', resource: `Data Source: ${id}` }
      if (subAction === 'test') return { action: 'TEST_DATASOURCE', resource: `Data Source: ${id}` }
      return { action: 'UPDATE_DATASOURCE', resource: `Data Source: ${id}` }

    default:
      return { action: 'ADMIN_ACTION', resource: segments.join('/') }
  }
}

function resolveReportAction(method: string, segments: string[]): ResolvedAction {
  const [, id, subAction] = segments

  if (!id) {
    return { action: 'CREATE_REPORT', resource: 'Reports' }
  }

  switch (subAction) {
    case 'publish':
      return { action: 'PUBLISH_REPORT', resource: `Report: ${id}` }
    case 'unpublish':
      return { action: 'UNPUBLISH_REPORT', resource: `Report: ${id}` }
    case 'execute':
      return { action: 'RUN_REPORT', resource: `Report: ${id}` }
    case 'restore':
      return { action: 'RESTORE_REPORT', resource: `Report: ${id}` }
    default:
      if (method === 'DELETE') {
        return { action: 'DELETE_REPORT', resource: `Report: ${id}` }
      }
      return { action: 'UPDATE_REPORT', resource: `Report: ${id}` }
  }
}

function resolveDashboardAction(method: string, segments: string[]): ResolvedAction {
  const [, id, subAction] = segments

  if (!id) {
    return { action: 'CREATE_DASHBOARD', resource: 'Dashboards' }
  }

  switch (subAction) {
    case 'publish':
      return { action: 'PUBLISH_DASHBOARD', resource: `Dashboard: ${id}` }
    case 'unpublish':
      return { action: 'UNPUBLISH_DASHBOARD', resource: `Dashboard: ${id}` }
    default:
      if (method === 'DELETE') {
        return { action: 'DELETE_DASHBOARD', resource: `Dashboard: ${id}` }
      }
      return { action: 'UPDATE_DASHBOARD', resource: `Dashboard: ${id}` }
  }
}

function resolveScheduleAction(method: string, segments: string[]): ResolvedAction {
  const [, id] = segments

  if (!id) {
    return { action: 'CREATE_SCHEDULE', resource: 'Schedules' }
  }
  if (method === 'DELETE') {
    return { action: 'DELETE_SCHEDULE', resource: `Schedule: ${id}` }
  }
  return { action: 'UPDATE_SCHEDULE', resource: `Schedule: ${id}` }
}

function normalizePath(path: string): string {
  const withoutQuery = path.split('?')[0] ?? path
  return withoutQuery.replace(/^\/api\/?/, '').replace(/\/$/, '')
}
