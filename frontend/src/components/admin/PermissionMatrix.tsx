import { useCallback, useRef, useState } from 'react'
import type { Permission } from '../../api/admin'

const CUSTOM_DASHBOARD_PREFIX = 'custom-dashboard-'
const CUSTOM_REPORT_PREFIX = 'custom-report-'

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  export_pdf: 'PDF',
  export_csv: 'CSV',
  schedule: 'Schedule',
  edit: 'Edit',
  delete: 'Delete',
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  reports: 'Reports',
  schedules: 'Report Schedules',
  'system-config-roles': 'System Config — Roles',
  'system-config-groups': 'System Config — User Groups',
  'system-config-operators': 'System Config — Operators',
}

function isCustomDashboardModule(key: string) {
  return key.startsWith(CUSTOM_DASHBOARD_PREFIX)
}

function isCustomReportModule(key: string) {
  return key.startsWith(CUSTOM_REPORT_PREFIX)
}

function isCustomChildModule(key: string) {
  return isCustomDashboardModule(key) || isCustomReportModule(key)
}

function formatModule(key: string, permissions: Permission[]) {
  if (MODULE_LABELS[key]) {
    return MODULE_LABELS[key]
  }
  if (isCustomDashboardModule(key)) {
    const match = permissions.find((p) => p.moduleKey === key)
    if (match?.name) {
      return match.name
    }
    return 'Custom dashboard'
  }
  if (isCustomReportModule(key)) {
    const match = permissions.find((p) => p.moduleKey === key)
    if (match?.name) {
      return match.name
    }
    return 'Custom report'
  }
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface PermissionMatrixProps {
  modules: string[]
  actions: string[]
  moduleActions?: Record<string, string[]>
  permissions: Permission[]
  selectedIds: Set<string>
  onChange: (ids: Set<string>) => void
}

export function PermissionMatrix({
  modules,
  actions,
  moduleActions,
  permissions,
  selectedIds,
  onChange,
}: PermissionMatrixProps) {
  const permissionMap = new Map<string, string>()
  for (const p of permissions) {
    permissionMap.set(`${p.moduleKey}:${p.actionKey}`, p.id)
  }

  const dragMode = useRef<'select' | 'deselect' | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const toggleCell = useCallback(
    (moduleKey: string, actionKey: string, forceSelect?: boolean) => {
      const id = permissionMap.get(`${moduleKey}:${actionKey}`)
      if (!id) return

      const next = new Set(selectedIds)
      const shouldSelect =
        forceSelect !== undefined ? forceSelect : !next.has(id)

      if (shouldSelect) {
        next.add(id)
      } else {
        next.delete(id)
      }
      onChange(next)
    },
    [permissionMap, selectedIds, onChange],
  )

  function startDrag(moduleKey: string, actionKey: string) {
    const id = permissionMap.get(`${moduleKey}:${actionKey}`)
    if (!id) return
    dragMode.current = selectedIds.has(id) ? 'deselect' : 'select'
    setIsDragging(true)
    toggleCell(moduleKey, actionKey, dragMode.current === 'select')
  }

  function continueDrag(moduleKey: string, actionKey: string) {
    if (!isDragging || !dragMode.current) return
    toggleCell(moduleKey, actionKey, dragMode.current === 'select')
  }

  function endDrag() {
    dragMode.current = null
    setIsDragging(false)
  }

  return (
    <div
      className="overflow-x-auto"
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-bg-secondary px-3 py-2 text-left font-medium">
              Module
            </th>
            {actions.map((action) => (
              <th
                key={action}
                className="border border-border bg-bg-secondary px-2 py-2 text-center text-xs font-medium"
              >
                {ACTION_LABELS[action] ?? action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((moduleKey) => {
            const isSubModule = isCustomChildModule(moduleKey)
            return (
              <tr
                key={moduleKey}
                className={isSubModule ? 'bg-bg-secondary/30' : undefined}
              >
                <td
                  className={`border border-border py-2 font-medium text-text-primary ${
                    isSubModule ? 'pl-8 pr-3 text-sm font-normal text-text-secondary' : 'px-3'
                  }`}
                >
                  {isSubModule && (
                    <span className="mr-1.5 text-text-secondary" aria-hidden="true">
                      ↳
                    </span>
                  )}
                  {formatModule(moduleKey, permissions)}
                </td>
                {actions.map((actionKey) => {
                  const allowedForModule =
                    moduleActions?.[moduleKey]?.includes(actionKey) ?? true
                  const id = allowedForModule
                    ? permissionMap.get(`${moduleKey}:${actionKey}`)
                    : undefined
                  const selected = id ? selectedIds.has(id) : false
                  return (
                    <td
                      key={actionKey}
                      className={`border border-border p-0 text-center ${
                        id ? 'cursor-pointer select-none' : 'bg-bg-secondary/50'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (id) startDrag(moduleKey, actionKey)
                      }}
                      onMouseEnter={() => {
                        if (id) continueDrag(moduleKey, actionKey)
                      }}
                    >
                      <div
                        className={`flex h-9 items-center justify-center transition-colors ${
                          selected
                            ? 'bg-brand-blue text-white'
                            : id
                              ? 'hover:bg-brand-blue/10'
                              : ''
                        }`}
                      >
                        {selected && <i className="ti ti-check text-sm"></i>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-text-secondary">
        Click or drag across cells to select permissions. Custom dashboards and reports require
        both the parent view permission (e.g. Dashboard, Reports, Agents) and the item&apos;s own
        view permission. Sidebar dashboards appear under their section (Agents, Balance, etc.);
        other dashboards appear under Dashboard; catalog reports appear under Reports.
      </p>
    </div>
  )
}
