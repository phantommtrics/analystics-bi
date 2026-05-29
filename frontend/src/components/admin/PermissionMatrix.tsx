import { useCallback, useRef, useState } from 'react'
import type { Permission } from '../../api/admin'

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  export_pdf: 'PDF',
  export_csv: 'CSV',
  schedule: 'Schedule',
  edit: 'Edit',
  delete: 'Delete',
}

const MODULE_LABELS: Record<string, string> = {
  'system-config-roles': 'System Config — Roles',
  'system-config-groups': 'System Config — User Groups',
  'system-config-operators': 'System Config — Operators',
}

function formatModule(key: string) {
  if (MODULE_LABELS[key]) {
    return MODULE_LABELS[key]
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
          {modules.map((moduleKey) => (
            <tr key={moduleKey}>
              <td className="border border-border px-3 py-2 font-medium text-text-primary">
                {formatModule(moduleKey)}
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
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-text-secondary">
        Click or drag across cells to select permissions.
      </p>
    </div>
  )
}
